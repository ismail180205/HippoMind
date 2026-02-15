import React from 'react';
import { File } from 'lucide-react';
import './FileList.css';

const FileList = ({ files }) => {
  return (
    <div className="file-list">
      {files.map(file => (
        <div key={file.id} className="file-item">
          <File size={16} color="#9966CC" />
          <div className="file-details">
            <div className="file-name">{file.name}</div>
            <div className="file-size">{file.size}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FileList;
