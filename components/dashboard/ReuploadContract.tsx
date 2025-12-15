'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { StoredContract } from '@/lib/store/contractStore';

// Client-safe URL validation function
const validateAddendumUrl = (url: string): boolean => {
  try {
    const urlPattern = /^https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?/i;
    return urlPattern.test(url.trim());
  } catch {
    return false;
  }
};

// Extract addendum number from URL (fallback)
const extractAddendumNumberFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const queryParam = urlObj.search.substring(1);
    const parts = queryParam.split('.');
    if (parts.length > 0 && parts[0]) {
      return parts[0].trim();
    }
    const match = url.match(/[?&](\d+)\./);
    if (match && match[1]) {
      return match[1];
    }
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
};

type ProcessingStage = 'idle' | 'uploading' | 'parsing' | 'storing' | 'validating' | 'extracting';

type UploadMode = 'links' | 'eml';

interface LinkValidationResult {
  url: string;
  type: 'original' | 'addendum';
  isValid: boolean;
  error?: string;
  isChecking: boolean;
  addendumNumber?: string; // Addendum # from page
}

interface ExtractedLink {
  url: string;
  type: 'original' | 'addendum';
  selected: boolean;
  validation?: LinkValidationResult;
  addendumNumber?: string; // For sorting
}

interface ReuploadContractProps {
  contract: StoredContract;
  onSuccess?: () => void | Promise<void>; // Allow async callbacks
  onClose?: () => void;
}

