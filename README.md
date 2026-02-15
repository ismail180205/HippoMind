<p align="center">
  <img src="https://img.shields.io/badge/HippoMind-Reconstructive%20Memory-9966CC?style=for-the-badge&logo=brain&logoColor=white" alt="HippoMind" />
</p>

<h1 align="center">🧠 HippoMind</h1>

<p align="center">
  <strong>A Reconstructive-Memory File Finder powered by AI</strong><br/>
  <em>Find half-remembered files through interactive memory reconstruction — not keyword search.</em>
</p>

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick%20Start-Guide-blue?style=flat-square" /></a>
  <a href="#-architecture"><img src="https://img.shields.io/badge/Architecture-Docs-green?style=flat-square" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/Tech%20Stack-Details-orange?style=flat-square" /></a>
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Qdrant-Vector%20DB-DC382D?style=flat-square" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" />
</p>

---

## 🔮 The Problem & Our Solution

| Challenge                  | Impact                                                  | Our Solution                                                  |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| 🗂️ **Vague Recall**        | You remember _something_ about a file but not its name  | Reconstructive memory search — describe what you recall       |
| 🔗 **Hidden Connections**  | Related documents are scattered and disconnected        | Automated clustering into meaningful topic groups             |
| ❓ **Black Box Search**    | Traditional search returns ranked lists with no context | Interactive cluster exploration with LLM-generated labels     |
| 🧩 **Fragmented Memory**   | Keyword search fails when you can't recall exact terms  | LLM query expansion + hybrid dense/sparse retrieval           |
| 🧭 **No Guided Discovery** | Search is one-shot — no progressive refinement          | Multi-round narrowing with follow-up questions & backtracking |
| 🧠 **No Spatial Context**  | Files exist as flat lists with no visual structure      | 3D brain visualization mapping documents to memory nodes      |

---

## 🎬 Demo & Resources

### 🎥 How It Works

> _"I remember a document about flooding in East Africa… something about exposure methodology…"_

Instead of searching for exact keywords, HippoMind lets you **describe your memory** — then progressively narrows down candidates through interactive clustering, follow-up questions, and visual exploration until your file is found. 🎯

### 🖥️ Screenshots

#### 🧠 3D Brain Visualization

> Interactive 3D graph of memory nodes using Three.js — documents are mapped to a neural topology. Drag to rotate, click to explore, scroll to zoom.

#### 🔍 Cluster Search Interface

> When searching, documents cluster into labeled groups. Pick the group that matches your memory, and HippoMind dives deeper.

#### 📊 Navigation Tree

> A visual breadcrumb trail of your search journey — backtrack to any previous branch point and explore alternate paths.

#### 📁 Data Panel

> Left sidebar showing files, images, and metadata for the selected memory node.

---

## 🏗️ Architecture

### 📐 System Overview

HippoMind follows a two-tier architecture — a **FastAPI backend** for AI-powered search and a **React frontend** for immersive visualization:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Frontend                               │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │  DataPanel    │  │ BrainVisualization│  │  QueryInterface       │ │
│  │  (sidebar)    │  │ (Three.js 3D)    │  │  (search + clusters)  │ │
│  └──────────────┘  └──────────────────┘  └───────────────────────┘ │
│                     ┌──────────────────┐                            │
│                     │  SearchGraph     │                            │
│                     │  (nav tree SVG)  │                            │
│                     └──────────────────┘                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  REST API (HTTP)
┌──────────────────────────────▼──────────────────────────────────────┐
│                       FastAPI Backend                                │
│  ┌────────────┐  ┌────────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  api.py     │  │ search.py  │  │ config.py│  │  watcher.py    │  │
│  │  (routes)   │  │ (core AI)  │  │ (config) │  │  (PDF ingest)  │  │
│  └─────┬──────┘  └─────┬──────┘  └──────────┘  └───────┬────────┘  │
│        │               │                                │           │
│  ┌─────▼───────────────▼────────────────────────────────▼────────┐  │
│  │                    Shared Services                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │  │
│  │  │ Qdrant Cloud │  │ BGE-large    │  │  Ollama (Gemma 3)   │  │  │
│  │  │ (vectors)    │  │ (embeddings) │  │  (labelling/expand) │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 🧩 Core Components

