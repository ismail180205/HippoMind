/**
 * api.js — Central API service for communicating with the HippoMind backend.
 *
 * All fetch calls go through here so the frontend has a single source of truth
 * for the backend contract.
 */

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8111";

// ── Generic helpers ──────────────────────────────────────────────────────────

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.detail || body.message || res.statusText;
    throw new Error(msg);
  }
  return res.json();
}

function get(path) {
  return request(path);
}

function post(path, body) {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}

function del(path) {
  return request(path, { method: "DELETE" });
}

// ── Health / meta ────────────────────────────────────────────────────────────

export function healthCheck() {
  return get("/health");
}

export function getCollectionStats() {
  return get("/collection/stats");
}

// ── Categories (brain nodes) ─────────────────────────────────────────────────

/**
 * Fetches the category tree for the 3D brain visualisation.
 * Returns: Array<{ id, name, x, y, z, dataCount, children, date }>
 */
export function getCategories() {
  return get("/categories");
}

// ── Data items for a category ────────────────────────────────────────────────

/**
 * Returns images and files belonging to a specific category / brain node.
 * Response shape: { images: [...], files: [...] }
 */
export function getCategoryData(categoryId) {
  return get(`/categories/${categoryId}/data`);
}

// ── Query options ────────────────────────────────────────────────────────────

/**
 * Fetch the list of query options shown in the QueryInterface.
 * Returns: Array<{ id, label, icon }>
 */
export function getQueryOptions() {
  return get("/query-options");
}

// ── Search session flow ──────────────────────────────────────────────────────

/**
 * Start a brand‑new search session.
 * @param {string} query — the user's natural‑language query
 * @returns session object (see Session.to_dict() on the backend)
 */
export function startSearch(query) {
  return post("/search", { query });
}

/**
 * Get the current state of a session.
 */
export function getSession(sessionId) {
  return get(`/session/${sessionId}`);
}

/**
 * Pick a cluster to narrow results.
 */
export function pickCluster(sessionId, clusterId) {
  return post(`/session/${sessionId}/pick`, { cluster_id: clusterId });
}

/**
 * Ask the backend for a follow‑up question.
 */
export function askForHelp(sessionId) {
  return post(`/session/${sessionId}/help`, {});
}

/**
 * Answer a follow‑up question.
 */
export function answerFollowup(sessionId, answer) {
  return post(`/session/${sessionId}/answer`, { answer });
}

/**
 * Delete / clean‑up a session.
 */
export function deleteSession(sessionId) {
  return del(`/session/${sessionId}`);
}

/**
 * Backtrack to a previous node in the search navigation tree.
 */
export function backtrackSession(sessionId, nodeId) {
  return post(`/session/${sessionId}/backtrack`, { node_id: nodeId });
}

// ── File serving ─────────────────────────────────────────────────────────────

/**
 * Build the URL for an image thumbnail served by the backend.
 * Images that live in the watched data folder are proxied via this path.
 */
export function imageThumbnailUrl(filePath) {
  return `${API_BASE}/files/thumbnail?path=${encodeURIComponent(filePath)}`;
}

/**
 * Build the URL to download / open a file from the watched data folder.
 */
export function fileDownloadUrl(filePath) {
  return `${API_BASE}/files/download?path=${encodeURIComponent(filePath)}`;
}

/**
 * Build the URL to preview a file inline (no download prompt).
 * Used for embedding PDFs in an iframe.
 */
export function filePreviewUrl(filePath) {
  return `${API_BASE}/files/preview?path=${encodeURIComponent(filePath)}`;
}

// ── Recent files ─────────────────────────────────────────────────────────────

/**
 * Get recently indexed files.
 */
export function getRecentFiles(limit = 20) {
  return get(`/files/recent?limit=${limit}`);
}