export default function ReuploadContract({ contract, onSuccess, onClose }: ReuploadContractProps) {
  const [uploadMode, setUploadMode] = useState<UploadMode>('eml');
  
  // Common state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deleteExtraRows, setDeleteExtraRows] = useState(false);
  const [includeMainCategories, setIncludeMainCategories] = useState(true);
  const [includeSubcategories, setIncludeSubcategories] = useState(true);
  const [includeOriginalContract, setIncludeOriginalContract] = useState(false); // Default: unchecked
  
  // DBX Links Only mode state
  const [linksInput, setLinksInput] = useState(''); // Single textarea for all links
  const [linkValidationResults, setLinkValidationResults] = useState<LinkValidationResult[]>([]);
  const [isValidatingLinks, setIsValidatingLinks] = useState(false);
  
  // EML Upload mode state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extractedLinks, setExtractedLinks] = useState<ExtractedLink[]>([]);
  const [showExtractedLinks, setShowExtractedLinks] = useState(false);
  const [isExtractingLinks, setIsExtractingLinks] = useState(false);
  const [emlStep, setEmlStep] = useState<'upload' | 'select' | 'confirm'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate a single link (format, accessibility, and extract addendum number)
  const validateLink = async (url: string, type: 'original' | 'addendum'): Promise<LinkValidationResult> => {
    const result: LinkValidationResult = {
      url: url.trim(),
      type,
      isValid: false,
      isChecking: true,
    };

    // Validate format
    if (!validateAddendumUrl(url.trim())) {
      result.isValid = false;
      result.error = 'Invalid URL format. Expected: https://l1.prodbx.com/go/view/?...';
      result.isChecking = false;
      return result;
    }

    // Check accessibility and extract addendum number
    try {
      const response = await fetch('/api/validate-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const responseData = await response.json().catch(() => ({}));
      
      if (response.ok && responseData.valid === true) {
        result.isValid = true;
        // Extract addendum number from response if available
        if (responseData.addendumNumber) {
          result.addendumNumber = responseData.addendumNumber;
        } else if (type === 'addendum') {
          // Fallback to URL extraction
          result.addendumNumber = extractAddendumNumberFromUrl(url);
        }
      } else {
        result.isValid = false;
        result.error = responseData.error || responseData.message || `Failed to access link (${response.status})`;
        // Still try to extract from URL as fallback
        if (type === 'addendum') {
          result.addendumNumber = extractAddendumNumberFromUrl(url);
        }
      }
    } catch (err) {
      result.isValid = false;
      result.error = err instanceof Error ? err.message : 'Failed to validate link';
      // Fallback to URL extraction
      if (type === 'addendum') {
        result.addendumNumber = extractAddendumNumberFromUrl(url);
      }
    }

    result.isChecking = false;
    return result;
  };

  // Validate all links in DBX Links Only mode
  const handleValidateLinks = async () => {
    if (!linksInput.trim()) {
      setError('Please enter at least one link');
      return;
    }

    setIsValidatingLinks(true);
    setError(null);
    setProcessingStage('validating');

    try {
      const linksToValidate = linksInput
        .split('\n')
        .map(link => link.trim())
        .filter(link => link.length > 0);

      if (linksToValidate.length === 0) {
        setError('Please enter at least one link');
        setIsValidatingLinks(false);
        setProcessingStage('idle');
        return;
      }

      // Validate all links (no separation between original and addendums)
      const validationPromises = linksToValidate.map((url) => {
        // Try to determine type by checking if it's likely an original contract
        // For now, treat all as addendums since original contract is not required
        return validateLink(url, 'addendum');
      });
      
      const results = await Promise.all(validationPromises);

      setLinkValidationResults(results);

      // Check if all validations passed
      const allValid = results.every(r => r.isValid);
      if (!allValid) {
        const failedLinks = results.filter(r => !r.isValid);
        setError(`${failedLinks.length} link(s) failed validation. Please check the errors below.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate links');
    } finally {
      setIsValidatingLinks(false);
      setProcessingStage('idle');
    }
  };

  // Extract and validate links from .eml file in one step
  const handleExtractLinks = async () => {
    if (!file) return;

    setIsExtractingLinks(true);
    setIsValidatingLinks(true);
    setError(null);
    setProcessingStage('parsing');

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1];
          
          // Step 1: Extract links
          setProcessingStage('extracting');
          const response = await fetch('/api/extract-contract-links', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file: base64Data,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to extract links from .eml file');
          }

          const data = await response.json();
          
          if (!data.success || !data.links) {
            throw new Error('Failed to extract links from .eml file');
          }
          
          const extractedLinksData = data.links;

          const links: ExtractedLink[] = [];
          
          // Only add original contract link if includeOriginalContract is checked
          if (includeOriginalContract && extractedLinksData.originalContractUrl) {
            links.push({
              url: extractedLinksData.originalContractUrl,
              type: 'original',
              selected: false, // Default: unchecked for re-upload
            });
          }

          // Add all addendum links
          extractedLinksData.addendumUrls.forEach((url: string) => {
            links.push({
              url,
              type: 'addendum',
              selected: true, // Default: checked
              addendumNumber: extractAddendumNumberFromUrl(url), // Initial fallback
            });
          });

          // Step 2: Validate all links immediately
          setProcessingStage('validating');
          const validationPromises = links.map((link: ExtractedLink) => validateLink(link.url, link.type));
          const validationResults = await Promise.all(validationPromises);

          // Update links with validation results and addendum numbers
          const validatedLinks = links.map(link => {
            const validation = validationResults.find(r => r.url === link.url);
            if (validation) {
              return {
                ...link,
                validation,
                addendumNumber: validation.addendumNumber || link.addendumNumber, // Use validated number if available
              };
            }
            return link;
          });

          // Sort links by addendum number in ascending order
          const sortedLinks = sortLinksByAddendumNumber(validatedLinks);

          setExtractedLinks(sortedLinks);
          setShowExtractedLinks(true);
          setEmlStep('select');
          setIsExtractingLinks(false);
          setIsValidatingLinks(false);
          setProcessingStage('idle');
          
          // Check if any validations failed
          const failedValidations = validationResults.filter(r => !r.isValid);
          if (failedValidations.length > 0) {
            setError(`${failedValidations.length} link(s) failed validation. Please check the errors below.`);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to extract and validate links');
          setIsExtractingLinks(false);
          setIsValidatingLinks(false);
          setProcessingStage('idle');
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setIsExtractingLinks(false);
        setIsValidatingLinks(false);
        setProcessingStage('idle');
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract links');
      setIsExtractingLinks(false);
      setIsValidatingLinks(false);
      setProcessingStage('idle');
    }
  };

  // Validate selected links in EML mode
  const handleValidateSelectedLinks = async () => {
    const selectedLinks = extractedLinks.filter(link => link.selected);
    
    if (selectedLinks.length === 0) {
      setError('Please select at least one link to process');
      return;
    }

    setIsValidatingLinks(true);
    setError(null);
    setProcessingStage('validating');

    try {
      // Validate each selected link
      const validationPromises = selectedLinks.map((link: ExtractedLink) => validateLink(link.url, link.type));
      const results = await Promise.all(validationPromises);

      // Update extractedLinks with validation results and addendum numbers
      const updatedLinks = extractedLinks.map(link => {
        const validation = results.find(r => r.url === link.url);
        if (validation) {
          return {
            ...link,
            validation,
            addendumNumber: validation.addendumNumber || link.addendumNumber,
          };
        }
        return link;
      });

      setExtractedLinks(updatedLinks);

      // Check if all validations passed
      const allValid = results.every(r => r.isValid);
      if (!allValid) {
        const failedLinks = results.filter(r => !r.isValid);
        setError(`${failedLinks.length} selected link(s) failed validation. Please check the errors below.`);
      } else {
        setEmlStep('confirm');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate links');
    } finally {
      setIsValidatingLinks(false);
      setProcessingStage('idle');
    }
  };

  // Sort links by addendum number in ascending order
  const sortLinksByAddendumNumber = (links: ExtractedLink[]): ExtractedLink[] => {
    return [...links].sort((a, b) => {
      // Original contract links go first
      if (a.type === 'original' && b.type !== 'original') return -1;
      if (a.type !== 'original' && b.type === 'original') return 1;
      
      // For addendums, sort by number in ascending order
      if (a.type === 'addendum' && b.type === 'addendum') {
        const numA = parseInt(a.addendumNumber || '0', 10);
        const numB = parseInt(b.addendumNumber || '0', 10);
        return numA - numB; // Ascending order
      }
      
      return 0;
    });
  };

  // Handle file upload in EML mode
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.eml')) {
      setFile(droppedFile);
      setError(null);
      setExtractedLinks([]);
      setShowExtractedLinks(false);
      setEmlStep('upload');
      setIsValidatingLinks(false);
      setProcessingStage('idle');
    } else {
      setError('Please upload a .eml file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.eml')) {
      setFile(selectedFile);
      setError(null);
      setExtractedLinks([]);
      setShowExtractedLinks(false);
      setEmlStep('upload');
      setIsValidatingLinks(false);
      setProcessingStage('idle');
    } else {
      setError('Please select a .eml file');
      setIsValidatingLinks(false);
      setProcessingStage('idle');
    }
  };

  // Handle final parsing/upload
  const handleParseContract = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      if (uploadMode === 'links') {
        // DBX Links Only mode
        const selectedLinks = linkValidationResults.filter(r => r.isValid);
        
        if (selectedLinks.length === 0) {
          setError('Please validate and select at least one valid link');
          setIsProcessing(false);
          return;
        }

        // Separate original contract and addendums (if any)
        const originalContractLink = selectedLinks.find(l => l.type === 'original');
        const addendumLinks = selectedLinks
          .filter(l => l.type === 'addendum')
          .map(l => l.url);

        // Process contract
        setProcessingStage('parsing');
        
        const response = await fetch('/api/parse-contract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: 'links',
            originalContractUrl: originalContractLink?.url || undefined,
            addendumLinks: addendumLinks.length > 0 ? addendumLinks : undefined,
            includeOriginalContract: !!originalContractLink,
            existingContractId: contract.id,
            deleteExtraRows: deleteExtraRows,
            includeMainCategories: includeMainCategories,
            includeSubcategories: includeSubcategories,
            returnData: true,
          }),
        });

        await handleParseResponse(response);
      } else {
        // EML Upload mode
        if (!file) {
          setError('Please select a file first');
          setIsProcessing(false);
          return;
        }

        const selectedLinks = extractedLinks.filter(link => link.selected);
        
        if (selectedLinks.length === 0) {
          setError('Please select at least one link to process');
          setIsProcessing(false);
          return;
        }

        // Separate original contract and addendums
        const originalContractLink = selectedLinks.find(l => l.type === 'original');
        const addendumLinks = selectedLinks
          .filter(l => l.type === 'addendum')
          .map(l => l.url);

        setProcessingStage('parsing');

        const reader = new FileReader();
        
        reader.onload = async (e) => {
          try {
            const result = e.target?.result as string;
            const base64Data = result.split(',')[1];
            
            const response = await fetch('/api/parse-contract', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                mode: 'eml',
                file: base64Data,
                filename: file.name,
                originalContractUrl: originalContractLink?.url,
                addendumLinks: addendumLinks.length > 0 ? addendumLinks : undefined,
                includeOriginalContract: !!originalContractLink,
                existingContractId: contract.id,
                deleteExtraRows: deleteExtraRows,
                includeMainCategories: includeMainCategories,
                includeSubcategories: includeSubcategories,
                returnData: true,
              }),
            });

            await handleParseResponse(response);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process contract');
            setProcessingStage('idle');
            setIsProcessing(false);
          }
        };

        reader.onerror = () => {
          setError('Failed to read file');
          setIsProcessing(false);
          setProcessingStage('idle');
        };

        reader.readAsDataURL(file);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process contract');
      setIsProcessing(false);
      setProcessingStage('idle');
    }
  };

  // Handle API response and update contract
  const handleParseResponse = async (dataResponse: Response) => {
    setProcessingStage('storing');

    if (!dataResponse.ok) {
      let errorMessage = 'Failed to process contract';
      try {
        const errorData = await dataResponse.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        errorMessage = dataResponse.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const dataResult = await dataResponse.json();
    
    if (!dataResult.success || !dataResult.data) {
      throw new Error('Failed to parse contract data');
    }

    const { items, addendums } = dataResult.data;
    
    // Items are already merged by the API if existingContractId was provided
    // The API adds: existing items + 1 blank row + new addendum items
    // So we can use items directly
    const allItems: any[] = items;

    // Update contract via PUT
    const updatedContract = {
      ...contract,
      items: allItems,
    };

    try {
      const updateResponse = await fetch(`/api/contracts/${contract.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedContract),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update contract');
      }

      // Success - refresh and close
      // onSuccess handles both data refresh and dialog closing, so we await it
      // to ensure the dialog stays open until refresh completes
      if (onSuccess) {
        await onSuccess();
      }
      // Note: onClose is not called here since onSuccess already handles closing the dialog
    } catch (updateError) {
      throw new Error(`Failed to update contract: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
    }
  };

  const getProcessingText = () => {
    switch (processingStage) {
      case 'uploading':
        return 'Uploading...';
      case 'parsing':
        return 'Parsing contract...';
      case 'storing':
        return 'Updating contract...';
      case 'validating':
        return 'Validating links...';
      case 'extracting':
        return 'Extracting links...';
      default:
        return 'Processing...';
    }
  };

  const handleAreaClick = () => {
    if (!file && fileInputRef.current && uploadMode === 'eml') {
      fileInputRef.current.click();
    }
  };

  // Reset state when switching modes
  const handleModeChange = (mode: UploadMode) => {
    setUploadMode(mode);
    setError(null);
    setFile(null);
    setLinksInput('');
    setLinkValidationResults([]);
    setExtractedLinks([]);
    setShowExtractedLinks(false);
    setEmlStep('upload');
    setIsValidatingLinks(false);
    setProcessingStage('idle');
    setIsExtractingLinks(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get sorted links for display
  const sortedExtractedLinks = sortLinksByAddendumNumber(extractedLinks);
  const sortedValidationResults = [...linkValidationResults].sort((a, b) => {
    if (a.type === 'original' && b.type !== 'original') return -1;
    if (a.type !== 'original' && b.type === 'original') return 1;
    if (a.type === 'addendum' && b.type === 'addendum') {
      const numA = parseInt(a.addendumNumber || '0', 10);
      const numB = parseInt(b.addendumNumber || '0', 10);
      return numA - numB; // Ascending order
    }
    return 0;
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode Selection */}
      <Tabs value={uploadMode} onValueChange={(value) => handleModeChange(value as UploadMode)} className="flex flex-col h-full min-h-0 flex-1">
        <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
          <TabsTrigger value="links" className="data-[state=active]:bg-primary data-[state=active]:text-white">DBX Links Only</TabsTrigger>
          <TabsTrigger value="eml" className="data-[state=active]:bg-primary data-[state=active]:text-white">EML Upload</TabsTrigger>
        </TabsList>

        {/* DBX Links Only Mode */}
        <TabsContent value="links" className="overflow-y-auto mt-3 max-h-[500px]">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="links-input">DBX Links (one per line)</Label>
              <Textarea
                id="links-input"
                value={linksInput}
                onChange={(e) => setLinksInput(e.target.value)}
                placeholder={`https://l1.prodbx.com/go/view/?35587.426.20251112100816
https://l1.prodbx.com/go/view/?35279.426.20251020095021`}
                style={{ height: "200px" }}
              />
              <p className="text-xs text-muted-foreground">
                Paste all links here. Original Contract is not required for re-upload.
              </p>
            </div>

            <Button
              onClick={handleValidateLinks}
              disabled={!linksInput.trim() || isValidatingLinks}
              variant="outline"
              className="w-full"
            >
              {isValidatingLinks ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating Links...
                </>
              ) : (
                <>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Validate Links
                </>
              )}
            </Button>

            {/* Validation Results - sorted by addendum number descending */}
            {sortedValidationResults.length > 0 && (
              <div className="space-y-2 border rounded-lg p-3 mt-3 max-h-[300px] overflow-y-auto">
                <Label className="text-sm font-medium">Validation Results:</Label>
                <div className="space-y-2">
                  {sortedValidationResults.map((result, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      {result.isChecking ? (
                        <Loader2 className="h-4 w-4 animate-spin mt-0.5 text-muted-foreground" />
                      ) : result.isValid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {result.type === 'original' 
                              ? 'Original Contract' 
                              : result.addendumNumber 
                                ? `Addendum #${result.addendumNumber}` 
                                : `Addendum ${index}`}:
                          </span>
                          {result.isValid && <span className="text-green-600">Valid</span>}
                        </div>
                        <div className="text-xs text-muted-foreground break-all">{result.url}</div>
                        {result.error && (
                          <div className="text-xs text-red-600 mt-1">{result.error}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Options */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={includeMainCategories}
                  onCheckedChange={(checked) => setIncludeMainCategories(checked === true)}
                />
                <span className="text-sm">Include Main Categories</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={includeSubcategories}
                  onCheckedChange={(checked) => setIncludeSubcategories(checked === true)}
                />
                <span className="text-sm">Include Subcategories</span>
              </label>
            </div>

            {/* Process Button */}
            {sortedValidationResults.length > 0 && sortedValidationResults.every(r => r.isValid) && (
              <Button
                onClick={handleParseContract}
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {getProcessingText()}
                  </>
                ) : (
                  'Add Addendums to Contract'
                )}
              </Button>
            )}
          </div>
        </TabsContent>

        {/* EML Upload Mode */}
        <TabsContent value="eml" className="mt-3 flex flex-col min-h-0">
          {emlStep === 'upload' && (
            <div className="space-y-3 flex flex-col h-full">
              {/* Include Original Contract Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={includeOriginalContract}
                  onCheckedChange={(checked) => setIncludeOriginalContract(checked === true)}
                />
                <span className="text-sm">Include Original Contract (not required)</span>
              </label>

              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-300 flex-shrink-0 ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                } ${!file ? 'cursor-pointer' : ''}`}
                style={{ height: '300px', marginTop: '12px' }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                onDrop={handleDrop}
                onClick={handleAreaClick}
              >
                {file ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col justify-center items-center h-full space-y-2"
                  >
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-center">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setError(null);
                        setExtractedLinks([]);
                        setShowExtractedLinks(false);
                        setEmlStep('upload');
                        setIsValidatingLinks(false);
                        setProcessingStage('idle');
                        setIsExtractingLinks(false);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      Remove file
                    </Button>
                  </motion.div>
                ) : (
                  <div className="flex flex-col justify-center items-center h-full space-y-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-primary font-medium">Click to upload</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        or drag and drop • EML files only
                      </p>
                    </div>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".eml"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* Extract and Validate Links Button */}
              {file && (
                <Button
                  onClick={handleExtractLinks}
                  disabled={isExtractingLinks || isValidatingLinks}
                  variant="outline"
                  className="w-full"
                >
                  {(isExtractingLinks || isValidatingLinks) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {processingStage === 'extracting' ? 'Extracting Links...' : processingStage === 'validating' ? 'Validating Links...' : 'Processing...'}
                    </>
                  ) : (
                    <>
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Extract & Validate Links
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Step 2: Link Selection - sorted by addendum number descending */}
          {emlStep === 'select' && showExtractedLinks && sortedExtractedLinks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col h-full min-h-0"
            >
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <Label className="text-base font-semibold">Detected Links (Step 2)</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExtractedLinks(extractedLinks.map(l => ({ ...l, selected: true })));
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExtractedLinks(extractedLinks.map(l => ({ ...l, selected: false })));
                    }}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto pr-2 flex-1 min-h-0 mb-3">
                {sortedExtractedLinks.map((link, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={link.selected}
                      onCheckedChange={(checked) => {
                        // Fix: Only update the specific link, not all links above it
                        setExtractedLinks(extractedLinks.map(l => 
                          l.url === link.url ? { ...l, selected: checked === true } : l
                        ));
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {link.type === 'original' 
                            ? 'Original Contract' 
                            : link.addendumNumber 
                              ? `Addendum #${link.addendumNumber}` 
                              : `Addendum`}:
                        </span>
                        {link.validation && (
                          <>
                            {link.validation.isChecking ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : link.validation.isValid ? (
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-600" />
                            )}
                          </>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground break-all">{link.url}</div>
                      {link.validation?.error && (
                        <div className="text-xs text-red-600 mt-1">{link.validation.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmlStep('upload');
                    setShowExtractedLinks(false);
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    // Links are already validated, check if selected links are valid and proceed
                    const selectedLinks = sortedExtractedLinks.filter(l => l.selected);
                    if (selectedLinks.length === 0) {
                      setError('Please select at least one link to process');
                      return;
                    }
                    
                    const allValid = selectedLinks.every(l => l.validation?.isValid === true);
                    if (!allValid) {
                      setError('Some selected links failed validation. Please fix errors or deselect them.');
                      return;
                    }
                    
                    // All selected links are valid, proceed to confirmation
                    setEmlStep('confirm');
                  }}
                  disabled={sortedExtractedLinks.filter(l => l.selected).length === 0}
                  className="flex-1"
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirmation */}
          {emlStep === 'confirm' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label className="text-base font-semibold">Ready to Process</Label>
                <p className="text-sm text-muted-foreground">
                  {sortedExtractedLinks.filter(l => l.selected).length} link(s) selected and validated.
                </p>
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={includeMainCategories}
                    onCheckedChange={(checked) => setIncludeMainCategories(checked === true)}
                  />
                  <span className="text-sm">Include Main Categories</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={includeSubcategories}
                    onCheckedChange={(checked) => setIncludeSubcategories(checked === true)}
                  />
                  <span className="text-sm">Include Subcategories</span>
                </label>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEmlStep('select')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleParseContract}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {getProcessingText()}
                    </>
                  ) : (
                    'Add Addendums to Contract'
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg"
          >
            <p className="text-red-600 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
