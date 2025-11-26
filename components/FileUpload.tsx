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
  const [successMessage, setSuccessMessage] = useState<string>('Spreadsheet generated successfully! Download started.');
  const [successMessageType, setSuccessMessageType] = useState<'success' | 'warning' | 'error'>('success');
  const [addAddendum, setAddAddendum] = useState(false);
  const [addendumLinks, setAddendumLinks] = useState<string>('');
  const [deleteExtraRows, setDeleteExtraRows] = useState(false);
  const [includeMainCategories, setIncludeMainCategories] = useState(true);
  const [includeSubcategories, setIncludeSubcategories] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
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
      setSuccessMessage('Spreadsheet generated successfully! Download started.');
      setSuccessMessageType('success');
      setBlobUrl(null); // Clear blob URL when selecting new file
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
      setSuccessMessage('Spreadsheet generated successfully! Download started.');
      setSuccessMessageType('success');
      setBlobUrl(null); // Clear blob URL when selecting new file
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
    setSuccessMessage('Spreadsheet generated successfully! Download started.');
    setSuccessMessageType('success');
    setBlobUrl(null); // Clear blob URL when starting new upload
    setProcessingStage('uploading');

    try {
      // Read file as base64
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1];
          
          setProcessingStage('parsing');
          
          // Generate spreadsheet (original production behavior)
          const response = await fetch('/api/parse-contract', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file: base64Data,
              filename: file.name,
              addAddendum: addAddendum,
              addendumLinks: addAddendum && addendumLinks.trim() 
                ? addendumLinks.split('\n').map(link => link.trim()).filter(link => link.length > 0)
                : undefined,
              deleteExtraRows: deleteExtraRows,
              includeMainCategories: includeMainCategories,
              includeSubcategories: includeSubcategories,
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
          
          // Extract processing summary from header
          const processingSummaryHeader = response.headers.get('X-Processing-Summary');
          let processingSummary: any = null;
          if (processingSummaryHeader) {
            try {
              processingSummary = JSON.parse(processingSummaryHeader);
            } catch (e) {
              console.warn('Failed to parse processing summary:', e);
            }
          }
          
          // Extract blob URL from header for Google Sheets import
          const extractedBlobUrl = response.headers.get('X-Blob-Url');
          console.log('[FileUpload] Extracted blob URL from header:', extractedBlobUrl);
          
          // Store blob URL in state for manual button
          if (extractedBlobUrl) {
            setBlobUrl(extractedBlobUrl);
            console.log('[FileUpload] Blob URL set in state:', extractedBlobUrl);
          } else {
            console.warn('[FileUpload] No blob URL found in response headers');
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

          // Build success/warning/error message based on processing summary
          let message = 'Spreadsheet generated successfully! Download started.';
          let messageType: 'success' | 'warning' | 'error' = 'success';
          
          if (processingSummary) {
            const successItems: string[] = [];
            const warnings: string[] = [];
            const errors: string[] = [];
            
            // Extract successful Original Contract
            if (processingSummary.originalContract.status === 'success' && processingSummary.originalContract.url) {
              successItems.push(`**Original Contract:**\n- ${processingSummary.originalContract.url}`);
            }
            
            // Extract successful Addendums
            const successfulAddendums = processingSummary.addendums.filter((a: any) => a.status === 'success');
            if (successfulAddendums.length > 0) {
              successItems.push(`**Addendums (${successfulAddendums.length}):**\n${successfulAddendums.map((a: any) => `- ${a.url}`).join('\n')}`);
            }
            
            // Check Original Contract status
            if (processingSummary.originalContract.status === 'failed') {
              // Extract just the error reason (remove wrapper messages)
              let errorReason = processingSummary.originalContract.error || 'Unknown error';
              // Remove "Failed to fetch addendum HTML: " prefix if present
              errorReason = errorReason.replace(/^Failed to fetch addendum HTML: /, '');
              warnings.push(`**Original Contract link failed:** ${errorReason}. Using email data instead.`);
            }
            
            // Check Addendums status
            const failedAddendums = processingSummary.addendums.filter((a: any) => a.status === 'failed');
            if (failedAddendums.length > 0) {
              // Extract simplified error messages
              const failedItems = failedAddendums.map((a: any) => {
                let errorReason = a.error || 'Unknown error';
                // Remove wrapper messages like "All addendum URLs failed to process. Errors: " or "Failed to process addendum URL ...: "
                errorReason = errorReason.replace(/^All addendum URLs failed to process\. Errors: /, '');
                errorReason = errorReason.replace(/^Failed to process addendum URL [^:]+: /, '');
                // Extract the actual error (usually starts with "Failed to parse addendum" or similar)
                const actualErrorMatch = errorReason.match(/Failed to parse addendum \d+: (.+)/);
                if (actualErrorMatch) {
                  errorReason = actualErrorMatch[1];
                }
                return {
                  url: a.url,
                  error: errorReason
                };
              });
              
              if (failedAddendums.length === processingSummary.addendums.length) {
                errors.push(`**All ${failedAddendums.length} addendum(s) failed to process.**\n\nFailed links:\n${failedItems.map((item: any) => `- ${item.url}`).join('\n')}\n\nErrors:\n${failedItems.map((item: any) => `- ${item.error}`).join('\n')}`);
                messageType = 'error';
              } else {
                warnings.push(`**${failedAddendums.length} out of ${processingSummary.addendums.length} addendum(s) failed.**\n\nFailed links:\n${failedItems.map((item: any) => `- ${item.url}`).join('\n')}\n\nErrors:\n${failedItems.map((item: any) => `- ${item.error}`).join('\n')}`);
              }
            }
            
            // Build message with success items first
            let messageParts: string[] = [];
            
            if (successItems.length > 0) {
              messageParts.push(`**Successfully processed:**\n\n${successItems.join('\n\n')}`);
            }
            
            if (errors.length > 0) {
              messageParts.push(`**Errors:**\n\n${errors.join('\n\n')}`);
              messageType = 'error';
            } else if (warnings.length > 0) {
              messageParts.push(`**Warnings:**\n\n${warnings.join('\n\n')}`);
              messageType = 'warning';
            }
            
            if (messageParts.length > 0) {
              message = messageParts.join('\n\n');
              if (messageType !== 'success') {
                message += '\n\nPlease check the .eml file and verify the links are accessible.';
              } else {
                message += '\n\nDownload started.';
              }
            } else if (processingSummary.summary.totalLinks > 0) {
              message = `**Spreadsheet generated successfully!**\n\nProcessed ${processingSummary.summary.successful} out of ${processingSummary.summary.totalLinks} link(s). Download started.`;
              messageType = 'success';
            }
          }

          setSuccessMessage(message);
          setSuccessMessageType(messageType);
          setSuccess(true);
          setFile(null);
          setAddAddendum(false);
          setAddendumLinks('');
          setDeleteExtraRows(false);
          setProcessingStage('idle');
          // Don't clear blobUrl - keep it for the manual button
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to process contract');
          setProcessingStage('idle');
          setSuccessMessageType('error');
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setIsProcessing(false);
        setProcessingStage('idle');
        setSuccessMessageType('error');
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
          Contract Parser
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
                  setSuccessMessage('Spreadsheet generated successfully! Download started.');
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
              className={`mt-4 sm:mt-5 p-4 sm:p-5 rounded-lg border ${
                successMessageType === 'error'
                  ? 'bg-red-50 border-red-200'
                  : successMessageType === 'warning'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-green-50 border-green-100'
              }`}
            >
              <div className="text-xs sm:text-sm whitespace-pre-line leading-relaxed space-y-2">
                {(() => {
                  const lines = successMessage.split('\n');
                  let currentSection: 'success' | 'error' | 'warning' | 'default' = 'default';
                  
                  return lines.map((line, index) => {
                    // Detect section headers
                    if (line.includes('Successfully processed:')) {
                      currentSection = 'success';
                    } else if (line.includes('Errors:')) {
                      currentSection = 'error';
                    } else if (line.includes('Warnings:')) {
                      currentSection = 'warning';
                    }
                    
                    // Determine color based on current section
                    let textColor = '';
                    if (currentSection === 'success') {
                      textColor = 'text-green-700';
                    } else if (currentSection === 'error') {
                      textColor = 'text-red-800';
                    } else if (currentSection === 'warning') {
                      textColor = 'text-yellow-800';
                    } else {
                      // Default color based on message type
                      textColor = successMessageType === 'error'
                        ? 'text-red-800'
                        : successMessageType === 'warning'
                        ? 'text-yellow-800'
                        : 'text-green-700';
                    }
                  
                  // Helper function to render text with clickable URLs
                  const renderTextWithLinks = (text: string, className: string) => {
                    // URL pattern for ProDBX links
                    const urlPattern = /(https?:\/\/[^\s<>]+)/g;
                    const parts: (string | JSX.Element)[] = [];
                    let lastIndex = 0;
                    let match;
                    
                    while ((match = urlPattern.exec(text)) !== null) {
                      // Add text before URL
                      if (match.index > lastIndex) {
                        parts.push(text.substring(lastIndex, match.index));
                      }
                      // Add clickable URL
                      parts.push(
                        <a
                          key={`url-${match.index}`}
                          href={match[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:opacity-80 transition-opacity"
                        >
                          {match[0]}
                        </a>
                      );
                      lastIndex = match.index + match[0].length;
                    }
                    // Add remaining text
                    if (lastIndex < text.length) {
                      parts.push(text.substring(lastIndex));
                    }
                    
                    // If no URLs found, return original text
                    if (parts.length === 0) {
                      return text;
                    }
                    
                    return <>{parts}</>;
                  };
                  
                  // Handle bold text (**text**)
                  if (line.startsWith('**') && line.endsWith('**')) {
                    const text = line.replace(/\*\*/g, '');
                    return (
                      <p key={index} className={`font-semibold mt-2 first:mt-0 ${textColor}`}>
                        {renderTextWithLinks(text, textColor)}
                      </p>
                    );
                  }
                  // Handle list items (- item)
                  if (line.trim().startsWith('- ')) {
                    const text = line.trim();
                    return (
                      <p key={index} className={`ml-4 ${textColor}`}>
                        {renderTextWithLinks(text, textColor)}
                      </p>
                    );
                  }
                  // Handle empty lines
                  if (line.trim() === '') {
                    return <br key={index} />;
                  }
                  // Regular text
                  const text = line.replace(/\*\*/g, '');
                  return (
                    <p key={index} className={`${index === 0 ? 'font-semibold' : ''} ${textColor}`}>
                      {renderTextWithLinks(text, textColor)}
                    </p>
                  );
                  });
                })()}
          </div>
          
          {/* Open with Google Sheets Button */}
          {blobUrl && successMessageType !== 'error' && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => {
                  console.log('[FileUpload] Opening Google Sheets with blob URL:', blobUrl);
                  const googleDriveViewerUrl = `https://drive.google.com/viewerng/viewer?url=${encodeURIComponent(blobUrl)}`;
                  window.open(googleDriveViewerUrl, '_blank', 'noopener,noreferrer');
                }}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open with Google Sheets
              </button>
            </div>
          )}
          
          {/* Debug: Show blob URL status */}
          {success && !blobUrl && successMessageType !== 'error' && (
            <div className="mt-2 text-xs text-gray-500 text-center">
              Note: Google Sheets option unavailable (blob upload may have failed)
            </div>
          )}
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
              <div className="w-full flex justify-center">
                {/* 2x2 Checkbox Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:gap-x-8 sm:gap-y-4">
                  {/* Row 1, Col 1: Add Addendum */}
                  <label className="flex items-center gap-2.5 cursor-pointer whitespace-nowrap">
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
                  
                  {/* Row 1, Col 2: Delete Extra Rows */}
                  <label className="flex items-center gap-2.5 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={deleteExtraRows}
                      onChange={(e) => setDeleteExtraRows(e.target.checked)}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-gray-900 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 cursor-pointer flex-shrink-0"
                    />
                    <span className="text-sm sm:text-base text-gray-700">Delete Extra Rows</span>
                  </label>
                  
                  {/* Row 2, Col 1: Include Main Categories */}
                  <label className="flex items-center gap-2.5 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={includeMainCategories}
                      onChange={(e) => setIncludeMainCategories(e.target.checked)}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-gray-900 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 cursor-pointer flex-shrink-0"
                    />
                    <span className="text-sm sm:text-base text-gray-700">Include Main Categories</span>
                  </label>
                  
                  {/* Row 2, Col 2: Include Subcategories */}
                  <label className="flex items-center gap-2.5 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={includeSubcategories}
                      onChange={(e) => setIncludeSubcategories(e.target.checked)}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-gray-900 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 cursor-pointer flex-shrink-0"
                    />
                    <span className="text-sm sm:text-base text-gray-700">Include Subcategories</span>
              </label>
                  
                </div>
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

