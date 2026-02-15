import React, { useMemo, useState } from "react";
import "./SearchGraph.css";

// ─── Branch Palette ─────────────────────────────────────────────────────────
const PALETTE = [
  { line: "#9966CC", glow: "#9966CC80", badge: "#7E22CE" }, // purple (root)
  { line: "#3B82F6", glow: "#3B82F680", badge: "#1D4ED8" }, // blue
  { line: "#EC4899", glow: "#EC489980", badge: "#9D174D" }, // pink
  { line: "#F97316", glow: "#F9731680", badge: "#C2410C" }, // orange
  { line: "#22C55E", glow: "#22C55E80", badge: "#15803D" }, // green
  { line: "#06B6D4", glow: "#06B6D480", badge: "#0E7490" }, // cyan
  { line: "#EAB308", glow: "#EAB30880", badge: "#A16207" }, // yellow
  { line: "#F43F5E", glow: "#F43F5E80", badge: "#9F1239" }, // rose
];

const getP = (depth) => PALETTE[Math.abs(depth) % PALETTE.length];

// ─── Layout constants ───────────────────────────────────────────────────────
const COL_W = 28;
const ROW_H = 52;
const NODE_R = 6;
const PAD_X = 18;
const PAD_Y = 18;

// ─── Flatten tree into rows for rendering ───────────────────────────────────
/**
 * navTree is an array of tree nodes:
 * [
 *   { nodeId: "root", label: "energy", depth: 0, parentNodeId: null, round: 0, isCurrent: false, isOnPath: true },
 *   { nodeId: "0-r1",  label: "Solar Power", depth: 1, parentNodeId: "root", round: 1, ... },
 *   ...
 * ]
 *
 * We flatten to rows preserving DFS order, assigning columns based on sibling index.
 */
function flattenTree(navTree) {
  if (!navTree || navTree.length === 0) return { rows: [], maxCol: 0 };

  // Build parent → children map
  const childrenMap = {};
  const nodeMap = {};
  navTree.forEach((n) => {
    nodeMap[n.nodeId] = n;
    if (!childrenMap[n.nodeId]) childrenMap[n.nodeId] = [];
    if (n.parentNodeId != null) {
      if (!childrenMap[n.parentNodeId]) childrenMap[n.parentNodeId] = [];
      childrenMap[n.parentNodeId].push(n.nodeId);
    }
  });

  // Find root(s)
  const roots = navTree.filter((n) => n.parentNodeId == null);
  if (roots.length === 0) return { rows: [], maxCol: 0 };

  // DFS to assign rows and columns
  const rows = [];
  let maxCol = 0;

  function dfs(nodeId, col) {
    const node = nodeMap[nodeId];
    if (!node) return;
    rows.push({ ...node, col });
    if (col > maxCol) maxCol = col;

    const children = childrenMap[nodeId] || [];
    children.forEach((childId, idx) => {
      // First child stays in same column, siblings branch out
      const childCol = idx === 0 ? col : maxCol + 1;
      dfs(childId, childCol);
    });
  }

  roots.forEach((root, idx) => {
    dfs(root.nodeId, idx);
  });

  return { rows, maxCol };
}

