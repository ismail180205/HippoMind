import React from 'react';
import { Play } from 'lucide-react';
import QueryOption from './QueryOption';
import { queryOptions } from '../data/memoryData';
import './QueryInterface.css';

const QueryInterface = ({ selectedOption, setSelectedOption, onContinue }) => {
  return (
    <div className="query-interface">
      <div className="query-header">
        <h2 className="query-title">
          What would you like to explore?
        </h2>
        <p className="query-subtitle">
          Choose an option to navigate your memories
        </p>
      </div>

      <div className="query-options">
        {queryOptions.map(option => (
          <QueryOption
            key={option.id}
            option={option}
            isSelected={selectedOption === option.id}
            onClick={() => setSelectedOption(option.id)}
          />
        ))}
      </div>

      {selectedOption && (
        <div className="query-footer">
          <button 
            onClick={onContinue}
            className="continue-button"
          >
            <Play size={14} />
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default QueryInterface;
