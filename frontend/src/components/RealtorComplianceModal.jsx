import React from 'react';

const RealtorComplianceModal = ({ onRestart }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 animate-slide-in">
        <div className="p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">
            Already Working with a Realtor?
          </h2>

          {/* Content */}
          <div className="space-y-4 mb-8">
            <p className="text-gray-700 text-center leading-relaxed">
              We appreciate your interest! However, <strong>you must continue working with your current realtor</strong> due to existing agreements and professional ethics.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 leading-relaxed">
                <strong>Important:</strong> If you no longer wish to work with your current realtor, please formally terminate your agreement with them first. Once that's complete, we'd love to help you find the perfect match!
              </p>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onRestart}
            className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            ← Go Back and Start Over
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            This ensures we maintain the highest ethical standards in real estate
          </p>
        </div>
      </div>
    </div>
  );
};

export default RealtorComplianceModal;
