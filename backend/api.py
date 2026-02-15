"""
api.py – FastAPI server for the Reconstructive‑Memory File Finder.

Exposes a stateful, session‑based API so a frontend can drive the
entire search → cluster → pick / follow‑up → result flow over HTTP.

Endpoints
─────────
POST /search               Start a new search session
GET  /session/{id}         Get current session state (clusters, files, …)
POST /session/{id}/pick    Pick a cluster to narrow down
POST /session/{id}/help    User is stuck → LLM asks a follow‑up question
POST /session/{id}/answer  Answer a follow‑up question → filter
GET  /collection/stats     Collection metadata
GET  /health               Health check
GET  /categories           Brain‑node category tree for the 3D viz
GET  /categories/{id}/data Images & files for a specific category
GET  /query-options        Available query actions
GET  /files/recent         Recently indexed files
GET  /files/timeline       Files organised by date
GET  /files/thumbnail      Serve an image thumbnail
GET  /files/download       Download / serve a file from the data folder
"""

from __future__ import annotations

import os
import re
import uuid
import time
import math
import logging
import mimetypes
from pathlib import Path
from collections import Counter, defaultdict
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import ollama
from sentence_transformers import SentenceTransformer
from fastembed import SparseTextEmbedding
from qdrant_client import QdrantClient

import config
from search import (
    expand_query,
    search_by_query,
    cluster_vectors,
    _aggregate_cluster_text,
    _cluster_files,
    label_clusters,
    _build_file_summaries,
    _ask_followup_question,
    _filter_by_followup,
    MAX_FOLLOWUP_QUESTIONS,
)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
log = logging.getLogger("api")


# ── Globals loaded once at startup ────────────────────────────────────────────
qdrant: QdrantClient = None  # type: ignore[assignment]
dense_model: SentenceTransformer = None  # type: ignore[assignment]
sparse_model: SparseTextEmbedding = None  # type: ignore[assignment]

# In‑memory session store  (session_id → Session)
sessions: dict[str, Session] = {}


# ── Session state ─────────────────────────────────────────────────────────────

