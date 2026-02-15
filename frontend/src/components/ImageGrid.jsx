import React, { useState } from 'react';
import { imageThumbnailUrl } from '../services/api';
import './ImageGrid.css';

const ImageGrid = ({ images }) => {
  return (
    <div className="image-grid">
      {images.map(img => (
        <ImageItem key={img.id} img={img} />
      ))}
    </div>
  );
};

const ImageItem = ({ img }) => {
  const [failed, setFailed] = useState(false);
  const src = img.thumbnail?.startsWith('http')
    ? img.thumbnail
    : imageThumbnailUrl(img.name);

  return (
    <div className="image-item" title={img.name}>
      {failed ? (
        <div className="image-placeholder">
          IMG
        </div>
      ) : (
        <img
          className="image-thumb"
          src={src}
          alt={img.name}
          onError={() => setFailed(true)}
          loading="lazy"
        />
      )}
      <div className="image-name">{img.name}</div>
    </div>
  );
};

export default ImageGrid;
