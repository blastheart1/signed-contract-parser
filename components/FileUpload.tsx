'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PrivacyDisclaimer from './PrivacyDisclaimer';

type ProcessingStage = 'idle' | 'uploading' | 'parsing' | 'generating';

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [addAddendum, setAddAddendum] = useState(false);
  const [addendumLinks, setAddendumLinks] = useState<string>('');
  const [deleteExtraRows, setDeleteExtraRows] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.eml')) {
      setFile(droppedFile);
      setError(null);
      setSuccess(false);
    } else {
      setError('Please upload a .eml file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.eml')) {
      setFile(selectedFile);
      setError(null);
      setSuccess(false);
    } else {
      setError('Please select a .eml file');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProcessingStage('uploading');

    try {
      // Read file as base64
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1];
          
          setProcessingStage('parsing');
          
          const response = await fetch('/api/parse-contract', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file: base64Data,
              filename: file.name,
              addendumLinks: addAddendum && addendumLinks.trim() 
                ? addendumLinks.split('\n').map(link => link.trim()).filter(link => link.length > 0)
                : undefined,
              deleteExtraRows: deleteExtraRows,
            }),
          });

          setProcessingStage('generating');

          if (!response.ok) {
            let errorMessage = 'Failed to process contract';
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
              errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
          }

          // Get the blob from response
          const blob = await response.blob();
          
          // Extract filename from Content-Disposition header
          let filename = `contract-${Date.now()}.xlsx`;
          const contentDisposition = response.headers.get('Content-Disposition');
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
              let extractedFilename = filenameMatch[1].replace(/['"]/g, '');
              const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/i);
              if (filenameStarMatch && filenameStarMatch[1]) {
                try {
                  extractedFilename = decodeURIComponent(filenameStarMatch[1]);
                } catch (e) {
                  console.warn('Failed to decode filename from Content-Disposition header:', e);
                }
              }
              if (extractedFilename) {
                filename = extractedFilename;
              }
            }
          }
          
          // Create download link
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          setSuccess(true);
          setFile(null);
          setAddAddendum(false);
          setAddendumLinks('');
          setDeleteExtraRows(false);
          setProcessingStage('idle');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to process contract');
          setProcessingStage('idle');
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setIsProcessing(false);
        setProcessingStage('idle');
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsProcessing(false);
      setProcessingStage('idle');
    }
  };

  const getProcessingText = () => {
    switch (processingStage) {
      case 'uploading':
        return 'Uploading...';
      case 'parsing':
        return 'Parsing email...';
      case 'generating':
        return 'Generating spreadsheet...';
      default:
        return 'Processing...';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full max-w-2xl px-4 sm:px-6 lg:px-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 md:p-10 relative"
      >
        {/* Privacy Disclaimer */}
        <div className="absolute top-4 left-4 z-10">
          <PrivacyDisclaimer />
        </div>

        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-3 sm:mb-4 text-center mt-8 sm:mt-0"
        >
          Calimingo Contract Parser
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-sm sm:text-base text-gray-500 mb-8 sm:mb-10 text-center"
        >
          Upload a signed build contract .eml file to generate a spreadsheet
        </motion.p>

        {/* Drag and Drop Area */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all duration-300 ${
            isDragging
              ? 'border-blue-400 bg-blue-50/50 scale-[1.02]'
              : 'border-gray-200 hover:border-gray-300 bg-gray-50/30'
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {file ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-3 sm:space-y-4"
            >
              <div className="flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <svg
                    className="w-10 h-10 sm:w-12 sm:h-12 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </motion.div>
              </div>
              <p className="text-sm sm:text-base text-gray-700 font-medium">{file.name}</p>
              <p className="text-xs sm:text-sm text-gray-500">
                {(file.size / 1024).toFixed(2)} KB
              </p>
              <button
                onClick={() => {
                  setFile(null);
                  setError(null);
                  setSuccess(false);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="mt-2 text-xs sm:text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Remove file
              </button>
            </motion.div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              <div className="flex items-center justify-center">
                <motion.svg
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </motion.svg>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Drag and drop your .eml file here
              </p>
              <p className="text-xs sm:text-sm text-gray-400">or</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 sm:px-6 sm:py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm sm:text-base font-medium"
              >
                Browse Files
              </button>
            </div>
          )}
        </motion.div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".eml"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 sm:mt-5 p-3 sm:p-4 bg-red-50 border border-red-100 rounded-lg"
            >
              <p className="text-red-600 text-xs sm:text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Message */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 sm:mt-5 p-3 sm:p-4 bg-green-50 border border-green-100 rounded-lg"
            >
              <p className="text-green-600 text-xs sm:text-sm">
                Spreadsheet generated successfully! Download started.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Options */}
        <AnimatePresence>
          {file && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 sm:mt-8 flex flex-col items-center space-y-2.5 sm:space-y-3"
            >
              <div className="flex flex-col items-center gap-2.5 sm:gap-3 w-full max-w-xs ml-8 sm:ml-12 pl-11">
                {/* Add Addendum Toggle */}
                <label className="flex items-center gap-2.5 cursor-pointer w-full">
                  <input
                    type="checkbox"
                    checked={addAddendum}
                    onChange={(e) => {
                      setAddAddendum(e.target.checked);
                      if (!e.target.checked) {
                        setAddendumLinks('');
                      }
                    }}
                    className="w-4 h-4 sm:w-5 sm:h-5 text-gray-900 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 cursor-pointer flex-shrink-0"
                  />
                  <span className="text-sm sm:text-base text-gray-700">Add Addendum</span>
                </label>
                
                {/* Delete Extra Rows Toggle */}
                <label className="flex items-center gap-2.5 cursor-pointer w-full">
                  <input
                    type="checkbox"
                    checked={deleteExtraRows}
                    onChange={(e) => setDeleteExtraRows(e.target.checked)}
                    className="w-4 h-4 sm:w-5 sm:h-5 text-gray-900 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 cursor-pointer flex-shrink-0"
                  />
                  <span className="text-sm sm:text-base text-gray-700">Delete Extra Rows</span>
                </label>
              </div>
              
              {/* Addendum Links Textarea */}
              <AnimatePresence>
                {addAddendum && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 w-full max-w-2xl"
                  >
                    <label htmlFor="addendum-links" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Paste addendum links (one per line)
                    </label>
                    <textarea
                      id="addendum-links"
                      value={addendumLinks}
                      onChange={(e) => setAddendumLinks(e.target.value)}
                      placeholder="https://l1.prodbx.com/go/view/?35587.426.20251112100816&#10;https://l1.prodbx.com/go/view/?35279.426.20251020095021"
                      rows={4}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 resize-vertical text-xs sm:text-sm text-gray-700 placeholder-gray-400 transition-colors"
                    />
                    <p className="mt-1.5 text-xs text-gray-400">
                      Enter one link per line. Links will be processed in order.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Process Button */}
        <AnimatePresence>
          {file && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
              className="mt-6 sm:mt-8 flex justify-center"
            >
              <button
                onClick={handleUpload}
                disabled={isProcessing}
                className={`px-8 sm:px-10 py-3 sm:py-3.5 rounded-lg font-medium transition-all duration-200 min-h-[44px] text-sm sm:text-base ${
                  isProcessing
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <motion.svg
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </motion.svg>
                    {getProcessingText()}
                  </span>
                ) : (
                  'Generate Spreadsheet'
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-8 sm:mt-10 text-center text-xs sm:text-sm text-gray-400"
      >
        <p>
          App is still in testing phase. If you found bugs or suggestions, email me on:{' '}
          <a
            href="mailto:a.santos@calimingo.com"
            className="text-gray-600 hover:text-gray-900 hover:underline transition-colors"
          >
            a.santos@calimingo.com
          </a>
        </p>
      </motion.div>
    </motion.div>
  );
}
