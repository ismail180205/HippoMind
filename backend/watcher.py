"""
watcher.py – Continuously watches ./data for new PDF files,
extracts text, chunks it, embeds (dense + sparse), and pushes to Qdrant.

For each PDF the watcher creates THREE kinds of chunks:
  • "title"   – the filename (sans extension), giving filename‑level signal
  • "summary" – an LLM‑generated summary of the whole document
  • "content" – the regular text chunks

Every point carries both a dense (BGE‑large) and a sparse (BM25) vector
stored under named vector keys.
"""

import os
import re
import sys
import time
import hashlib
import logging

import pdfplumber
import ollama
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from fastembed import SparseTextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    SparseVectorParams,
    SparseVector,
    PointStruct,
    PayloadSchemaType,
    NamedVector,
    NamedSparseVector,
)

import config

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
log = logging.getLogger("watcher")

# ── Globals ───────────────────────────────────────────────────────────────────
_processed_files: set[str] = set()  # tracks files already ingested


# ── Helpers ───────────────────────────────────────────────────────────────────

def _file_hash(path: str) -> str:
    """Return a hex‑digest SHA‑256 hash of the file contents."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _extract_text(pdf_path: str) -> str:
    """Extract all text from a PDF via pdfplumber."""
    pages: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            txt = page.extract_text(x_tolerance=1, y_tolerance=1)
            if txt:
                pages.append(txt)
    return "\n".join(pages)


def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
        length_function=len,
        is_separator_regex=False,
    )
    return splitter.split_text(text)


def _friendly_title(filename: str) -> str:
    """
    Turn 'Somalia_Flood_Exposure-Methodology_Note.pdf'
    into  'Somalia Flood Exposure Methodology Note'.
    """
    stem = os.path.splitext(filename)[0]
    return re.sub(r"[_\-]+", " ", stem).strip()


def _llm_summary(text: str) -> str:
    """Ask the local Ollama model for a 2‑3 sentence summary."""
    client = ollama.Client(host=config.OLLAMA_BASE_URL)
    truncated = text[:6000]  # keep prompt manageable
    prompt = (
        "Summarise the following document in 2‑3 sentences. "
        "Focus on the main topic, geography, and methodology if applicable. "
        "Return ONLY the summary.\n\n"
        f"{truncated}"
    )
    try:
        resp = client.chat(
            model=config.OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp["message"]["content"].strip()
    except Exception as e:
        log.warning("LLM summary failed: %s – using first 500 chars instead.", e)
        return text[:500]


def _sparse_embed(sparse_model: SparseTextEmbedding, texts: list[str]) -> list[SparseVector]:
    """Compute BM25 sparse embeddings for a list of texts."""
    results = list(sparse_model.embed(texts))
    return [
        SparseVector(
            indices=r.indices.tolist(),
            values=r.values.tolist(),
        )
        for r in results
    ]


def _ensure_collection(client: QdrantClient) -> None:
    """Create the Qdrant collection with named dense + sparse vectors."""
    existing = [c.name for c in client.get_collections().collections]
    if config.COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=config.COLLECTION_NAME,
            vectors_config={
                config.DENSE_VECTOR_NAME: VectorParams(
                    size=config.EMBEDDING_DIM,
                    distance=Distance.COSINE,
                ),
            },
            sparse_vectors_config={
                config.SPARSE_VECTOR_NAME: SparseVectorParams(),
            },
        )
        # Create payload field indexes
        for field, schema in [
            ("chunk", PayloadSchemaType.TEXT),
            ("file", PayloadSchemaType.KEYWORD),
            ("file_hash", PayloadSchemaType.KEYWORD),
            ("chunk_type", PayloadSchemaType.KEYWORD),
        ]:
            client.create_payload_index(
                collection_name=config.COLLECTION_NAME,
                field_name=field,
                field_schema=schema,
            )
        log.info(
            "Created collection '%s' (dense %d‑d + sparse BM25, payload indexes)",
            config.COLLECTION_NAME, config.EMBEDDING_DIM,
        )
    else:
        log.info("Collection '%s' already exists", config.COLLECTION_NAME)


def _next_id(client: QdrantClient) -> int:
    """Return the next integer point‑id (max existing + 1)."""
    info = client.get_collection(config.COLLECTION_NAME)
    return info.points_count


def _ingest_pdf(
    pdf_path: str,
    client: QdrantClient,
    dense_model: SentenceTransformer,
    sparse_model: SparseTextEmbedding,
) -> int:
    """
    Extract → chunk → embed (dense + sparse) → upsert one PDF.
    Creates title, summary, and content chunks.
    Returns total number of vectors inserted.
    """
    filename = os.path.basename(pdf_path)
    fhash = _file_hash(pdf_path)
    log.info("Processing '%s' …", filename)

    text = _extract_text(pdf_path)
    if not text.strip():
        log.warning("  No text extracted – skipping.")
        return 0

    # ── Build the three kinds of chunks ───────────────────────────────────
    title_text = _friendly_title(filename)

    log.info("  Generating LLM summary …")
    summary_text = _llm_summary(text)

    content_chunks = _chunk_text(text)
    log.info("  %d content chunks + 1 title + 1 summary", len(content_chunks))

    # Combine all texts for batch embedding
    all_texts = [title_text, summary_text] + content_chunks
    chunk_types = ["title", "summary"] + ["content"] * len(content_chunks)

    # ── Dense embeddings ──────────────────────────────────────────────────
    dense_vecs = dense_model.encode(all_texts, show_progress_bar=False).tolist()

    # ── Sparse embeddings (BM25) ──────────────────────────────────────────
    sparse_vecs = _sparse_embed(sparse_model, all_texts)

    # ── Build points ──────────────────────────────────────────────────────
    start_id = _next_id(client)
    points = []
    for i, (txt, ctype, dvec, svec) in enumerate(
        zip(all_texts, chunk_types, dense_vecs, sparse_vecs)
    ):
        points.append(
            PointStruct(
                id=start_id + i,
                vector={
                    config.DENSE_VECTOR_NAME: dvec,
                    config.SPARSE_VECTOR_NAME: svec,
                },
                payload={
                    "chunk": txt,
                    "file": filename,
                    "file_hash": fhash,
                    "chunk_type": ctype,
                },
            )
        )

    client.upsert(
        collection_name=config.COLLECTION_NAME,
        points=points,
    )
    log.info("  Upserted %d vectors (dense + sparse).", len(points))
    return len(points)


def _load_already_ingested(client: QdrantClient) -> set[str]:
    """
    Scroll through existing points and collect file names
    that have already been ingested, so we don't re‑process
    them on restart.
    """
    ingested: set[str] = set()
    offset = None
    while True:
        results, offset = client.scroll(
            collection_name=config.COLLECTION_NAME,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for pt in results:
            if pt.payload and "file" in pt.payload:
                ingested.add(pt.payload["file"])
        if offset is None:
            break
    return ingested


# ── Main loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    # Qdrant client
    client = QdrantClient(
        url=config.QDRANT_URL,
        api_key=config.QDRANT_API_KEY,
    )
    _ensure_collection(client)

    # Dense embedding model
    log.info("Loading dense model '%s' …", config.EMBEDDING_MODEL)
    dense_model = SentenceTransformer(config.EMBEDDING_MODEL)

    # Sparse BM25 model (fastembed)
    log.info("Loading sparse model '%s' …", config.SPARSE_MODEL)
    sparse_model = SparseTextEmbedding(model_name=config.SPARSE_MODEL)

    # Make sure the watched folder exists
    os.makedirs(config.DATA_DIR, exist_ok=True)

    # Load files already in Qdrant so we skip them after a restart
    _processed_files.update(_load_already_ingested(client))
    if _processed_files:
        log.info("Already ingested: %s", _processed_files)

    log.info("Watching '%s' for new PDF files …  (Ctrl+C to stop)", config.DATA_DIR)

    try:
        while True:
            for fname in os.listdir(config.DATA_DIR):
                if not fname.lower().endswith(".pdf"):
                    continue
                if fname in _processed_files:
                    continue

                pdf_path = os.path.join(config.DATA_DIR, fname)
                # Wait for the file to finish copying (simple size‑stability check)
                prev_size = -1
                while True:
                    curr_size = os.path.getsize(pdf_path)
                    if curr_size == prev_size:
                        break
                    prev_size = curr_size
                    time.sleep(0.5)

                try:
                    _ingest_pdf(pdf_path, client, dense_model, sparse_model)
                    _processed_files.add(fname)
                except Exception:
                    log.exception("  Failed to ingest '%s'", fname)

            time.sleep(config.WATCH_INTERVAL)

    except KeyboardInterrupt:
        log.info("Watcher stopped.")
        sys.exit(0)


if __name__ == "__main__":
    main()
