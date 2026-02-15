import React, { useState } from 'react';
import DataPanel from './components/DataPanel';
import BrainVisualization from './components/BrainVisualization';
import QueryInterface from './components/QueryInterface';
import { categories, dataItems } from './data/memoryData';
import './App.css';

const App = () => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);

  const selectedCategory = categories.find(c => c.id === selectedNode);
  const selectedData = selectedNode ? dataItems[selectedNode] : null;

  return (
    <div className="app-container">
      <DataPanel 
        selectedCategory={selectedCategory}
        selectedData={selectedData}
      />
      
      <div className="main-content">
        <BrainVisualization 
          categories={categories}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
        />
        
        <QueryInterface 
          selectedOption={selectedOption}
          setSelectedOption={setSelectedOption}
        />
      </div>
    </div>
  );
};

export default App;
