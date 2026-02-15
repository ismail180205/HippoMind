import React, { useRef, useMemo, useCallback } from "react";
import { Maximize2 } from "lucide-react";
import useThreeScene from "../hooks/useThreeScene";
import "./BrainVisualization.css";

/**
 * Renders the 3D graph.
 *
 * - When there is NO active search session → shows the static category nodes.
 * - When session.status === 'clusters'   → shows one node per cluster.
 * - When the user clicks a cluster node  → calls onPickCluster(id),
 *   and the next render (with new sub-clusters or a different status)
 *   triggers a zoom-in transition.
 */
const BrainVisualization = ({
  categories, // static brain nodes (always present)
  selectedNode,
  setSelectedNode,
  session, // current search session (or null)
  onPickCluster, // (clusterId) => void
  zoomTarget, // id of the cluster the user just picked
}) => {
  const mountRef = useRef(null);

  // ── Derive the nodes to display ──────────────────────────────────────
  const displayNodes = useMemo(() => {
    if (session?.status === "clusters" && session.clusters?.length) {
      return session.clusters.map((c) => ({
        id: c.id,
        name: c.label,
        size: c.size,
      }));
    }
    // default: static categories
    return categories;
  }, [session, categories]);

  const isClusterMode = !!(
    session?.status === "clusters" && session.clusters?.length
  );

  // ── Node click handler ───────────────────────────────────────────────
  const handleNodeClick = useCallback(
    (nodeId) => {
      if (nodeId == null) {
        setSelectedNode(null);
        return;
      }
      if (isClusterMode && onPickCluster) {
        onPickCluster(nodeId); // pick cluster → triggers session update
      } else {
        setSelectedNode(nodeId); // normal category selection
      }
    },
    [isClusterMode, onPickCluster, setSelectedNode],
  );

  const { labelsRef, resetCamera } = useThreeScene(
    mountRef,
    displayNodes,
    selectedNode,
    handleNodeClick,
    zoomTarget,
  );

  const selectedItem = displayNodes.find((n) => n.id === selectedNode);

  // ── Header copy ──────────────────────────────────────────────────────
  const title = isClusterMode
    ? `Search Clusters (${displayNodes.length})`
    : `Memory Brain (${displayNodes.length} nodes)`;

  const subtitle = isClusterMode
    ? `Round ${session.round} · click a cluster to dive in`
    : "Drag to rotate • Click to zoom • Scroll to zoom in/out";

  return (
    <div className="brain-visualization">
      <div className="brain-header">
        <div>
          <h1 className="brain-title">{title}</h1>
          <p className="brain-subtitle">{subtitle}</p>
        </div>

        <div className="brain-controls">
          {selectedItem && (
            <div className="selected-node-badge">
              <div className="badge-indicator" />
              {selectedItem.name}
            </div>
          )}

          <button onClick={resetCamera} className="reset-button">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div ref={mountRef} className="brain-canvas">
        {displayNodes.map((node, index) => (
          <div
            key={node.id}
            ref={(el) => (labelsRef.current[index] = el)}
            data-node-id={node.id}
            className="node-label"
          >
            {node.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BrainVisualization;
