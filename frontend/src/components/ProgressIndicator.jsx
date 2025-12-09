import React from 'react';

const ProgressIndicator = ({ currentStep, totalSteps }) => {
  const progress = (currentStep / totalSteps) * 100;
  
  return (
    <div className="w-full mb-8">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold text-navy">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm font-bold text-electric">
          {Math.round(progress)}%
        </span>
      </div>
      {/* Progress bar container - Pearl background */}
      <div className="w-full bg-pearl-300 rounded-full h-3 overflow-hidden shadow-inner">
        {/* Fill bar - Electric Blue gradient */}
        <div
          className="h-3 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-electric to-electric-600 shadow-md"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Step dots */}
      <div className="flex justify-between mt-3">
        {[...Array(totalSteps)].map((_, index) => (
          <div
            key={index}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              index < currentStep
                ? 'bg-electric scale-125 shadow-md shadow-electric/50'
                : index === currentStep - 1
                ? 'bg-electric-400 scale-110 shadow-sm shadow-electric/30'
                : 'bg-pearl-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default ProgressIndicator;
