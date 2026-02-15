import React, { useState, useEffect, useCallback } from "react";
import DataPanel from "./components/DataPanel";
import BrainVisualization from "./components/BrainVisualization";
import QueryInterface from "./components/QueryInterface";
import SearchGraph from "./components/SearchGraph";
import {
  getCategories,
  getCategoryData,
  getQueryOptions,
  startSearch,
  getSession,
  pickCluster,
  askForHelp,
  answerFollowup,
  deleteSession,
  getRecentFiles,
  backtrackSession,
} from "./services/api";
import "./App.css";

const App = () => {
  // ── Brain / category state ───────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedData, setSelectedData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  // ── Query interface state ────────────────────────────────────────────────
  const [selectedOption, setSelectedOption] = useState(null);
  const [queryOptions, setQueryOptions] = useState([]);

  // ── Search session state ─────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [zoomTarget, setZoomTarget] = useState(null); // cluster id just picked → triggers zoom-in

  // ── Extra panels ─────────────────────────────────────────────────────────
  const [recentFiles, setRecentFiles] = useState(null);

  // ── Global error / loading ───────────────────────────────────────────────
  const [error, setError] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Load categories + query options + recent files on mount ──────────────
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [cats, opts, recent] = await Promise.all([
          getCategories(),
          getQueryOptions(),
          getRecentFiles(20),
        ]);
        if (cancelled) return;
        setCategories(cats);
        setQueryOptions(opts);
        setRecentFiles(recent);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── When a brain node is selected, fetch its data ────────────────────────
  useEffect(() => {
    if (!selectedNode) {
      setSelectedData(null);
      return;
    }
    let cancelled = false;
    async function fetchData() {
      setLoadingData(true);
      try {
        const data = await getCategoryData(selectedNode);
        if (!cancelled) setSelectedData(data);
      } catch (err) {
        if (!cancelled) setSelectedData({ images: [], files: [] });
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [selectedNode]);

  const selectedCategory = categories.find((c) => c.id === selectedNode);

  // ── Search flow ──────────────────────────────────────────────────────────

  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const sess = await startSearch(query);
      setSession(sess);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handlePickCluster = useCallback(
    async (clusterId) => {
      if (!session) return;
      setZoomTarget(clusterId); // triggers zoom-in transition in 3D
      setSearchLoading(true);
      try {
        const updated = await pickCluster(session.session_id, clusterId);
        setSession(updated);
      } catch (err) {
        setSearchError(err.message);
      } finally {
        setSearchLoading(false);
        setZoomTarget(null); // clear after scene rebuild
      }
    },
    [session],
  );

  const handleAskHelp = useCallback(async () => {
    if (!session) return;
    setSearchLoading(true);
    try {
      const updated = await askForHelp(session.session_id);
      setSession(updated);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  }, [session]);

  const handleAnswerFollowup = useCallback(
    async (answer) => {
      if (!session) return;
      setSearchLoading(true);
      try {
        const updated = await answerFollowup(session.session_id, answer);
        setSession(updated);
      } catch (err) {
        setSearchError(err.message);
      } finally {
        setSearchLoading(false);
      }
    },
    [session],
  );

  const handleCloseSession = useCallback(async () => {
    if (session) {
      try {
        await deleteSession(session.session_id);
      } catch {}
    }
    setSession(null);
    setSearchQuery("");
    setSearchError(null);
    setZoomTarget(null);
  }, [session]);

  const handleBacktrack = useCallback(
    async (nodeId, round) => {
      if (!session) return;
      // Don't backtrack to the current node
      if (nodeId === session.current_nav_node) return;
      setSearchLoading(true);
      setSearchError(null);
      try {
        const updated = await backtrackSession(session.session_id, nodeId);
        setSession(updated);
      } catch (err) {
        setSearchError(err.message);
      } finally {
        setSearchLoading(false);
      }
    },
    [session],
  );

  // ── Query option actions ─────────────────────────────────────────────────

  const handleContinue = useCallback(async () => {
    if (!selectedOption) return;

    switch (selectedOption) {
      case "search":
        // The QueryInterface will show the search input
        break;

      case "recent":
        try {
          const files = await getRecentFiles(20);
          setRecentFiles(files);
        } catch (err) {
          setError(err.message);
        }
        break;

      default:
        break;
    }
  }, [selectedOption]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div
        className="app-container"
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <p style={{ color: "#9966CC", fontSize: 16 }}>
          Connecting to HippoMind…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="app-container"
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <p style={{ color: "#ff6b6b", fontSize: 14 }}>⚠ {error}</p>
        <button
          onClick={() => {
            setError(null);
            window.location.reload();
          }}
          style={{
            padding: "8px 16px",
            background: "#9966CC",
            border: "none",
            borderRadius: 6,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <DataPanel
        selectedCategory={selectedCategory}
        selectedData={selectedData}
        loadingData={loadingData}
        session={session}
        recentFiles={recentFiles}
      />

      <div className="main-content">
        <div className="viz-row">
          <BrainVisualization
            categories={categories}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
            session={session}
            onPickCluster={handlePickCluster}
            zoomTarget={zoomTarget}
          />
          {session && session.nav_tree && session.nav_tree.length > 0 && (
            <SearchGraph
              navTree={session.nav_tree}
              currentNodeId={session.current_nav_node}
              onNodeClick={handleBacktrack}
            />
          )}
        </div>

        <QueryInterface
          selectedOption={selectedOption}
          setSelectedOption={setSelectedOption}
          queryOptions={queryOptions}
          onContinue={handleContinue}
          onSearch={handleSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchLoading={searchLoading}
          searchError={searchError}
          session={session}
          onPickCluster={handlePickCluster}
          onAskHelp={handleAskHelp}
          onAnswerFollowup={handleAnswerFollowup}
          onCloseSession={handleCloseSession}
        />
      </div>
    </div>
  );
};

export default App;
