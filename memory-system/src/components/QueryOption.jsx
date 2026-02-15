import React from 'react';
import './QueryOption.css';

const QueryOption = ({ option, isSelected, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`query-option ${isSelected ? 'selected' : ''}`}
    >
      <div className="option-icon">
        {option.icon}
      </div>
      <div className="option-label">
        {option.label}
      </div>
    </button>
  );
};

export default QueryOption;
