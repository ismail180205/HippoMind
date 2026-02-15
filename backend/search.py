"""
Reconstructive‑Memory File Finder  –  search.py

1.  Ask the user for a search query.
2.  Expand the query via LLM (add synonyms, related terms).
3.  Embed the expanded query (dense + sparse) and run a hybrid
    prefetch + RRF fusion search in Qdrant.
4.  If a direct match (≥ threshold) exists  →  return the file immediately.
5.  Otherwise, take the top‑K neighbours.
6.  Cluster them (UMAP → HDBSCAN), label with Ollama.
7.  Present the labelled clusters to the user.
8.  The user picks a cluster  →  that cluster becomes the new universe.
9.  Repeat until only one source file remains  →  show the answer.
"""

import os
import sys
import logging
from collections import Counter

import numpy as np
import hdbscan
import ollama
from sentence_transformers import SentenceTransformer
from fastembed import SparseTextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Prefetch,
    FusionQuery,
    Fusion,
    SparseVector,
    NamedVector,
    NamedSparseVector,
)

import config

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
log = logging.getLogger("search")


# ── LLM query expansion ──────────────────────────────────────────────────────

def expand_query(query: str) -> str:
    """
    Use the local LLM to expand the user's short query into a richer
    formulation that will match more relevant embeddings.
    Returns the expanded query string (falls back to original on error).
    """
    client = ollama.Client(host=config.OLLAMA_BASE_URL)
    prompt = (
        "You are a search‑query expander. Given the user's short query, "
        "rewrite it as a single enriched paragraph that includes synonyms, "
        "related terms, likely full titles, and geographic context if applicable. "
        "Do NOT explain — output ONLY the expanded query.\n\n"
        f"User query: {query}\n\nExpanded query:"
    )
    try:
        resp = client.chat(
            model=config.OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        expanded = resp["message"]["content"].strip()
        log.info("Expanded query: %s", expanded[:200])
        return expanded
    except Exception as e:
        log.warning("Query expansion failed (%s) – using original query.", e)
        return query


# ── Qdrant helpers ────────────────────────────────────────────────────────────

def fetch_all_points(client: QdrantClient) -> list[dict]:
    """
    Scroll through every point in the collection and return a list of dicts:
        { "id": …, "vector": […], "chunk": "…", "file": "…", "chunk_type": "…" }
    Only the *dense* vector is kept for downstream clustering.
    """
    points: list[dict] = []
    offset = None
    while True:
        results, offset = client.scroll(
            collection_name=config.COLLECTION_NAME,
            limit=256,
            offset=offset,
            with_payload=True,
            with_vectors=True,
        )
        for pt in results:
            # Named vectors come back as a dict
            if isinstance(pt.vector, dict):
                dense_vec = pt.vector.get(config.DENSE_VECTOR_NAME, [])
            else:
                dense_vec = pt.vector  # backwards compat
            points.append({
                "id": pt.id,
                "vector": dense_vec,
                "chunk": pt.payload.get("chunk", ""),
                "file": pt.payload.get("file", "unknown"),
                "chunk_type": pt.payload.get("chunk_type", "content"),
            })
        if offset is None:
            break
    return points


# ── Hybrid similarity search ─────────────────────────────────────────────────

def _sparse_embed_query(sparse_model: SparseTextEmbedding, text: str) -> SparseVector:
    """Compute BM25 sparse vector for a single query string."""
    result = list(sparse_model.embed([text]))[0]
    return SparseVector(
        indices=result.indices.tolist(),
        values=result.values.tolist(),
    )


def search_by_query(
    client: QdrantClient,
    dense_model: SentenceTransformer,
    sparse_model: SparseTextEmbedding,
    query: str,
) -> list[dict]:
    """
    Hybrid search using Qdrant's prefetch + RRF fusion.
    Two prefetch legs (dense, sparse) are fused server‑side.
    Returns a list of dicts with id, vector, chunk, file, chunk_type, score.
    """
    # Dense query vector
    dense_vec = dense_model.encode(query).tolist()
    # Sparse query vector
    sparse_vec = _sparse_embed_query(sparse_model, query)

    results = client.query_points(
        collection_name=config.COLLECTION_NAME,
        prefetch=[
            Prefetch(
                query=dense_vec,
                using=config.DENSE_VECTOR_NAME,
                limit=config.SEARCH_TOP_K,
            ),
            Prefetch(
                query=sparse_vec,
                using=config.SPARSE_VECTOR_NAME,
                limit=config.SEARCH_TOP_K,
            ),
        ],
        query=FusionQuery(fusion=Fusion.RRF),
        limit=config.SEARCH_TOP_K,
        with_payload=True,
        with_vectors=True,
    )

    points = []
    for hit in results.points:
        # Extract dense vector from named vectors
        if isinstance(hit.vector, dict):
            dense = hit.vector.get(config.DENSE_VECTOR_NAME, [])
        else:
            dense = hit.vector
        points.append({
            "id": hit.id,
            "vector": dense,
            "chunk": hit.payload.get("chunk", ""),
            "file": hit.payload.get("file", "unknown"),
            "chunk_type": hit.payload.get("chunk_type", "content"),
            "score": hit.score,
        })
    return points


# ── Clustering helpers ────────────────────────────────────────────────────────

def cluster_vectors(vectors: np.ndarray) -> np.ndarray:
    """
    Run HDBSCAN directly on the high‑dimensional vectors using cosine
    distance.  Skips the UMAP 2D projection which was collapsing
    1024‑dim BGE embeddings into a uniform blob.

    Returns cluster_labels (np.ndarray of ints, ‑1 = noise).
    """
    n_samples = len(vectors)

    # ── Normalise so cosine distance = Euclidean on unit sphere ───────
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    normed = vectors / norms

    # ── HDBSCAN on the normalised vectors ─────────────────────────────
    min_cs = max(config.HDBSCAN_MIN_CLUSTER_SIZE, n_samples // 15)

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cs,
        min_samples=2,
        metric="euclidean",            # on L2‑normed vecs ≈ cosine
        cluster_selection_method="eom", # Excess of Mass – better at
                                        # finding clusters of varying size
    )
    labels = clusterer.fit_predict(normed)

    # ── Cap to MAX_CLUSTERS ───────────────────────────────────────────
    unique, counts = np.unique(labels[labels >= 0], return_counts=True)
    if len(unique) > config.MAX_CLUSTERS:
        top_ids = set(unique[np.argsort(-counts)[:config.MAX_CLUSTERS]])
        labels = np.array([l if l in top_ids else -1 for l in labels])
        remap = {old: new for new, old in enumerate(sorted(top_ids))}
        labels = np.array([remap[l] if l in remap else -1 for l in labels])

    return labels


def _aggregate_cluster_text(points: list[dict], labels: np.ndarray) -> dict[int, str]:
    """Concatenate chunk text per cluster (skip noise = ‑1)."""
    cluster_texts: dict[int, list[str]] = {}
    for pt, lbl in zip(points, labels):
        if lbl == -1:
            continue
        cluster_texts.setdefault(int(lbl), []).append(pt["chunk"])
    return {k: "\n\n".join(v) for k, v in cluster_texts.items()}


def _cluster_files(points: list[dict], labels: np.ndarray) -> dict[int, list[str]]:
    """Return a mapping cluster_id → list of *unique* file names."""
    mapping: dict[int, set[str]] = {}
    for pt, lbl in zip(points, labels):
        if lbl == -1:
            continue
        mapping.setdefault(int(lbl), set()).add(pt["file"])
    return {k: sorted(v) for k, v in mapping.items()}


def label_clusters(cluster_texts: dict[int, str]) -> dict[int, str]:
    """Ask Ollama LLM to label each cluster."""
    client = ollama.Client(host=config.OLLAMA_BASE_URL)
    labels: dict[int, str] = {}

    for cid, text in cluster_texts.items():
        # Keep prompt short
        truncated = text[:3000]
        prompt = (
            "You are an expert librarian. Given the following collection of "
            "text excerpts from documents, provide a concise descriptive label "
            "(a short phrase) that captures the main topic. "
            "Return ONLY the label, nothing else.\n\n"
            f"Text:\n{truncated}\n\nLabel:"
        )
        try:
            resp = client.chat(
                model=config.OLLAMA_MODEL,
                messages=[{"role": "user", "content": prompt}],
            )
            labels[cid] = resp["message"]["content"].strip().strip('"')
        except Exception as e:
            log.error("LLM label error for cluster %s: %s", cid, e)
            labels[cid] = f"Cluster {cid}"

    return labels


def present_options(
    cluster_labels: dict[int, str],
    cluster_files: dict[int, list[str]],
    cluster_sizes: dict[int, int],
) -> str:
    """
    Use the LLM to present the cluster options to the user in a friendly,
    hint‑like way that helps them recall which file they're looking for.
    """
    client = ollama.Client(host=config.OLLAMA_BASE_URL)

    options_desc = []
    for cid in sorted(cluster_labels):
        files = cluster_files.get(cid, [])
        options_desc.append(
            f"Option {cid}: \"{cluster_labels[cid]}\" "
            f"({cluster_sizes[cid]} chunks from {len(files)} file(s))"
        )
    options_block = "\n".join(options_desc)

    prompt = (
        "You are helping a user find a specific file they half‑remember. "
        "Below are labelled groups of document chunks. Present each option "
        "as a short, friendly hint that might jog the user's memory about "
        "which group their file belongs to. Number them clearly.\n\n"
        f"{options_block}\n\n"
        "Present these options to the user now:"
    )
    try:
        resp = client.chat(
            model=config.OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp["message"]["content"].strip()
    except Exception as e:
        log.error("LLM presentation error: %s", e)
        return options_block


# ── LLM‑guided follow‑up when the user is stuck ──────────────────────────────

MAX_FOLLOWUP_QUESTIONS = 3


def _build_file_summaries(points: list[dict]) -> dict[str, str]:
    """
    For each unique file in *points*, concatenate (and truncate) its chunk
    texts so the LLM has something concrete to reason about.
    """
    file_chunks: dict[str, list[str]] = {}
    for pt in points:
        file_chunks.setdefault(pt["file"], []).append(pt["chunk"])
    return {
        fname: "\n".join(chunks)[:2000]
        for fname, chunks in file_chunks.items()
    }


def _ask_followup_question(
    file_summaries: dict[str, str],
    conversation: list[dict],
    question_num: int,
) -> str:
    """
    Ask the LLM to generate ONE follow‑up question that would best
    distinguish between the remaining files.
    """
    llm = ollama.Client(host=config.OLLAMA_BASE_URL)

    files_block = "\n\n".join(
        f"FILE: {fname}\n{summary}"
        for fname, summary in file_summaries.items()
    )

    history = "\n".join(
        f"Q: {m['q']}\nA: {m['a']}" for m in conversation
    ) if conversation else "(no questions asked yet)"

    prompt = (
        "You are helping a user find a specific file they half‑remember. "
        "Below are summaries of the remaining candidate files, plus the "
        "conversation so far.\n\n"
        f"Candidate files:\n{files_block}\n\n"
        f"Conversation so far:\n{history}\n\n"
        f"This is follow‑up question {question_num} of {MAX_FOLLOWUP_QUESTIONS}. "
        "Generate ONE short, concrete yes/no or multiple‑choice question "
        "that would best help narrow down which file the user is looking for. "
        "Focus on distinguishing features: topic, geography, date, format, "
        "methodology, organisation, etc. "
        "Return ONLY the question, nothing else."
    )
    try:
        resp = llm.chat(
            model=config.OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp["message"]["content"].strip()
    except Exception as e:
        log.error("Follow‑up question error: %s", e)
        return "Can you describe anything else you remember about the file?"


def _filter_by_followup(
    points: list[dict],
    conversation: list[dict],
    dense_model: SentenceTransformer,
) -> list[dict]:
    """
    Use the accumulated follow‑up answers to semantically re‑score
    each point and keep only those above the median similarity.
    """
    # Combine all answers into one context string
    context = " ".join(m["a"] for m in conversation)
    context_vec = dense_model.encode(context)

    # Score every point against the combined context
    scored: list[tuple[float, dict]] = []
    for pt in points:
        vec = np.array(pt["vector"])
        # Cosine similarity
        sim = float(np.dot(context_vec, vec) / (
            np.linalg.norm(context_vec) * np.linalg.norm(vec) + 1e-9
        ))
        scored.append((sim, pt))

    scored.sort(key=lambda x: -x[0])

    # Keep the top half (above median)
    median_idx = max(1, len(scored) // 2)
    kept = [pt for _, pt in scored[:median_idx]]

    # Make sure we keep at least a few
    if len(kept) < 3:
        kept = [pt for _, pt in scored[:max(3, len(scored))]]

    return kept


def guided_followup(
    points: list[dict],
    dense_model: SentenceTransformer,
) -> list[dict]:
    """
    Run up to MAX_FOLLOWUP_QUESTIONS rounds of LLM‑guided questioning.
    After each answer the candidate set is semantically filtered.
    Returns the narrowed‑down list of points.
    """
    file_summaries = _build_file_summaries(points)
    conversation: list[dict] = []
    current_points = points

    print(f"\n💭  Let me ask a few questions to help you remember …\n")

    for q_num in range(1, MAX_FOLLOWUP_QUESTIONS + 1):
        question = _ask_followup_question(file_summaries, conversation, q_num)
        answer = input(f"  Q{q_num}: {question}\n  A{q_num}: ").strip()

        if not answer:
            print("  (skipped)")
            continue

        conversation.append({"q": question, "a": answer})

        # Re‑filter based on everything the user has told us so far
        current_points = _filter_by_followup(
            current_points, conversation, dense_model,
        )

        unique_files = list({pt["file"] for pt in current_points})
        print(f"  ↳ Narrowed to {len(current_points)} chunks across "
              f"{len(unique_files)} file(s).")

        if len(unique_files) == 1:
            print("\n" + "=" * 60)
            print(f"🎯  Found it!  Your file is:  {unique_files[0]}")
            print("=" * 60)
            return current_points

        if len(unique_files) <= 3:
            print(f"\n  Down to {len(unique_files)} candidates — "
                  "returning to cluster view.\n")
            break

    return current_points


# ── Interactive loop ──────────────────────────────────────────────────────────

def run_search(all_points: list[dict], dense_model: SentenceTransformer) -> None:
    """Recursive clustering loop until one file remains."""
    current_points = all_points
    iteration = 0

    while True:
        iteration += 1
        unique_files = list({pt["file"] for pt in current_points})

        # ── Termination: single file left ─────────────────────────────────
        if len(unique_files) == 1:
            print("\n" + "=" * 60)
            print(f"🎯  Found it!  Your file is:  {unique_files[0]}")
            print("=" * 60)
            return

        # ── Termination: too few vectors to cluster ───────────────────────
        if len(current_points) < 3:
            print("\n" + "=" * 60)
            print("Remaining files:")
            for f in unique_files:
                print(f"  • {f}")
            print("=" * 60)
            return

        print(f"\n{'─' * 60}")
        print(f"  Round {iteration}  –  {len(current_points)} chunks from "
              f"{len(unique_files)} file(s)")
        print(f"{'─' * 60}")

        vectors = np.array([pt["vector"] for pt in current_points])
        labels = cluster_vectors(vectors)

        # Build cluster info
        cluster_texts = _aggregate_cluster_text(current_points, labels)
        cluster_files = _cluster_files(current_points, labels)
        cluster_sizes: dict[int, int] = Counter(
            int(l) for l in labels if l != -1
        )

        # If everything is noise (no clusters found), relax or stop
        if not cluster_texts:
            print("\nClustering couldn't form groups — switching to guided Q&A …")
            current_points = guided_followup(current_points, dense_model)
            continue

        # Label via LLM
        print("\nLabelling clusters …")
        cluster_labels = label_clusters(cluster_texts)

        # Present to user
        presentation = present_options(cluster_labels, cluster_files, cluster_sizes)
        print(f"\n{presentation}\n")

        # Ask user to pick
        valid_ids = sorted(cluster_labels.keys())
        while True:
            raw = input(
                f"Which group sounds like your file? "
                f"Enter a number {valid_ids} or '?' if unsure: "
            ).strip()

            # ── User is stuck → guided follow‑up ─────────────────────────
            if raw == "?":
                current_points = guided_followup(current_points, dense_model)
                break  # re‑enter the while‑True loop to re‑cluster

            try:
                choice_id = int(raw)
                if choice_id in valid_ids:
                    # Filter down to chosen cluster
                    current_points = [
                        pt for pt, lbl in zip(current_points, labels)
                        if lbl == choice_id
                    ]
                    print(f"\n  ↳ Narrowed to {len(current_points)} chunks.")
                    break
                print(f"  Please enter one of {valid_ids} or '?'.")
            except (ValueError, EOFError):
                print(f"  Please enter one of {valid_ids} or '?'.")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    client = QdrantClient(
        url=config.QDRANT_URL,
        api_key=config.QDRANT_API_KEY,
    )

    # Verify collection exists
    existing = [c.name for c in client.get_collections().collections]
    if config.COLLECTION_NAME not in existing:
        print(
            f"❌  Collection '{config.COLLECTION_NAME}' does not exist.\n"
            f"   Run watcher.py first and drop some PDFs into '{config.DATA_DIR}'."
        )
        sys.exit(1)

    info = client.get_collection(config.COLLECTION_NAME)
    if info.points_count == 0:
        print(
            f"❌  Collection '{config.COLLECTION_NAME}' is empty.\n"
            f"   Drop some PDFs into '{config.DATA_DIR}' and let watcher.py ingest them."
        )
        sys.exit(1)

    print(f"📚  {info.points_count} vectors in '{config.COLLECTION_NAME}'")

    print("\n" + "=" * 60)
    print("  🧠  Reconstructive‑Memory File Finder")
    print("=" * 60)

    # Load models once
    print(f"\nLoading dense model '{config.EMBEDDING_MODEL}' …")
    dense_model = SentenceTransformer(config.EMBEDDING_MODEL)

    print(f"Loading sparse model '{config.SPARSE_MODEL}' …")
    sparse_model = SparseTextEmbedding(model_name=config.SPARSE_MODEL)

    # ── Interactive loop ──────────────────────────────────────────────────
    while True:
        query = input("\n🔍  What are you looking for? Describe the file (or 'q' to quit): ").strip()
        if not query or query.lower() in ("q", "quit", "exit"):
            print("Bye!")
            break

        # ── Step 1: Expand query via LLM ──────────────────────────────────
        print("\nExpanding query …")
        expanded = expand_query(query)

        # ── Step 2: Hybrid search (dense + sparse, RRF fusion) ────────────
        print("Searching (hybrid dense + BM25) …")
        hits = search_by_query(client, dense_model, sparse_model, expanded)

        if not hits:
            print("\n❌  No results found.")
            continue

        print(f"\nFound {len(hits)} matching chunks:\n")
        seen_files: dict[str, float] = {}
        for h in hits:
            if h["file"] not in seen_files or h["score"] > seen_files[h["file"]]:
                seen_files[h["file"]] = h["score"]
        for fname, score in sorted(seen_files.items(), key=lambda x: -x[1]):
            print(f"  {score:.4f}  {fname}")

        # ── Step 3: Direct match? ─────────────────────────────────────────
        if hits[0]["score"] >= config.DIRECT_MATCH_THRESHOLD:
            best = hits[0]
            print("\n" + "=" * 60)
            print(f"🎯  Direct match!  Your file is:  {best['file']}")
            print(f"    (score {best['score']:.4f})")
            print(f"\n    Matching excerpt:\n    {best['chunk'][:300]}")
            print("=" * 60)
            continue

        # ── Step 4: Cluster the neighbours ────────────────────────────────
        unique_files = list({pt["file"] for pt in hits})
        print(f"\nNo direct match — narrowing down across {len(unique_files)} file(s).")
        print("Starting cluster‑based search …\n")

        run_search(hits, dense_model)


if __name__ == "__main__":
    main()
