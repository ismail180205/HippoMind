import React from 'react';
import { Image as ImageIcon, FileText } from 'lucide-react';
import ImageGrid from './ImageGrid';
import FileList from './FileList';
import './DataPanel.css';

const DataPanel = ({ selectedCategory, selectedData }) => {
  return (
    <div className="data-panel">
      <div className="data-panel-header">
        <h2 className="data-panel-title">
          {selectedCategory ? selectedCategory.name : 'Memory Data'}
        </h2>
        <p className="data-panel-subtitle">
          {selectedData 
            ? `${selectedData.images.length} images, ${selectedData.files.length} files` 
            : 'Select a node to view data'}
        </p>
      </div>

      <div className="data-panel-content">
        {selectedData ? (
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