| Component           | Technology                | Purpose                                                   |
| ------------------- | ------------------------- | --------------------------------------------------------- |
| **Frontend UI**     | React 18 + Three.js       | 3D brain visualization, search interface, navigation tree |
| **API Server**      | FastAPI + Uvicorn         | Session-based search flow, file serving, category tree    |
| **Search Engine**   | HDBSCAN + Ollama          | Hybrid retrieval, clustering, LLM labelling & follow-ups  |
| **PDF Ingestor**    | pdfplumber + LangChain    | Continuous file watcher, chunking, embedding, indexing    |
| **Vector Store**    | Qdrant Cloud              | Dense (BGE-large 1024d) + Sparse (BM25) hybrid storage    |
| **Embedding Model** | BAAI/bge-large-en-v1.5    | 1024-dim dense embeddings for semantic similarity         |
| **Sparse Model**    | Qdrant/bm25               | BM25 sparse vectors for keyword-level matching            |
| **LLM**             | Ollama (gemma3:4b-it-qat) | Query expansion, cluster labelling, follow-up questions   |

---

## ⚡ Reconstructive Memory Search: How It Works

### 🤔 The Problem with Traditional File Search

Traditional search requires you to remember **exact keywords**, filenames, or metadata. But human memory is **reconstructive** — we recall fragments, associations, and feelings, not precise strings.

> _"That PDF about… flooding? In Africa somewhere? It had a methodology section…"_

Standard search fails here. HippoMind succeeds.

### 💡 Our Solution: Interactive Memory Reconstruction

HippoMind mirrors how the **hippocampus** works — reconstructing memories through **progressive association** rather than exact lookup.

### 🔬 How It Works

```
1️⃣  User describes their memory
        ↓
2️⃣  LLM expands the vague query (adds synonyms, related terms)
        ↓
3️⃣  Hybrid search: Dense (BGE-large) + Sparse (BM25) → RRF fusion
        ↓
4️⃣  If direct match (≥85% score) → return immediately 🎯
        ↓
5️⃣  Otherwise, HDBSCAN clusters the results
        ↓
6️⃣  Ollama labels each cluster with human-readable descriptions
        ↓
7️⃣  User picks the cluster that "sounds right"
        ↓
8️⃣  Repeat (narrow → re-cluster → pick) until one file remains
        ↓
    🎯 Found!
```

### 🔄 Fallback: Follow-up Questions

When clustering can't differentiate, HippoMind switches to **guided Q&A**:

- The LLM generates memory-jogging questions based on remaining candidates
- User answers filter the candidate set semantically
- Up to 3 follow-up questions before forcing a result

### 🌳 Navigation Tree & Backtracking

Every choice creates a **navigation tree**. Users can:

- **See** their entire search journey as a branching graph
- **Backtrack** to any previous decision point
- **Explore alternative branches** without starting over

### 🧪 Example Search Flow

```
Query: "flood exposure methodology"

  🌐 Root: "flood exposure methodology"
  ├── 🟣 Cluster 0: "Somalia Flood Risk Assessment"        ← picked!
  │   ├── 🔵 Cluster 0: "Exposure Methodology Notes"       ← picked!
  │   │   └── 🎯 Found: Somalia_Flood_Exposure-Methodology_Note.pdf
  │   └── 🔵 Cluster 1: "Vulnerability Mapping Reports"
  ├── 🟣 Cluster 1: "Climate Change Impact Studies"
  └── 🟣 Cluster 2: "Humanitarian Response Plans"
```

---

## 📚 Vector Collections