class Session:
    """Tracks every piece of state for one search conversation."""

    def __init__(
        self,
        session_id: str,
        query: str,
        expanded_query: str,
        hits: list[dict],
    ):
        self.id = session_id
        self.query = query
        self.expanded_query = expanded_query
        self.created_at = time.time()

        # working set of points (narrows each round)
        self.points: list[dict] = hits

        # cluster state (populated after each cluster round)
        self.labels: np.ndarray | None = None
        self.cluster_labels: dict[int, str] = {}
        self.cluster_files: dict[int, list[str]] = {}
        self.cluster_sizes: dict[int, int] = {}
        self.cluster_presentation: str = ""

        # follow‑up Q&A state
        self.conversation: list[dict] = []     # [{"q": …, "a": …}, …]
        self.pending_question: str | None = None
        self.followup_count: int = 0

        # result
        self.found_file: str | None = None
        self.round: int = 0
        self.status: str = "created"  # created | clusters | followup | found | exhausted

        # ── navigation tree (for the graph) ──────────────────────────────
        # Each entry: {nodeId, label, depth, parentNodeId, round, isOnPath}
        self.nav_tree: list[dict] = []
        self.current_nav_node: str | None = None   # nodeId of active position
        # snapshots[round] = (points_copy, conversation_copy, followup_count)
        self.snapshots: dict[int, tuple] = {}
        self._nav_node_counter: int = 0

    # ── helpers ───────────────────────────────────────────────────────────

    def unique_files(self) -> list[str]:
        return sorted({pt["file"] for pt in self.points})

    def file_scores(self) -> dict[str, float]:
        best: dict[str, float] = {}
        for pt in self.points:
            score = pt.get("score", 0.0)
            if pt["file"] not in best or score > best[pt["file"]]:
                best[pt["file"]] = score
        return dict(sorted(best.items(), key=lambda x: -x[1]))

    def do_cluster(self) -> None:
        """Run HDBSCAN on current points, label via LLM, update state."""
        self.round += 1
        # snapshot *before* narrowing so we can backtrack
        self.snapshots[self.round] = (
            [dict(pt) for pt in self.points],
            list(self.conversation),
            self.followup_count,
        )

        vectors = np.array([pt["vector"] for pt in self.points])
        self.labels = cluster_vectors(vectors)

        cluster_texts = _aggregate_cluster_text(self.points, self.labels)
        self.cluster_files = _cluster_files(self.points, self.labels)
        self.cluster_sizes = Counter(int(l) for l in self.labels if l != -1)

        if not cluster_texts:
            # clustering failed → switch to follow‑up mode
            self.status = "followup"
            self._generate_followup()
            return

        self.cluster_labels = label_clusters(cluster_texts)
        self.status = "clusters"

        # ── update nav tree ───────────────────────────────────────────
        parent_id = self.current_nav_node
        for cid in sorted(self.cluster_labels):
            self._nav_node_counter += 1
            node_id = f"c{cid}-r{self.round}"
            self.nav_tree.append({
                "nodeId":       node_id,
                "label":        self.cluster_labels[cid],
                "depth":        self.round,
                "parentNodeId": parent_id,
                "round":        self.round,
                "clusterId":    int(cid),
                "isOnPath":     False,
            })

    def pick_cluster(self, cluster_id: int) -> None:
        """Narrow to the chosen cluster."""
        if self.labels is None:
            raise ValueError("No clusters to pick from")

        # Mark chosen node in nav tree as on-path
        chosen_node_id = f"c{cluster_id}-r{self.round}"
        for entry in self.nav_tree:
            if entry["nodeId"] == chosen_node_id:
                entry["isOnPath"] = True
                self.current_nav_node = chosen_node_id
                break

        self.points = [
            pt for pt, lbl in zip(self.points, self.labels)
            if lbl == cluster_id
        ]
        self._check_termination_or_recluster()

    def start_followup(self) -> None:
        """User pressed '?' — switch to guided Q&A."""
        self.status = "followup"
        self._generate_followup()

    def answer_followup(self, answer: str) -> None:
        """Process a follow‑up answer → semantic filter → maybe recluster."""
        if not self.pending_question:
            raise ValueError("No pending question")

        self.conversation.append({"q": self.pending_question, "a": answer})
        self.pending_question = None

        self.points = _filter_by_followup(
            self.points, self.conversation, dense_model,
        )
        self.followup_count += 1

        files = self.unique_files()
        if len(files) == 1:
            self.found_file = files[0]
            self.status = "found"
        elif self.followup_count >= MAX_FOLLOWUP_QUESTIONS:
            self._check_termination_or_recluster()
        elif len(files) <= 3:
            self._check_termination_or_recluster()
        else:
            self._generate_followup()

    def backtrack(self, target_node_id: str) -> None:
        """Backtrack to a previous node in the nav tree, restoring state."""
        # Find the target node
        target = None
        for entry in self.nav_tree:
            if entry["nodeId"] == target_node_id:
                target = entry
                break
        if not target:
            raise ValueError(f"Node {target_node_id} not found in nav tree")

        target_round = target["round"]
        target_cluster_id = target.get("clusterId")

        # Restore snapshot from that round
        if target_round not in self.snapshots:
            raise ValueError(f"No snapshot for round {target_round}")

        saved_points, saved_conv, saved_fcount = self.snapshots[target_round]
        self.points = [dict(pt) for pt in saved_points]
        self.conversation = list(saved_conv)
        self.followup_count = saved_fcount
        self.found_file = None
        self.pending_question = None

        # Prune nav tree: remove all nodes deeper than target_round
        # and also remove sibling branches that were from the same round
        # but keep the target node's siblings (they're alternatives)
        self.nav_tree = [
            entry for entry in self.nav_tree
            if entry["round"] <= target_round
        ]

        # Mark the target as on-path, unmark its siblings
        for entry in self.nav_tree:
            if entry["round"] == target_round and entry["parentNodeId"] == target["parentNodeId"]:
                entry["isOnPath"] = (entry["nodeId"] == target_node_id)

        self.current_nav_node = target_node_id

        # Remove snapshots for rounds after this
        for r in list(self.snapshots.keys()):
            if r > target_round:
                del self.snapshots[r]

        # Now narrow to the chosen cluster and re-cluster
        if target_cluster_id is not None:
            # Re-run clustering to get labels for this snapshot
            self.round = target_round - 1  # will be incremented in do_cluster
            vectors = np.array([pt["vector"] for pt in self.points])
            self.labels = cluster_vectors(vectors)

            # Narrow to the chosen cluster
            self.points = [
                pt for pt, lbl in zip(self.points, self.labels)
                if lbl == target_cluster_id
            ]
            self._check_termination_or_recluster()
        else:
            # Root node: re-cluster from scratch
            self.round = 0
            self.do_cluster()

    # ── internal ──────────────────────────────────────────────────────────

    def _generate_followup(self) -> None:
        file_summaries = _build_file_summaries(self.points)
        q = _ask_followup_question(
            file_summaries, self.conversation, self.followup_count + 1,
        )
        self.pending_question = q
        self.status = "followup"

    def _check_termination_or_recluster(self) -> None:
        files = self.unique_files()
        if len(files) == 1:
            self.found_file = files[0]
            self.status = "found"
        elif len(self.points) < 3:
            self.status = "exhausted"
        else:
            self.do_cluster()

    def to_dict(self) -> dict:
        """Serialise session state for the API response (no vectors)."""
        base = {
            "session_id": self.id,
            "status": self.status,
            "round": self.round,
            "query": self.query,
            "expanded_query": self.expanded_query,
            "total_chunks": len(self.points),
            "files": self.unique_files(),
            "file_scores": self.file_scores(),
        }

        if self.status == "clusters":
            base["clusters"] = [
                {
                    "id": int(cid),
                    "label": self.cluster_labels.get(cid, f"Cluster {cid}"),
                    "files": self.cluster_files.get(cid, []),
                    "size": int(self.cluster_sizes.get(cid, 0)),
                }
                for cid in sorted(self.cluster_labels)
            ]

        if self.status == "followup":
            base["pending_question"] = self.pending_question
            base["followup_count"] = self.followup_count
            base["max_followups"] = MAX_FOLLOWUP_QUESTIONS

        if self.status == "found":
            base["found_file"] = self.found_file

        if self.status == "exhausted":
            base["remaining_files"] = self.unique_files()

        base["conversation"] = self.conversation
        base["nav_tree"] = self.nav_tree
        base["current_nav_node"] = self.current_nav_node
        return base


