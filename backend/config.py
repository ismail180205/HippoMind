import os
from dotenv import load_dotenv

load_dotenv()

# ── Qdrant (remote / Qdrant Cloud) ───────────────────────────────────────────
QDRANT_URL = os.getenv("QDRANT_URL")           # e.g. https://xyz.cloud.qdrant.io:6333
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")    # required for remote clusters
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "ai_minds_docs")

if not QDRANT_URL:
    raise RuntimeError(
        "QDRANT_URL is not set. "
        "Export it to point to your remote Qdrant instance, e.g.:\n"
        "  export QDRANT_URL='https://xyz.us-east4-0.gcp.cloud.qdrant.io:6333'"
    )
if not QDRANT_API_KEY:
    raise RuntimeError(
        "QDRANT_API_KEY is not set. "
        "Export the API key for your remote Qdrant cluster, e.g.:\n"
        "  export QDRANT_API_KEY='your-api-key-here'"
    )

# ── Dense embedding model ────────────────────────────────────────────────────
EMBEDDING_MODEL = "BAAI/bge-large-en-v1.5"
EMBEDDING_DIM = 1024

# ── Sparse (BM25) embedding model ───────────────────────────────────────────
SPARSE_MODEL = "Qdrant/bm25"

# ── Named vector keys ────────────────────────────────────────────────────────
DENSE_VECTOR_NAME = "dense"
SPARSE_VECTOR_NAME = "sparse"

# ── Chunking ─────────────────────────────────────────────────────────────────
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# ── Watched folder ───────────────────────────────────────────────────────────
DATA_DIR = os.getenv("DATA_DIR", "./data")

# ── Watcher polling interval (seconds) ───────────────────────────────────────
WATCH_INTERVAL = 2

# ── Ollama LLM ────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b-it-qat")

# ── Clustering ───────────────────────────────────────────────────────────────
HDBSCAN_MIN_CLUSTER_SIZE = 5
MAX_CLUSTERS = 4

# ── Search ───────────────────────────────────────────────────────────────────
DIRECT_MATCH_THRESHOLD = 0.85   # BGE‑large scores higher than MiniLM
SEARCH_SCORE_THRESHOLD = 0.5
SEARCH_TOP_K = 100

# ── Hybrid search fusion weights ─────────────────────────────────────────────
DENSE_WEIGHT = 0.7
SPARSE_WEIGHT = 0.3
