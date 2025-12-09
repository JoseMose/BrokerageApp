import React from 'react';

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
      <div className="relative">
        {/* Outer ring - Pearl */}
        <div className="w-20 h-20 border-4 border-pearl-300 rounded-full"></div>
        {/* Spinning gradient ring - Electric Blue */}
        <div className="absolute top-0 left-0 w-20 h-20 border-4 border-transparent border-t-electric border-r-electric-400 rounded-full animate-spin"></div>
        {/* Center dot - Electric pulse */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-r from-electric to-electric-600 rounded-full animate-pulse-slow shadow-lg shadow-electric/50"></div>
      </div>
      <p className="mt-6 text-lg font-medium text-navy-600 animate-pulse">
        {message}
      </p>
      <p className="mt-2 text-sm text-slate">
        This will only take a moment...
      </p>
    </div>
  );
};

export default LoadingSpinner;
