'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PrivacyDisclaimer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Info Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-gray-50 hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        aria-label="Privacy information"
      >
        <svg
          className="w-4 h-4 sm:w-5 sm:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* Modal/Tooltip */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/10 z-40"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute top-10 sm:top-12 left-0 w-72 sm:w-80 bg-white rounded-xl shadow-lg p-4 sm:p-5 z-50 border border-gray-100"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Privacy & Data</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                This app processes data locally and does not save or record any information. 
                All processing happens in your browser and on our servers temporarily. 
                No data is stored or logged.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

