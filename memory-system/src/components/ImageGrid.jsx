import React from 'react';
import './ImageGrid.css';

const ImageGrid = ({ images }) => {
  return (
    <div className="image-grid">
      {images.map(img => (
        <div key={img.id} className="image-item">
          <div className="image-placeholder">
            IMG
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImageGrid;
