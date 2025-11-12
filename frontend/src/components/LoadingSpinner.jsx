import React from 'react';

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
      <div className="relative">
        {/* Outer ring */}
        <div className="w-20 h-20 border-4 border-primary-200 rounded-full"></div>
        {/* Spinning gradient ring */}
        <div className="absolute top-0 left-0 w-20 h-20 border-4 border-transparent border-t-primary-500 border-r-secondary-500 rounded-full animate-spin"></div>
        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full animate-pulse"></div>
      </div>
      <p className="mt-6 text-lg font-medium text-gray-700 animate-pulse">
        {message}
      </p>
      <p className="mt-2 text-sm text-gray-500">
        This will only take a moment...
      </p>
    </div>
  );
};

export default LoadingSpinner;