| Collection         | Model                  | Dimensions   | Vectors         | Purpose                      |
| ------------------ | ---------------------- | ------------ | --------------- | ---------------------------- |
| 🔍 `ai_minds_docs` | BAAI/bge-large-en-v1.5 | 1024 (dense) | Named: `dense`  | Semantic document similarity |
| 📝 `ai_minds_docs` | Qdrant/bm25            | Sparse       | Named: `sparse` | Keyword-level BM25 matching  |

### Chunk Types per Document

Each PDF generates **three types of vectors**:

| Type      | Content                                                             | Signal                         |
| --------- | ------------------------------------------------------------------- | ------------------------------ |
| `title`   | Friendly filename (e.g., "Somalia Flood Exposure Methodology Note") | Filename-level matching        |
| `summary` | LLM-generated 2-3 sentence summary                                  | Document-level semantic signal |
| `content` | 500-char overlapping text chunks                                    | Fine-grained passage retrieval |

---

## 🛠️ Technology Stack

### 🎨 Frontend

| Technology    | Version      | Purpose                      |
| ------------- | ------------ | ---------------------------- |
| React         | ^18.2.0      | UI library                   |
| Three.js      | Custom hooks | 3D brain graph visualization |
| Lucide React  | ^0.263.1     | Icon library                 |
| React Scripts | 5.0.1        | Build toolchain (CRA)        |

### ⚙️ Backend — API Server (FastAPI)

| Technology | Version | Purpose                               |
| ---------- | ------- | ------------------------------------- |
| FastAPI    | Latest  | REST API framework with async support |
| Uvicorn    | Latest  | ASGI server                           |
| Pydantic   | v2      | Request/response validation           |
| Python     | 3.10+   | Runtime                               |

### 🔮 Search & AI Pipeline

| Technology            | Version | Purpose                                              |
| --------------------- | ------- | ---------------------------------------------------- |
| Qdrant Client         | Latest  | Vector database client                               |
| Sentence Transformers | Latest  | Dense embeddings (BGE-large-en-v1.5, 1024-dim)       |
| FastEmbed             | Latest  | Sparse BM25 embeddings                               |
| HDBSCAN               | Latest  | Density-based clustering                             |
| Ollama                | Latest  | Local LLM for query expansion, labelling, follow-ups |
| NumPy                 | Latest  | Vector operations & normalization                    |

### 📄 Document Processing

| Technology               | Version | Purpose                                         |
| ------------------------ | ------- | ----------------------------------------------- |
| pdfplumber               | Latest  | PDF text extraction                             |
| LangChain Text Splitters | Latest  | Recursive text chunking (500 chars, 50 overlap) |
| Pandas                   | Latest  | Data manipulation                               |

---

## 🚀 Quick Start

### 📋 Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm
- **Qdrant** instance (cloud or local via Docker)
- **Ollama** running locally with a model loaded
- **Groq API key** (optional, for cloud LLM)

### 📥 Installation

#### 1️⃣ Clone Repository

```bash
git clone https://github.com/ismail180205/HippoMind.git
cd HippoMind
```

#### 2️⃣ Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file:

```env
QDRANT_URL=https://your-cluster.cloud.qdrant.io:6333
QDRANT_API_KEY=your-api-key-here
QDRANT_COLLECTION=ai_minds_docs
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b-it-qat
DATA_DIR=./data
```

Start the API server:

```bash
python api.py
# → Starts on http://localhost:8111
```

Start the PDF watcher (in a separate terminal):

```bash
python watcher.py
# → Watches ./data/ for new PDFs
```

#### 3️⃣ Frontend (React)

```bash
cd frontend
npm install
npm start
# → Starts on http://localhost:3000, proxied to backend at :8111
```

#### 4️⃣ Qdrant (if running locally)

```bash
docker run -p 6333:6333 qdrant/qdrant
```

Then set `QDRANT_URL=http://localhost:6333` in your `.env`.

#### 5️⃣ Ollama (local LLM)

```bash
ollama pull gemma3:4b-it-qat
ollama serve
# → Runs on http://localhost:11434
```

### ✅ Verify Installation