# ── Pydantic request / response models ───────────────────────────────────────

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="What the user is looking for")

class PickRequest(BaseModel):
    cluster_id: int = Field(..., description="The cluster ID the user chose")

class AnswerRequest(BaseModel):
    answer: str = Field(..., min_length=1, description="User's answer to the follow‑up question")

class BacktrackRequest(BaseModel):
    node_id: str = Field(..., description="The nav-tree nodeId to backtrack to")


# ── App lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global qdrant, dense_model, sparse_model

    log.info("Loading Qdrant client …")
    qdrant = QdrantClient(url=config.QDRANT_URL, api_key=config.QDRANT_API_KEY)

    log.info("Loading dense model '%s' …", config.EMBEDDING_MODEL)
    dense_model = SentenceTransformer(config.EMBEDDING_MODEL)

    log.info("Loading sparse model '%s' …", config.SPARSE_MODEL)
    sparse_model = SparseTextEmbedding(model_name=config.SPARSE_MODEL)

    log.info("API ready.")
    yield
    log.info("Shutting down.")


app = FastAPI(
    title="Reconstructive‑Memory File Finder",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/collection/stats")
async def collection_stats():
    """Return collection metadata."""
    existing = [c.name for c in qdrant.get_collections().collections]
    if config.COLLECTION_NAME not in existing:
        raise HTTPException(404, f"Collection '{config.COLLECTION_NAME}' not found")

    info = qdrant.get_collection(config.COLLECTION_NAME)
    return {
        "collection": config.COLLECTION_NAME,
        "points_count": info.points_count,
        "vectors_count": info.vectors_count,
        "status": str(info.status),
    }


# ── Helper: build file metadata from Qdrant payloads ─────────────────────────

def _scan_all_files() -> list[dict]:
    """
    Scroll every point in the collection and derive per‑file metadata.
    Returns a list of dicts:
        { "file": str, "chunk_count": int, "chunk_types": set, "summary": str|None }
    """
    file_info: dict[str, dict] = {}
    offset = None
    while True:
        results, offset = qdrant.scroll(
            collection_name=config.COLLECTION_NAME,
            limit=256,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for pt in results:
            fname = pt.payload.get("file", "unknown")
            ctype = pt.payload.get("chunk_type", "content")
            chunk = pt.payload.get("chunk", "")

            if fname not in file_info:
                file_info[fname] = {
                    "file": fname,
                    "chunk_count": 0,
                    "chunk_types": set(),
                    "summary": None,
                    "title": None,
                }
            file_info[fname]["chunk_count"] += 1
            file_info[fname]["chunk_types"].add(ctype)

            if ctype == "summary" and not file_info[fname]["summary"]:
                file_info[fname]["summary"] = chunk
            if ctype == "title" and not file_info[fname]["title"]:
                file_info[fname]["title"] = chunk
        if offset is None:
            break

    return list(file_info.values())


def _file_size_str(path: str) -> str:
    """Human‑readable file size."""
    try:
        size = os.path.getsize(path)
    except OSError:
        return "—"
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def _file_mod_date(path: str) -> str:
    """ISO date of last modification."""
    try:
        return time.strftime("%Y-%m-%d", time.localtime(os.path.getmtime(path)))
    except OSError:
        return "unknown"


def _is_image(filename: str) -> bool:
    """Check if a filename looks like an image."""
    return filename.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"))


# ── Categories endpoint (brain nodes) ────────────────────────────────────────

def _build_categories_from_files(files_meta: list[dict]) -> list[dict]:
    """
    Build a brain‑node tree from the indexed files so the 3D visualisation
    works with real data.

    Strategy:
    • Root node = "Memory" (id 1)
    • Group files by first word of their title → level‑1 category nodes
    • Each file becomes a leaf node under its category
    • Positions are assigned on a sphere using a golden‑ratio spiral
    """
    if not files_meta:
        return [{"id": 1, "name": "Memory", "x": 0, "y": 3.5, "z": 0,
                 "dataCount": 0, "children": [], "date": time.strftime("%Y-%m-%d")}]

    # Group files by the first word of their friendly title (or first 2 words)
    groups: dict[str, list[dict]] = defaultdict(list)
    for fm in files_meta:
        title = fm.get("title") or fm["file"]
        words = title.split()
        # Use first word as group key; if only 1 word, use it
        group_key = words[0].title() if words else "Other"
        groups[group_key].append(fm)

    # If there are too many groups (>8), merge small ones into "Other"
    if len(groups) > 8:
        sorted_groups = sorted(groups.items(), key=lambda x: -len(x[1]))
        main_groups = dict(sorted_groups[:7])
        other_files = []
        for _, flist in sorted_groups[7:]:
            other_files.extend(flist)
        if other_files:
            main_groups["Other"] = other_files
        groups = main_groups

    categories = []
    node_id = 1

    # Root
    group_ids = []
    root = {
        "id": node_id,
        "name": "Memory",
        "x": 0, "y": 3.5, "z": 0,
        "dataCount": sum(fm["chunk_count"] for fm in files_meta),
        "children": [],  # filled below
        "date": time.strftime("%Y-%m-%d"),
    }
    categories.append(root)
    node_id += 1

    # Level‑1: one node per group
    group_keys = sorted(groups.keys())
    n_groups = len(group_keys)
    for gi, gkey in enumerate(group_keys):
        angle = (2 * math.pi * gi) / max(n_groups, 1)
        gx = 4 * math.cos(angle)
        gz = 4 * math.sin(angle)

        group_node_id = node_id
        group_ids.append(group_node_id)
        child_ids = []
        node_id += 1

        # Level‑2: one node per file in the group
        file_list = groups[gkey]
        for fi, fm in enumerate(file_list):
            file_angle = angle + (0.4 * (fi - len(file_list) / 2))
            fx = gx + 2 * math.cos(file_angle)
            fz = gz + 2 * math.sin(file_angle)

            friendly = fm.get("title") or os.path.splitext(fm["file"])[0]
            categories.append({
                "id": node_id,
                "name": friendly,
                "x": round(fx, 2),
                "y": round(-0.5 - 0.3 * fi, 2),
                "z": round(fz, 2),
                "dataCount": fm["chunk_count"],
                "children": [],
                "date": _file_mod_date(os.path.join(config.DATA_DIR, fm["file"])),
                "_file": fm["file"],  # internal: maps node→file
            })
            child_ids.append(node_id)
            node_id += 1

        categories.append({
            "id": group_node_id,
            "name": gkey,
            "x": round(gx, 2),
            "y": 2.0,
            "z": round(gz, 2),
            "dataCount": sum(f["chunk_count"] for f in file_list),
            "children": child_ids,
            "date": time.strftime("%Y-%m-%d"),
        })

    root["children"] = group_ids
    # Sort by id so the root is first
    categories.sort(key=lambda c: c["id"])
    return categories


# In‑memory cache for categories so we don't re‑scan on every request
_categories_cache: dict[str, object] = {"data": None, "ts": 0}
_CACHE_TTL = 30  # seconds


def _get_categories() -> list[dict]:
    now = time.time()
    if _categories_cache["data"] and (now - _categories_cache["ts"]) < _CACHE_TTL:
        return _categories_cache["data"]

    files_meta = _scan_all_files()
    cats = _build_categories_from_files(files_meta)
    _categories_cache["data"] = cats
    _categories_cache["ts"] = now
    return cats


@app.get("/categories")
async def get_categories():
    """
    Return the brain‑node category tree for the 3D visualisation.
    Built dynamically from whatever files are currently indexed in Qdrant.
    """
    cats = _get_categories()
    # Strip internal _file key before sending to the frontend
    return [
        {k: v for k, v in cat.items() if not k.startswith("_")}
        for cat in cats
    ]


@app.get("/categories/{category_id}/data")
async def get_category_data(category_id: int):
    """
    Return images and files belonging to a specific brain node.
    Leaf nodes map to a single file; group nodes aggregate their children.
    """
    cats = _get_categories()
    cat = next((c for c in cats if c["id"] == category_id), None)
    if not cat:
        raise HTTPException(404, f"Category {category_id} not found")

    # Collect all file names reachable from this node
    def _collect_files(node_id: int) -> list[str]:
        node = next((c for c in cats if c["id"] == node_id), None)
        if not node:
            return []
        # If this node has a _file key, it's a leaf → return it
        if "_file" in node:
            return [node["_file"]]
        # Otherwise recurse into children
        result = []
        for child_id in node.get("children", []):
            result.extend(_collect_files(child_id))
        return result

    file_names = list(set(_collect_files(category_id)))

    images = []
    files = []
    data_dir = Path(config.DATA_DIR)

    for i, fname in enumerate(sorted(file_names)):
        fpath = data_dir / fname
        fsize = _file_size_str(str(fpath))
        fdate = _file_mod_date(str(fpath))
        ext = os.path.splitext(fname)[1].lstrip(".")

        if _is_image(fname):
            images.append({
                "id": f"img-{category_id}-{i}",
                "thumbnail": f"/files/thumbnail?path={fname}",
                "name": fname,
                "date": fdate,
            })
        else:
            files.append({
                "id": f"file-{category_id}-{i}",
                "name": fname,
                "type": ext or "file",
                "size": fsize,
                "date": fdate,
            })

    # If no images were found among the actual files, but we have PDFs,
    # still list them under "files"
    return {"images": images, "files": files}


# ── Query options ─────────────────────────────────────────────────────────────

@app.get("/query-options")
async def get_query_options():
    """Return the list of query actions for the QueryInterface."""
    return [
        {"id": "recent", "label": "Show recent memories",   "icon": "🕐"},
        {"id": "search", "label": "Search specific content", "icon": "🔍"},
    ]


# ── File serving ──────────────────────────────────────────────────────────────

@app.get("/files/thumbnail")
async def file_thumbnail(path: str = Query(..., description="File name relative to DATA_DIR")):
    """Serve a file as a thumbnail / preview image."""
    safe_name = os.path.basename(path)  # prevent directory traversal
    full_path = os.path.join(config.DATA_DIR, safe_name)
    if not os.path.isfile(full_path):
        raise HTTPException(404, f"File not found: {safe_name}")
    media_type = mimetypes.guess_type(full_path)[0] or "application/octet-stream"
    return FileResponse(full_path, media_type=media_type)


@app.get("/files/download")
async def file_download(path: str = Query(..., description="File name relative to DATA_DIR")):
    """Download / serve a file from the watched data folder."""
    safe_name = os.path.basename(path)
    full_path = os.path.join(config.DATA_DIR, safe_name)
    if not os.path.isfile(full_path):
        raise HTTPException(404, f"File not found: {safe_name}")
    media_type = mimetypes.guess_type(full_path)[0] or "application/octet-stream"
    return FileResponse(
        full_path,
        media_type=media_type,
        filename=safe_name,
    )


@app.get("/files/preview")
async def file_preview(path: str = Query(..., description="File name relative to DATA_DIR")):
    """Serve a file inline (no download) — used for PDF preview in the browser."""
    safe_name = os.path.basename(path)
    full_path = os.path.join(config.DATA_DIR, safe_name)
    if not os.path.isfile(full_path):
        raise HTTPException(404, f"File not found: {safe_name}")
    media_type = mimetypes.guess_type(full_path)[0] or "application/octet-stream"
    return FileResponse(full_path, media_type=media_type)


@app.get("/files/recent")
async def recent_files(limit: int = Query(20, ge=1, le=100)):
    """
    Return the most recently modified files in the data folder,
    cross‑referenced with what's indexed in Qdrant.
    """
    files_meta = _scan_all_files()
    data_dir = Path(config.DATA_DIR)

    enriched = []
    for fm in files_meta:
        fpath = data_dir / fm["file"]
        enriched.append({
            "id": f"recent-{fm['file']}",
            "name": fm["file"],
            "type": os.path.splitext(fm["file"])[1].lstrip(".") or "file",
            "size": _file_size_str(str(fpath)),
            "date": _file_mod_date(str(fpath)),
            "summary": fm.get("summary"),
            "chunk_count": fm["chunk_count"],
            "is_image": _is_image(fm["file"]),
        })

    # Sort by date descending
    enriched.sort(key=lambda x: x["date"], reverse=True)
    return enriched[:limit]


@app.get("/files/timeline")
async def files_timeline():
    """
    Return files organised by month for a timeline view.
    """
    files_meta = _scan_all_files()
    data_dir = Path(config.DATA_DIR)

    by_month: dict[str, list] = defaultdict(list)
    for fm in files_meta:
        fpath = data_dir / fm["file"]
        date = _file_mod_date(str(fpath))
        month_key = date[:7] if date != "unknown" else "unknown"  # "YYYY-MM"
        by_month[month_key].append({
            "id": f"tl-{fm['file']}",
            "name": fm["file"],
            "type": os.path.splitext(fm["file"])[1].lstrip(".") or "file",
            "size": _file_size_str(str(fpath)),
            "date": date,
            "summary": fm.get("summary"),
        })

    # Build sorted list of months
    timeline = []
    for month in sorted(by_month.keys(), reverse=True):
        timeline.append({
            "month": month,
            "files": sorted(by_month[month], key=lambda x: x["date"], reverse=True),
        })
    return timeline


# ── Invalidate categories cache when data changes ────────────────────────────

@app.post("/cache/invalidate")
async def invalidate_cache():
    """Force‑refresh the categories cache (e.g. after new files are ingested)."""
    _categories_cache["data"] = None
    _categories_cache["ts"] = 0
    return {"status": "cache invalidated"}


@app.post("/search")
async def start_search(req: SearchRequest):
    """
    Start a new search session.

    1. Expand query via LLM
    2. Hybrid search (dense + BM25, RRF fusion)
    3. Check for direct match
    4. If no direct match → cluster → return session with clusters
    """
    # Expand
    expanded = expand_query(req.query)

    # Search
    hits = search_by_query(qdrant, dense_model, sparse_model, expanded)
    if not hits:
        raise HTTPException(404, "No results found for your query.")

    session_id = uuid.uuid4().hex[:12]
    session = Session(
        session_id=session_id,
        query=req.query,
        expanded_query=expanded,
        hits=hits,
    )

    # Initialise nav tree with root node (the user query)
    root_node_id = "root"
    session.nav_tree.append({
        "nodeId":       root_node_id,
        "label":        req.query,
        "depth":        0,
        "parentNodeId": None,
        "round":        0,
        "clusterId":    None,
        "isOnPath":     True,
    })
    session.current_nav_node = root_node_id

    # Direct match?
    if hits[0]["score"] >= config.DIRECT_MATCH_THRESHOLD:
        session.found_file = hits[0]["file"]
        session.status = "found"
    else:
        # Cluster
        session.do_cluster()

    sessions[session_id] = session
    return session.to_dict()


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Return current state of a session."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session.to_dict()


@app.post("/session/{session_id}/pick")
async def pick_cluster(session_id: str, req: PickRequest):
    """User picked a cluster → narrow down and re‑cluster."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status != "clusters":
        raise HTTPException(400, f"Session is in '{session.status}' state, not 'clusters'")
    if req.cluster_id not in session.cluster_labels:
        raise HTTPException(
            400,
            f"Invalid cluster_id {req.cluster_id}. "
            f"Valid: {sorted(session.cluster_labels.keys())}",
        )

    session.pick_cluster(req.cluster_id)
    return session.to_dict()


@app.post("/session/{session_id}/help")
async def ask_for_help(session_id: str):
    """
    User is stuck → generate a follow‑up question.
    Switches session to 'followup' status.
    """
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status not in ("clusters", "followup"):
        raise HTTPException(400, f"Cannot ask for help in '{session.status}' state")
    if session.followup_count >= MAX_FOLLOWUP_QUESTIONS:
        raise HTTPException(400, "Maximum follow‑up questions reached")

    session.start_followup()
    return session.to_dict()


@app.post("/session/{session_id}/answer")
async def answer_followup(session_id: str, req: AnswerRequest):
    """
    User answered a follow‑up question → semantically filter
    candidates and either ask another question or re‑cluster.
    """
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status != "followup":
        raise HTTPException(400, f"No pending question (status='{session.status}')")

    session.answer_followup(req.answer)
    return session.to_dict()


@app.post("/session/{session_id}/backtrack")
async def backtrack_session(session_id: str, req: BacktrackRequest):
    """Backtrack to a previous node in the search navigation tree."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    try:
        session.backtrack(req.node_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return session.to_dict()


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Clean up a session."""
    if session_id in sessions:
        del sessions[session_id]
    return {"deleted": session_id}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8111, reload=True)
