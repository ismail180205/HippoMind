import React, { useState } from "react";
import { Play, Search, X, HelpCircle, Send, Loader } from "lucide-react";
import QueryOption from "./QueryOption";
import "./QueryInterface.css";

const QueryInterface = ({
  selectedOption,
  setSelectedOption,
  queryOptions,
  onContinue,
  onSearch,
  searchQuery,
  setSearchQuery,
  searchLoading,
  searchError,
  session,
  onPickCluster,
  onAskHelp,
  onAnswerFollowup,
  onCloseSession,
}) => {
  const [followupAnswer, setFollowupAnswer] = useState("");

  // ── Active search session view ───────────────────────────────────────
  if (session) {
    return (
      <div className="query-interface">
        <div className="query-header">
          <h2 className="query-title">
            {session.status === "found"
              ? "🎯 File Found!"
              : session.status === "exhausted"
                ? "📋 Narrowed Down"
                : session.status === "followup"
                  ? "💭 Follow‑up Question"
                  : session.status === "clusters"
                    ? "🧩 Choose a Group"
                    : "Searching…"}
          </h2>
          <p className="query-subtitle">
            {session.status === "found"
              ? session.found_file
              : session.status === "exhausted"
                ? `Could not narrow further — ${session.remaining_files?.length} candidate(s)`
                : session.status === "followup"
                  ? `Question ${session.followup_count + 1} of ${session.max_followups}`
                  : session.status === "clusters"
                    ? `Round ${session.round} — pick the group that matches your memory`
                    : `"${session.query}"`}
          </p>
        </div>

        <div className="query-results-body">
          {/* Cluster selection */}
          {session.status === "clusters" && session.clusters && (
            <div className="cluster-list">
              {session.clusters.map((cluster) => (
                <button
                  key={cluster.id}
                  className="cluster-option"
                  onClick={() => onPickCluster(cluster.id)}
                  disabled={searchLoading}
                >
                  <div className="cluster-label">{cluster.label}</div>
                  <div className="cluster-meta">
                    {cluster.size} chunks · {cluster.files.length} file(s)
                  </div>
                </button>
              ))}
              <button
                className="help-button"
                onClick={onAskHelp}
                disabled={searchLoading}
              >
                <HelpCircle size={14} />
                I'm not sure — ask me a question
              </button>
            </div>
          )}

          {/* Follow-up question */}
          {session.status === "followup" && session.pending_question && (
            <div className="followup-section">
              <p className="followup-question">{session.pending_question}</p>
              <div className="followup-input-row">
                <input
                  type="text"
                  className="followup-input"
                  placeholder="Your answer…"
                  value={followupAnswer}
                  onChange={(e) => setFollowupAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && followupAnswer.trim()) {
                      onAnswerFollowup(followupAnswer.trim());
                      setFollowupAnswer("");
                    }
                  }}
                  disabled={searchLoading}
                />
                <button
                  className="send-button"
                  onClick={() => {
                    if (followupAnswer.trim()) {
                      onAnswerFollowup(followupAnswer.trim());
                      setFollowupAnswer("");
                    }
                  }}
                  disabled={searchLoading || !followupAnswer.trim()}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {searchLoading && (
            <div className="search-loading">
              <Loader size={18} className="spinner" />
              <span>Thinking…</span>
            </div>
          )}
        </div>

        <div className="query-footer">
          <button className="close-button" onClick={onCloseSession}>
            <X size={14} />
            New Search
          </button>
        </div>
      </div>
    );
  }

  // ── Search input mode ────────────────────────────────────────────────
  if (selectedOption === "search") {
    return (
      <div className="query-interface">
        <div className="query-header">
          <h2 className="query-title">
            <Search
              size={18}
              style={{ marginRight: 6, verticalAlign: "middle" }}
            />
            Search Your Memory
          </h2>
          <p className="query-subtitle">
            Describe the file you're looking for — even vaguely
          </p>
        </div>

        <div className="search-body">
          <div className="search-input-row">
            <input
              type="text"
              className="search-input"
              placeholder="e.g. that report about flooding in Somalia…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  onSearch(searchQuery.trim());
                }
              }}
              disabled={searchLoading}
              autoFocus
            />
            <button
              className="search-go-button"
              onClick={() => searchQuery.trim() && onSearch(searchQuery.trim())}
              disabled={searchLoading || !searchQuery.trim()}
            >
              {searchLoading ? (
                <Loader size={14} className="spinner" />
              ) : (
                <Search size={14} />
              )}
            </button>
          </div>

          {searchError && <p className="search-error">⚠ {searchError}</p>}
        </div>

        <div className="query-footer">
          <button
            className="back-button"
            onClick={() => setSelectedOption(null)}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── Default: query options grid ──────────────────────────────────────
  return (
    <div className="query-interface">
      <div className="query-header">
        <h2 className="query-title">What would you like to explore?</h2>
        <p className="query-subtitle">
          Choose an option to navigate your memories
        </p>
      </div>

      <div className="query-options">
        {queryOptions.map((option) => (
          <QueryOption
            key={option.id}
            option={option}
            isSelected={selectedOption === option.id}
            onClick={() => setSelectedOption(option.id)}
          />
        ))}
      </div>

      {selectedOption && selectedOption !== "search" && (
        <div className="query-footer">
          <button onClick={onContinue} className="continue-button">
            <Play size={14} />
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default QueryInterface;