```bash
# Backend API
curl http://localhost:8111/health
# → {"status": "ok"}

# Collection stats
curl http://localhost:8111/collection/stats
# → {"collection": "ai_minds_docs", "points_count": ..., ...}

# Frontend
open http://localhost:3000
```

---

## 📚 Usage Examples

### 🔬 Example 1: Ingesting Documents

Drop PDF files into the `backend/data/` folder. The watcher will automatically:

1. 📄 Extract text from each PDF via pdfplumber
2. ✂️ Chunk the text (500 chars, 50 overlap)
3. 📝 Generate an LLM summary of the document
4. 🔢 Embed with BGE-large (1024-dim dense) + BM25 (sparse)
5. 📤 Push vectors + payloads to Qdrant

### 🔍 Example 2: Searching via API

```python
import requests

# Start a search session
response = requests.post(
    "http://localhost:8111/search",
    json={"query": "flooding methodology East Africa"}
)
session = response.json()
print(f"🔍 Session: {session['session_id']}")
print(f"📊 Status: {session['status']}")
print(f"📁 Files: {len(session['files'])} candidates")

# If status is "clusters", pick one
if session['status'] == 'clusters':
    for cluster in session['clusters']:
        print(f"  🟣 [{cluster['id']}] {cluster['label']} "
              f"({cluster['size']} chunks, {len(cluster['files'])} files)")

    # Pick the most relevant cluster
    response = requests.post(
        f"http://localhost:8111/session/{session['session_id']}/pick",
        json={"cluster_id": session['clusters'][0]['id']}
    )
    updated = response.json()
    print(f"\n📊 New status: {updated['status']}")
```

**Output:**

```
🔍 Session: a3f2c9b1e8d4
📊 Status: clusters
📁 Files: 15 candidates
  🟣 [0] Somalia Flood Risk & Exposure Assessment (42 chunks, 5 files)
  🟣 [1] Climate Vulnerability Mapping Studies (28 chunks, 4 files)
  🟣 [2] Humanitarian Response & Recovery Plans (19 chunks, 3 files)

📊 New status: clusters  (narrowed to sub-clusters)
```

### 💭 Example 3: Using Follow-up Questions

```python
# When stuck, ask for a follow-up question
response = requests.post(
    f"http://localhost:8111/session/{session_id}/help",
    json={}
)
session = response.json()
print(f"❓ {session['pending_question']}")
# → "Does the document you're looking for focus more on
#     statistical methodology or field survey results?"

# Answer the question
response = requests.post(
    f"http://localhost:8111/session/{session_id}/answer",
    json={"answer": "It was about statistical methodology, exposure calculations"}
)
result = response.json()
print(f"📊 Status: {result['status']}")
# → "found" 🎯
print(f"🎯 File: {result['found_file']}")
```

### 🌳 Example 4: Backtracking

```python
# View the navigation tree
session = requests.get(f"http://localhost:8111/session/{session_id}").json()
for node in session['nav_tree']:
    indent = "  " * node['depth']
    marker = "→" if node['isOnPath'] else " "
    print(f"{indent}{marker} [{node['nodeId']}] {node['label']}")

# Backtrack to explore a different branch
requests.post(
    f"http://localhost:8111/session/{session_id}/backtrack",
    json={"node_id": "c1-r1"}  # go back to cluster 1 from round 1
)
```

---

## 🧩 API Reference

| Method   | Endpoint                  | Description                         |
| -------- | ------------------------- | ----------------------------------- |
| `GET`    | `/health`                 | Health check                        |
| `GET`    | `/collection/stats`       | Qdrant collection metadata          |
| `GET`    | `/categories`             | Brain-node category tree for 3D viz |
| `GET`    | `/categories/{id}/data`   | Images & files for a specific node  |
| `GET`    | `/query-options`          | Available query actions             |
| `POST`   | `/search`                 | Start a new search session          |
| `GET`    | `/session/{id}`           | Get current session state           |
| `POST`   | `/session/{id}/pick`      | Pick a cluster to narrow down       |
| `POST`   | `/session/{id}/help`      | Request a follow-up question        |
| `POST`   | `/session/{id}/answer`    | Answer a follow-up question         |
| `POST`   | `/session/{id}/backtrack` | Backtrack to a previous nav node    |
| `DELETE` | `/session/{id}`           | Delete a session                    |
| `GET`    | `/files/recent`           | Recently indexed files              |
| `GET`    | `/files/timeline`         | Files organized by date             |
| `GET`    | `/files/thumbnail`        | Serve image thumbnail               |
| `GET`    | `/files/download`         | Download a file                     |
| `GET`    | `/files/preview`          | Preview a file inline               |
| `POST`   | `/cache/invalidate`       | Force-refresh categories cache      |

