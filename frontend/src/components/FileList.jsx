import React from 'react';
import { File, Download } from 'lucide-react';
import { fileDownloadUrl } from '../services/api';
import './FileList.css';

const FileList = ({ files }) => {
  return (
    <div className="file-list">
      {files.map(file => (
        <div key={file.id} className="file-item">
          <File size={16} color="#9966CC" />
          <div className="file-details">
            <div className="file-name">{file.name}</div>
            <div className="file-size">
              {file.size}
              {file.date && <span className="file-date"> · {file.date}</span>}
            </div>
          </div>
          <a
            className="file-download"
            href={fileDownloadUrl(file.name)}
            target="_blank"
            rel="noopener noreferrer"
            title="Download"
          >
            <Download size={14} color="#9966CC" />
          </a>
        </div>
      ))}
    </div>
  );
};

export default FileList;
