# AI Minds – Reconstructive‑Memory File Finder

A system that ingests PDFs, embeds their content into Qdrant, and then helps you **find a half‑remembered file** by iteratively clustering and labelling document chunks — narrowing down until only your file remains.

## Architecture

```
┌─────────────┐       ┌──────────────┐       ┌────────────┐
│  ./data/    │──PDF──▶│  watcher.py  │──vec──▶│   Qdrant   │
│  (drop PDFs)│       │  (continuous) │       │  (vectors) │
└─────────────┘       └──────────────┘       └─────┬──────┘
                                                    │
                                              ┌─────▼──────┐
                                              │  search.py  │
                                              │ (interactive│
                                              │   CLI loop) │
                                              └─────┬──────┘
                                                    │
                                              ┌─────▼──────┐
                                              │  Groq LLM  │
                                              │  (labels)   │
                                              └────────────┘
```

## Prerequisites

- **Python 3.10+**
- **Qdrant** running locally (default `http://localhost:6333`)
  ```bash
  docker run -p 6333:6333 qdrant/qdrant
  ```
- **Groq API key** – set it in your environment:
  ```bash
  export GROQ_API_KEY="gsk_..."
  ```

## Setup

```bash
pip install -r requirements.txt
```

## Usage

### 1. Start the watcher (runs forever)

```bash
python watcher.py
```

Drop PDF files into `./data/` — the watcher will automatically:

- Extract text from each PDF
- Chunk the text (500 chars, 50 overlap)
- Embed with `all-MiniLM-L6-v2`
- Push vectors + payloads to Qdrant

### 2. Search for a file

```bash
python search.py
```

The search loop will:

1. Pull all vectors from Qdrant
2. Cluster them (UMAP → HDBSCAN)
3. Label each cluster via the Groq LLM
4. Present the options as memory‑jogging hints
5. You pick the cluster that sounds like your file
6. Repeat on that subset until one file remains → 🎯

## Configuration

All settings live in `config.py` and can be overridden via environment variables:

| Variable            | Default                 | Description                 |
| ------------------- | ----------------------- | --------------------------- |
| `QDRANT_URL`        | `http://localhost:6333` | Qdrant server URL           |
| `QDRANT_API_KEY`    | `None`                  | Qdrant API key (if secured) |
| `QDRANT_COLLECTION` | `ai_minds_docs`         | Collection name             |
| `DATA_DIR`          | `./data`                | Folder to watch for PDFs    |
| `GROQ_API_KEY`      | —                       | Your Groq API key           |
| `GROQ_MODEL`        | `llama-3.1-8b-instant`  | LLM model for labelling     |

## Project Structure

```
├── config.py          # All settings
├── watcher.py         # PDF ingest pipeline (runs continuously)
├── search.py          # Interactive cluster‑search CLI
├── requirements.txt   # Python dependencies
├── data/              # Drop PDFs here
└── ai_minds.ipynb     # Original notebook exploration
```
