import React from 'react';
import { Image as ImageIcon, FileText, Search, Clock, Loader } from 'lucide-react';
import ImageGrid from './ImageGrid';
import FileList from './FileList';
import './DataPanel.css';

const DataPanel = ({
  selectedCategory,
  selectedData,
  loadingData,
  session,
  recentFiles,
}) => {
  // ── Search results panel ─────────────────────────────────────────────
  if (session) {
    return (
      <div className="data-panel">
        <div className="data-panel-header">
          <h2 className="data-panel-title">
            <Search size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Search Results
          </h2>
          <p className="data-panel-subtitle">
            {session.status === 'found'
              ? `Found: ${session.found_file}`
              : session.status === 'exhausted'
              ? `${session.remaining_files?.length || 0} candidate(s) remaining`
              : `${session.total_chunks} chunks across ${session.files?.length || 0} file(s)`}
          </p>
        </div>

        <div className="data-panel-content">
          {session.status === 'found' && (
            <div className="result-found">
              <div className="result-icon">🎯</div>
              <p className="result-label">Your file is:</p>
              <p className="result-filename">{session.found_file}</p>
            </div>
          )}

          {session.status === 'exhausted' && session.remaining_files && (
            <div className="data-section">
              <div className="section-header">
                <FileText size={16} color="#9966CC" />
                <span className="section-title">Remaining candidates</span>
              </div>
              <FileList
                files={session.remaining_files.map((f, i) => ({
                  id: `rem-${i}`,
                  name: f,
                  type: f.split('.').pop(),
                  size: '—',
                }))}
              />
            </div>
          )}

          {/* Show ranked files in any status */}
          {session.files && session.files.length > 0 && session.status !== 'found' && (
            <div className="data-section">
              <div className="section-header">
                <FileText size={16} color="#9966CC" />
                <span className="section-title">
                  Candidate Files ({session.files.length})
                </span>
              </div>
              <FileList
                files={session.files.map((f, i) => ({
                  id: `cand-${i}`,
                  name: f,
                  type: f.split('.').pop(),
                  size: session.file_scores?.[f]
                    ? `score ${session.file_scores[f].toFixed(3)}`
                    : '—',
                }))}
              />
            </div>
          )}

          {session.conversation && session.conversation.length > 0 && (
            <div className="data-section">
              <div className="section-header">
                <span className="section-title">Conversation</span>
              </div>
              <div className="conversation-log">
                {session.conversation.map((turn, i) => (
                  <div key={i} className="conversation-turn">
                    <p className="conv-question">Q: {turn.q}</p>
                    <p className="conv-answer">A: {turn.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Recent files panel ───────────────────────────────────────────────
  if (recentFiles) {
    return (
      <div className="data-panel">
        <div className="data-panel-header">
          <h2 className="data-panel-title">
            <Clock size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Recent Files
          </h2>
          <p className="data-panel-subtitle">{recentFiles.length} file(s)</p>
        </div>
        <div className="data-panel-content">
          <FileList
            files={recentFiles.map(f => ({
              id: f.id,
              name: f.name,
              type: f.type,
              size: f.size,
              date: f.date,
            }))}
          />
        </div>
      </div>
    );
  }

  // ── Default: category data panel ─────────────────────────────────────
  return (
    <div className="data-panel">
      <div className="data-panel-header">
        <h2 className="data-panel-title">
          {selectedCategory ? selectedCategory.name : 'Memory Data'}
        </h2>
        <p className="data-panel-subtitle">
          {loadingData
            ? 'Loading…'
            : selectedData
            ? `${selectedData.images.length} images, ${selectedData.files.length} files`
            : 'Select a node to view data'}
        </p>
      </div>

      <div className="data-panel-content">
        {loadingData ? (
          <div className="empty-state">
            <Loader size={20} className="spinner" />
            <span style={{ marginLeft: 8 }}>Loading data…</span>
          </div>
        ) : selectedData ? (
          <>
            {selectedData.images.length > 0 && (
              <div className="data-section">
                <div className="section-header">
                  <ImageIcon size={16} color="#9966CC" />
                  <span className="section-title">
                    Images ({selectedData.images.length})
                  </span>
                </div>
                <ImageGrid images={selectedData.images} />
              </div>
            )}

            {selectedData.files.length > 0 && (
              <div className="data-section">
                <div className="section-header">
                  <FileText size={16} color="#9966CC" />
                  <span className="section-title">
                    Files ({selectedData.files.length})
                  </span>
                </div>
                <FileList files={selectedData.files} />
              </div>
            )}

            {selectedData.images.length === 0 && selectedData.files.length === 0 && (
              <div className="empty-state">
                No files associated with this node
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            Click a node in the brain to view its data
          </div>
        )}
      </div>
    </div>
  );
};

export default DataPanel;
