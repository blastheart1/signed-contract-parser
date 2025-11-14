'use client';

import { useState, useRef } from 'react';

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [applyFormatting, setApplyFormatting] = useState(false);
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

    try {
      // Read file as base64
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1]; // Remove data:application/octet-stream;base64, prefix
          
          const response = await fetch('/api/parse-contract', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file: base64Data,
              filename: file.name,
              applyFormatting: applyFormatting,
            }),
          });

          if (!response.ok) {
            // Try to get error message, but handle if response is not JSON
            let errorMessage = 'Failed to process contract';
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
              errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
          }

          // Get the blob from response (always treat as blob for Excel file)
          const blob = await response.blob();
          
          // Extract filename from Content-Disposition header
          let filename = `contract-${Date.now()}.xlsx`; // Fallback filename
          const contentDisposition = response.headers.get('Content-Disposition');
          if (contentDisposition) {
            // Try to extract filename from Content-Disposition header
            // Format: attachment; filename="filename.xlsx"; filename*=UTF-8''filename.xlsx
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
              // Remove quotes if present
              let extractedFilename = filenameMatch[1].replace(/['"]/g, '');
              // Handle RFC 5987 encoded filename (filename*=UTF-8''encoded)
              const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/i);
              if (filenameStarMatch && filenameStarMatch[1]) {
                try {
                  extractedFilename = decodeURIComponent(filenameStarMatch[1]);
                } catch (e) {
                  // If decoding fails, use the regular filename
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
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to process contract');
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setIsProcessing(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Calimingo Contract Parser
        </h1>
        
        <p className="text-gray-600 mb-6 text-center">
          Upload a signed build contract .eml file to generate a spreadsheet
        </p>

        {/* Drag and Drop Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-green-500"
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
              </div>
              <p className="text-gray-700 font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <svg
                  className="w-16 h-16 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <p className="text-gray-600">
                Drag and drop your .eml file here
              </p>
              <p className="text-sm text-gray-500">or</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse Files
              </button>
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".eml"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600 text-sm">
              Spreadsheet generated successfully! Download started.
            </p>
          </div>
        )}

        {/* Formatting Toggle */}
        {file && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyFormatting}
                onChange={(e) => setApplyFormatting(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700">Apply Formatting</span>
            </label>
          </div>
        )}

        {/* Process Button */}
        {file && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleUpload}
              disabled={isProcessing}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              {isProcessing ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Generate Spreadsheet'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

