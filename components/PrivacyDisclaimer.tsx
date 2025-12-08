'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

export default function PrivacyDisclaimer() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position tooltip above and to the left of the button so it doesn't block it
      setPosition({
        top: rect.top - 8, // Position above the button with some spacing
        right: window.innerWidth - rect.right + 40, // Offset to the left so button is still accessible
      });
    }
  }, [isOpen]);

  return (
    <>
      {/* Info Icon */}
      <div
        ref={buttonRef}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="relative"
      >
        <button
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
      </div>

      {/* Tooltip - Rendered in portal to escape modal overflow */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={tooltipRef}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              onMouseEnter={() => setIsOpen(true)}
              onMouseLeave={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                top: `${position.top}px`,
                right: `${position.right}px`,
                transform: 'translateY(-100%)', // Position above the button
              }}
              className="w-72 sm:w-80 bg-white rounded-xl shadow-lg p-4 sm:p-5 z-[100] border border-gray-100 pointer-events-auto"
            >
              <div className="mb-3">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Privacy & Data</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                This app processes data locally and does not save or record any information. 
                All processing happens in your browser and on our servers temporarily. 
                No data is stored or logged.
              </p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