---

## 📖 Documentation

| 📂 Component       | 📄 File                                          | Description                                         |
| ------------------ | ------------------------------------------------ | --------------------------------------------------- |
| 🧠 Backend API     | `backend/api.py`                                 | FastAPI server — sessions, search, file serving     |
| 🔍 Search Engine   | `backend/search.py`                              | Hybrid retrieval, HDBSCAN clustering, LLM labelling |
| 📄 PDF Watcher     | `backend/watcher.py`                             | Continuous file ingest pipeline                     |
| ⚙️ Configuration   | `backend/config.py`                              | All environment variables & defaults                |
| 🎨 Frontend App    | `frontend/src/App.jsx`                           | Main React app — state orchestration                |
| 🧠 3D Brain        | `frontend/src/components/BrainVisualization.jsx` | Three.js 3D graph                                   |
| 🌳 Search Graph    | `frontend/src/components/SearchGraph.jsx`        | Navigation tree (SVG)                               |
| 🔍 Query Interface | `frontend/src/components/QueryInterface.jsx`     | Search input + cluster selection                    |
| 📊 Data Panel      | `frontend/src/components/DataPanel.jsx`          | File/image sidebar                                  |
| 🔌 API Service     | `frontend/src/services/api.js`                   | Frontend ↔ Backend HTTP client                      |
| 🏗️ Architecture    | `frontend/ARCHITECTURE.md`                       | Component tree, data flow, event flow               |

---

## ⚙️ Configuration

All settings live in `backend/config.py` and can be overridden via environment variables:

| Variable                   | Default                  | Description                         |
| -------------------------- | ------------------------ | ----------------------------------- |
| `QDRANT_URL`               | — (required)             | Qdrant server URL                   |
| `QDRANT_API_KEY`           | — (required)             | Qdrant API key                      |
| `QDRANT_COLLECTION`        | `ai_minds_docs`          | Collection name                     |
| `DATA_DIR`                 | `./data`                 | Folder to watch for PDFs            |
| `OLLAMA_BASE_URL`          | `http://localhost:11434` | Ollama server URL                   |
| `OLLAMA_MODEL`             | `gemma3:4b-it-qat`       | LLM model for labelling & expansion |
| `EMBEDDING_MODEL`          | `BAAI/bge-large-en-v1.5` | Dense embedding model (1024-dim)    |
| `SPARSE_MODEL`             | `Qdrant/bm25`            | Sparse embedding model              |
| `CHUNK_SIZE`               | `500`                    | Text chunk size (characters)        |
| `CHUNK_OVERLAP`            | `50`                     | Chunk overlap                       |
| `HDBSCAN_MIN_CLUSTER_SIZE` | `5`                      | Minimum cluster size                |
| `DIRECT_MATCH_THRESHOLD`   | `0.85`                   | Score threshold for immediate match |
| `SEARCH_TOP_K`             | `100`                    | Number of results per search leg    |
| `DENSE_WEIGHT`             | `0.7`                    | Weight for dense vectors in fusion  |
| `SPARSE_WEIGHT`            | `0.3`                    | Weight for sparse vectors in fusion |

---

## 🎯 Core Principles

### 🧠 Reconstructive Memory

Human memory is associative, not indexed. HippoMind mirrors the hippocampus — reconstructing context through progressive narrowing, not exact matching.