// ─── SVG curved path ────────────────────────────────────────────────────────
function makePath(x1, y1, x2, y2) {
  if (Math.abs(x1 - x2) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const bend = Math.min(Math.abs(y2 - y1) * 0.55, 56);
  return `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
}

// ─── Component ──────────────────────────────────────────────────────────────
const SearchGraph = ({ navTree, currentNodeId, onNodeClick }) => {
  const [hovered, setHovered] = useState(null);

  const { rows, maxCol } = useMemo(() => flattenTree(navTree), [navTree]);

  // Build row index by nodeId
  const rowIndex = useMemo(() => {
    const m = {};
    rows.forEach((r, i) => {
      m[r.nodeId] = i;
    });
    return m;
  }, [rows]);

  const getX = (col) => PAD_X + col * COL_W + COL_W / 2;
  const getY = (i) => PAD_Y + i * ROW_H + ROW_H / 2;

  const svgW = PAD_X * 2 + (maxCol + 1) * COL_W;
  const svgH = PAD_Y * 2 + rows.length * ROW_H;

  // Build edges
  const edges = useMemo(() => {
    const list = [];
    rows.forEach((row, i) => {
      if (row.parentNodeId == null) return;
      const parentIdx = rowIndex[row.parentNodeId];
      if (parentIdx == null) return;
      const parentRow = rows[parentIdx];
      const p = getP(row.depth);
      list.push({
        key: `${row.parentNodeId}>${row.nodeId}`,
        d: makePath(
          getX(parentRow.col),
          getY(parentIdx),
          getX(row.col),
          getY(i),
        ),
        color: p.line,
        glow: p.glow,
        fromId: row.parentNodeId,
        toId: row.nodeId,
        depth: row.depth,
      });
    });
    return list;
  }, [rows, rowIndex]);

  if (!navTree || navTree.length === 0) return null;

  return (
    <div className="search-graph">
      <div className="search-graph-header">
        <span className="search-graph-title">Search Path</span>
        <span className="search-graph-meta">
          {rows.length} node{rows.length !== 1 ? "s" : ""} · {maxCol + 1} branch
          {maxCol !== 0 ? "es" : ""}
        </span>
      </div>

      <div className="search-graph-body">
        {/* SVG rail */}
        <svg width={svgW} height={svgH} className="search-graph-svg">
          <defs>
            {PALETTE.map((p, i) => (
              <filter
                key={i}
                id={`sg-glow-${i}`}
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {/* edges */}
          {edges.map((e) => {
            const isHov = hovered === e.fromId || hovered === e.toId;
            const filtIdx = Math.abs(e.depth) % PALETTE.length;
            return (
              <path
                key={e.key}
                d={e.d}
                stroke={e.color}
                strokeWidth={isHov ? 3 : 2.2}
                fill="none"
                strokeLinecap="round"
                opacity={hovered && !isHov ? 0.25 : 1}
                style={{ transition: "opacity 0.2s, stroke-width 0.15s" }}
                filter={isHov ? `url(#sg-glow-${filtIdx})` : undefined}
              />
            );
          })}

          {/* nodes */}
          {rows.map((row, i) => {
            const p = getP(row.depth);
            const isHov = hovered === row.nodeId;
            const isCurrent = row.nodeId === currentNodeId;
            const isOnPath = row.isOnPath;

            return (
              <g
                key={row.nodeId}
                onMouseEnter={() => setHovered(row.nodeId)}
                onMouseLeave={() => setHovered(null)}
                onClick={() =>
                  onNodeClick && onNodeClick(row.nodeId, row.round)
                }
                style={{ cursor: onNodeClick ? "pointer" : "default" }}
              >
                {/* glow halo for current or hovered */}
                {(isHov || isCurrent) && (
                  <circle
                    cx={getX(row.col)}
                    cy={getY(i)}
                    r={NODE_R + 5}
                    fill={isCurrent ? p.line + "60" : p.glow}
                  />
                )}
                {/* outer ring */}
                <circle
                  cx={getX(row.col)}
                  cy={getY(i)}
                  r={NODE_R + 1}
                  fill={isOnPath ? p.glow : p.glow.replace("80", "30")}
                />
                {/* main dot */}
                <circle
                  cx={getX(row.col)}
                  cy={getY(i)}
                  r={NODE_R}
                  fill={isCurrent ? "#fff" : p.line}
                  stroke="#0A0C10"
                  strokeWidth={2}
                />
                {/* center pip */}
                {isCurrent && (
                  <circle
                    cx={getX(row.col)}
                    cy={getY(i)}
                    r={NODE_R * 0.35}
                    fill={p.line}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Labels column */}
        <div className="search-graph-labels" style={{ paddingTop: PAD_Y }}>
          {rows.map((row, i) => {
            const p = getP(row.depth);
            const isHov = hovered === row.nodeId;
            const isCurrent = row.nodeId === currentNodeId;

            return (
              <div
                key={row.nodeId}
                className={`sg-label-row ${isCurrent ? "sg-current" : ""}`}
                style={{ height: ROW_H }}
                onMouseEnter={() => setHovered(row.nodeId)}
                onMouseLeave={() => setHovered(null)}
                onClick={() =>
                  onNodeClick && onNodeClick(row.nodeId, row.round)
                }
              >
                {/* badge */}
                <div
                  className="sg-badge"
                  style={{
                    background: isHov ? p.line + "28" : p.line + "14",
                    borderColor: isHov ? p.line + "88" : p.line + "44",
                    boxShadow: isHov ? `0 0 10px ${p.glow}` : "none",
                  }}
                >
                  <span style={{ color: p.line }} className="sg-badge-text">
                    {row.depth === 0 ? "Q" : `R${row.round}`}
                  </span>
                </div>

                {/* label text */}
                <span
                  className="sg-label-text"
                  style={{
                    color: isHov || isCurrent ? "#C9D1D9" : "#6B7888",
                  }}
                >
                  {row.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="search-graph-footer">
        <div className="sg-dot-row">
          {Array.from({ length: maxCol + 1 }).map((_, i) => (
            <div
              key={i}
              className="sg-dot"
              style={{ background: getP(i).line }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchGraph;
