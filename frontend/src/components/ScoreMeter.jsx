import React from 'react';
import { getScoreColor, getScoreLabel } from '../utils/helpers';
import './ScoreMeter.css';

function ScoreMeter({ score }) {
  const percentage = (score / 10) * 100;
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="score-meter">
      <div className="score-display">
        <div className="score-number" style={{ color }}>
          {score}<span className="score-max">/10</span>
        </div>
        <div className="score-label">{label}</div>
      </div>
      
      <div className="score-bar-container">
        <div 
          className="score-bar-fill" 
          style={{ 
            width: `${percentage}%`,
            backgroundColor: color 
          }}
        />
      </div>
      
      <div className="score-markers">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((marker) => (
          <div key={marker} className="score-marker">
            {marker}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ScoreMeter;
