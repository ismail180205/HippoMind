import React, { useState } from "react";
import { File, Download, Eye, X } from "lucide-react";
import { fileDownloadUrl, filePreviewUrl } from "../services/api";
import "./FileList.css";

const isPdf = (name) => /\.pdf$/i.test(name);

const FileList = ({ files }) => {
  const [previewFile, setPreviewFile] = useState(null);

  return (
    <div className="file-list">
      {files.map((file) => (
        <div
          key={file.id}
          className="file-item"
          onClick={() => isPdf(file.name) && setPreviewFile(file)}
        >
          <File size={16} color="#9966CC" />
          <div className="file-details">
            <div className="file-name">{file.name}</div>
            <div className="file-size">
              {file.size}
              {file.date && <span className="file-date"> · {file.date}</span>}
            </div>
          </div>
          {isPdf(file.name) && (
            <button
              className="file-preview-btn"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewFile(file);
              }}
              title="Preview PDF"
            >
              <Eye size={14} color="#9966CC" />
            </button>
          )}
          <a
            className="file-download"
            href={fileDownloadUrl(file.name)}
            target="_blank"
            rel="noopener noreferrer"
            title="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={14} color="#9966CC" />
          </a>
        </div>
      ))}

      {/* ── PDF Preview Modal ─────────────────────────────────────── */}
      {previewFile && (
        <div className="pdf-overlay" onClick={() => setPreviewFile(null)}>
          <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-modal-header">
              <span className="pdf-modal-title">{previewFile.name}</span>
              <div className="pdf-modal-actions">
                <a
                  href={fileDownloadUrl(previewFile.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pdf-modal-download"
                  title="Download"
                >
                  <Download size={16} />
                </a>
                <button
                  className="pdf-modal-close"
                  onClick={() => setPreviewFile(null)}
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              className="pdf-iframe"
              src={filePreviewUrl(previewFile.name)}
              title={`Preview: ${previewFile.name}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FileList;