### 🔍 Hybrid Retrieval

Dense semantics (BGE-large) catch meaning; sparse BM25 catches keywords. RRF fusion combines both for robust recall.

### 🧩 Interactive Clustering

HDBSCAN discovers natural topic groups. LLM-generated labels make them human-readable. Users navigate by recognition, not recall.

### 🌳 Explorable Search

Every search creates a tree. Users can backtrack, branch, and explore — search is a journey, not a one-shot query.

---

## 🌟 What Makes HippoMind Unique?

| Feature           | Traditional Search      | HippoMind                                |
| ----------------- | ----------------------- | ---------------------------------------- |
| **Query Type**    | Exact keywords required | Vague, fragmentary descriptions          |
| **Search Flow**   | One-shot → ranked list  | Multi-round interactive narrowing        |
| **Understanding** | "15 results found"      | "These cluster around flood methodology" |
| **When Stuck**    | Try different keywords  | LLM asks memory-jogging follow-ups       |
| **Navigation**    | Linear results list     | Branching tree with backtracking         |
| **Visualization** | Flat file list          | 3D brain graph with spatial memory       |
| **Retrieval**     | Dense OR keyword        | Hybrid dense + sparse RRF fusion         |
| **Indexing**      | Filename + full-text    | Title + LLM summary + content chunks     |

---

## 📂 Project Structure

```
HippoMind/
├── backend/
│   ├── api.py              # FastAPI server — sessions, search, file serving
│   ├── search.py           # Hybrid retrieval, HDBSCAN, LLM labelling
│   ├── watcher.py          # Continuous PDF ingest pipeline
│   ├── config.py           # All settings (env vars)
│   ├── requirements.txt    # Python dependencies
│   └── data/               # Drop PDFs here → auto-indexed
│
├── frontend/
│   ├── ARCHITECTURE.md     # Component tree & data flow docs
│   ├── package.json        # Node dependencies
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.jsx                         # Main app — state orchestration
│       ├── App.css
│       ├── components/
│       │   ├── BrainVisualization.jsx/css   # 3D brain graph (Three.js)
│       │   ├── SearchGraph.jsx/css          # Navigation tree (SVG)
│       │   ├── QueryInterface.jsx/css       # Search + cluster selection
│       │   ├── DataPanel.jsx/css            # File/image sidebar
│       │   ├── ImageGrid.jsx/css            # Image grid layout
│       │   ├── FileList.jsx/css             # File list layout
│       │   └── QueryOption.jsx/css          # Query option button
│       ├── hooks/
│       │   ├── useThreeScene.js             # Three.js scene lifecycle
│       │   └── useFiringAnimation.js        # Neuron firing animation
│       ├── data/
│       │   └── memoryData.js                # Memory categories & options
│       └── services/
│           └── api.js                       # Frontend ↔ Backend HTTP client
│
└── README.md
```

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[BAAI/bge-large-en-v1.5](https://huggingface.co/BAAI/bge-large-en-v1.5)** — state-of-the-art dense embedding model
- **[Qdrant](https://qdrant.tech)** — high-performance vector database with hybrid search
- **[Ollama](https://ollama.com)** — local LLM inference for privacy-first AI
- **[HDBSCAN](https://hdbscan.readthedocs.io)** — density-based clustering that finds natural topic groups
- **[Three.js](https://threejs.org)** — 3D graphics engine powering the brain visualization
- **[FastAPI](https://fastapi.tiangolo.com)** — modern Python web framework
- Open-source community for incredible tools ❤️

---

## ❓ Questions or Feedback?

Open an [issue](https://github.com/ismail180205/HippoMind/issues) or start a [discussion](https://github.com/ismail180205/HippoMind/discussions) if you have questions or want to contact us.

⭐ **If you find HippoMind useful, please give us a star!**

---

<p align="center">
  Made with ❤️ by the <strong>HippoMind Team</strong><br/>
  <em>Reconstructing memories through AI — because you don't always remember filenames, but you always remember the feeling.</em>
</p>
