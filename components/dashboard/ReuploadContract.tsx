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

interface DetectedSection {
  type: 'original' | 'optional-package' | 'addendum';
  number?: number;
  name?: string;
  selected?: boolean; // Default selection state
}

interface LinkValidationResult {
  url: string;
  type?: 'original' | 'optional-package' | 'addendum'; // NEW: Optional field, detected from API (for backward compatibility)
  number?: number; // NEW: Package number or addendum number (for backward compatibility)
  name?: string; // NEW: Optional package name (for backward compatibility)
  sections?: DetectedSection[]; // NEW: Array of all detected sections in this link
  isValid: boolean; // EXISTING
  error?: string; // EXISTING
  isChecking: boolean; // EXISTING
  addendumNumber?: string; // EXISTING - for backward compatibility
}

interface ExtractedLink {
  url: string;
  type?: 'original' | 'optional-package' | 'addendum'; // NEW: Optional field, detected from validation
  number?: number; // NEW: Package number or addendum number
  name?: string; // NEW: Optional package name
  selected: boolean; // EXISTING
  validation?: LinkValidationResult; // EXISTING
  addendumNumber?: string; // EXISTING - for sorting
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
  // NEW: Track selected sections (url + section type + number = unique key)
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  
  // EML Upload mode state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extractedLinks, setExtractedLinks] = useState<ExtractedLink[]>([]);
  const [showExtractedLinks, setShowExtractedLinks] = useState(false);
  const [isExtractingLinks, setIsExtractingLinks] = useState(false);
  const [emlStep, setEmlStep] = useState<'upload' | 'select' | 'confirm'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // NEW: EML table sections and toggle state
  const [emlTableSections, setEmlTableSections] = useState<DetectedSection[]>([]);
  const [parseOriginalContractFromTable, setParseOriginalContractFromTable] = useState(false);
  const [hasTable, setHasTable] = useState(false);
  const [isExistingCustomer, setIsExistingCustomer] = useState<boolean | null>(null);

  // Validate a single link (format, accessibility, and detect type)
  // NEW: No longer requires type parameter - type is detected from API
  const validateLink = async (url: string): Promise<LinkValidationResult> => {
    const result: LinkValidationResult = {
      url: url.trim(),
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

    // Check accessibility and detect type
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
        // NEW: Extract sections array (primary) or fall back to single type (backward compatibility)
        if (responseData.sections && Array.isArray(responseData.sections)) {
          result.sections = responseData.sections;
          // Also set type/number/name from first section for backward compatibility
          if (responseData.sections.length > 0) {
            result.type = responseData.sections[0].type;
            result.number = responseData.sections[0].number;
            result.name = responseData.sections[0].name;
          }
        } else {
          // Backward compatibility: single type detection
          if (responseData.type) {
            result.type = responseData.type;
          }
          if (responseData.number !== undefined) {
            result.number = responseData.number;
          }
          if (responseData.name) {
            result.name = responseData.name;
          }
          // Convert single type to sections array
          result.sections = [{
            type: responseData.type || 'original',
            number: responseData.number,
            name: responseData.name,
            selected: responseData.type !== 'optional-package', // Optional packages not selected by default
          }];
        }
        // EXISTING: Extract addendum number from response if available (backward compatibility)
        if (responseData.addendumNumber) {
          result.addendumNumber = responseData.addendumNumber;
        } else if (result.type === 'addendum' && result.number) {
          // Fallback: use number as addendumNumber for backward compatibility
          result.addendumNumber = String(result.number);
        } else if (result.type === 'addendum') {
          // Fallback to URL extraction
          result.addendumNumber = extractAddendumNumberFromUrl(url);
        }
      } else {
        result.isValid = false;
        result.error = responseData.error || responseData.message || `Failed to access link (${response.status})`;
        // Still try to extract from URL as fallback for addendums
        try {
          const fallbackNumber = extractAddendumNumberFromUrl(url);
          if (fallbackNumber && fallbackNumber !== 'Unknown') {
            result.addendumNumber = fallbackNumber;
            // Assume it's an addendum if we can extract a number
            result.type = 'addendum';
            result.number = parseInt(fallbackNumber, 10);
          }
        } catch {
          // Ignore fallback errors
        }
      }
    } catch (err) {
      result.isValid = false;
      result.error = err instanceof Error ? err.message : 'Failed to validate link';
      // Fallback to URL extraction
      try {
        const fallbackNumber = extractAddendumNumberFromUrl(url);
        if (fallbackNumber && fallbackNumber !== 'Unknown') {
          result.addendumNumber = fallbackNumber;
          result.type = 'addendum';
          result.number = parseInt(fallbackNumber, 10);
        }
      } catch {
        // Ignore fallback errors
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

      // Validate all links (sections will be detected by API)
      const validationPromises = linksToValidate.map((url) => {
        return validateLink(url);
      });
      
      const results = await Promise.all(validationPromises);
      
      // Initialize selected sections based on default selection state
      const initialSelected = new Set<string>();
      results.forEach((result) => {
        if (result.isValid && result.sections) {
          result.sections.forEach((section) => {
            if (section.selected !== false) {
              // Only add if selected is true or undefined (default true for original/addendum)
              const sectionKey = `${result.url}::${section.type}::${section.number || ''}`;
              initialSelected.add(sectionKey);
            }
          });
        }
      });
      setSelectedSections(initialSelected);
      
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
          
          // NEW: Use links array if available, otherwise fall back to old format
          if (extractedLinksData.links && Array.isArray(extractedLinksData.links)) {
            // Use new links array (type will be determined by validation)
            extractedLinksData.links.forEach((link: { url: string }) => {
              links.push({
                url: link.url,
                selected: true, // Default: checked (user can deselect)
                // type, number, name will be set during validation
                addendumNumber: extractAddendumNumberFromUrl(link.url), // Initial fallback for sorting
              });
            });
          } else {
            // EXISTING: Fall back to old format for backward compatibility
            // Only add original contract link if includeOriginalContract is checked
            if (includeOriginalContract && extractedLinksData.originalContractUrl) {
              links.push({
                url: extractedLinksData.originalContractUrl,
                selected: false, // Default: unchecked for re-upload
                // type will be determined by validation
              });
            }

            // Add all addendum links
            extractedLinksData.addendumUrls.forEach((url: string) => {
              links.push({
                url,
                selected: true, // Default: checked
                addendumNumber: extractAddendumNumberFromUrl(url), // Initial fallback
                // type will be determined by validation
              });
            });
          }

          // Step 2: Validate all links immediately (type will be detected by API)
          setProcessingStage('validating');
          const validationPromises = links.map((link: ExtractedLink) => validateLink(link.url));
          const validationResults = await Promise.all(validationPromises);

          // Update links with validation results and detected type/number
          const validatedLinks = links.map(link => {
            const validation = validationResults.find(r => r.url === link.url);
            if (validation) {
              return {
                ...link,
                validation,
                // NEW: Update type, number, and name from validation
                type: validation.type || link.type,
                number: validation.number || link.number,
                name: validation.name || link.name,
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
      // Validate each selected link (type will be detected by API)
      const validationPromises = selectedLinks.map((link: ExtractedLink) => validateLink(link.url));
      const results = await Promise.all(validationPromises);

      // Update extractedLinks with validation results and detected type/number
      const updatedLinks = extractedLinks.map(link => {
        const validation = results.find(r => r.url === link.url);
        if (validation) {
          return {
            ...link,
            validation,
            // NEW: Update type, number, and name from validation
            type: validation.type || link.type,
            number: validation.number || link.number,
            name: validation.name || link.name,
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate links');
    } finally {
      setIsValidatingLinks(false);
      setProcessingStage('idle');
    }
  };

  // Sort links by type and number in ascending order
  // Sort sections by type and number (addendums in ascending order)
  const sortSections = (sections: DetectedSection[]): DetectedSection[] => {
    return [...sections].sort((a, b) => {
      // Original contract goes first
      if (a.type === 'original' && b.type !== 'original') return -1;
      if (a.type !== 'original' && b.type === 'original') return 1;
      
      // Optional packages go after original, before addendums
      if (a.type === 'optional-package' && b.type === 'addendum') return -1;
      if (a.type === 'addendum' && b.type === 'optional-package') return 1;
      
      // For optional packages, sort by number in ascending order
      if (a.type === 'optional-package' && b.type === 'optional-package') {
        const numA = a.number || 0;
        const numB = b.number || 0;
        return numA - numB;
      }
      
      // For addendums, sort by number in ascending order
      if (a.type === 'addendum' && b.type === 'addendum') {
        const numA = a.number || 0;
        const numB = b.number || 0;
        return numA - numB;
      }
      
      return 0;
    });
  };

  const sortLinksByAddendumNumber = (links: ExtractedLink[]): ExtractedLink[] => {
    return [...links].sort((a, b) => {
      // Original contract links go first
      if (a.type === 'original' && b.type !== 'original') return -1;
      if (a.type !== 'original' && b.type === 'original') return 1;
      
      // Optional packages go after original, before addendums
      if (a.type === 'optional-package' && b.type === 'addendum') return -1;
      if (a.type === 'addendum' && b.type === 'optional-package') return 1;
      
      // For optional packages, sort by number in ascending order
      if (a.type === 'optional-package' && b.type === 'optional-package') {
        const numA = a.number || 0;
        const numB = b.number || 0;
        return numA - numB; // Ascending order
      }
      
      // For addendums, sort by number in ascending order
      if (a.type === 'addendum' && b.type === 'addendum') {
        const numA = a.number || parseInt(a.addendumNumber || '0', 10);
        const numB = b.number || parseInt(b.addendumNumber || '0', 10);
        return numA - numB; // Ascending order
      }
      
      return 0;
    });
  };

  // Auto-validate EML file (extract links, detect sections, validate)
  const autoValidateEMLFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setEmlStep('upload');
    setIsExtractingLinks(true);
    setProcessingStage('parsing');
    setEmlTableSections([]);
    setExtractedLinks([]);
    setShowExtractedLinks(false);
    setIsExistingCustomer(null);

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1];
          
          // Step 1: Extract links from EML (if any)
          const extractResponse = await fetch('/api/extract-contract-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: base64Data }),
          });

          if (!extractResponse.ok) {
            throw new Error('Failed to extract links from .eml file');
          }

          const extractData = await extractResponse.json();
          const extractedLinksData = extractData.links || {};

          // Step 2: Detect sections from EML HTML table
          setProcessingStage('validating');
          const detectResponse = await fetch('/api/detect-eml-sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: base64Data }),
          });

          let emlTableSections: DetectedSection[] = [];
          let hasTableFlag = false;
          if (detectResponse.ok) {
            const detectData = await detectResponse.json();
            emlTableSections = detectData.sections || [];
            hasTableFlag = detectData.hasTable || false;
            setEmlTableSections(emlTableSections);
            setHasTable(hasTableFlag);
          } else {
            console.warn('[Auto-Validate] Failed to detect EML sections, continuing with links only');
          }

          // Step 2.5: Extract DBX Customer ID and check if customer exists
          try {
            const extractIdResponse = await fetch('/api/extract-dbx-customer-id', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file: base64Data }),
            });
            
            if (extractIdResponse.ok) {
              const extractData = await extractIdResponse.json();
              const dbxCustomerId = extractData.dbxCustomerId;
              
              if (dbxCustomerId) {
                // Check if customer exists
                const checkResponse = await fetch(`/api/customers/check-exists?dbxCustomerId=${encodeURIComponent(dbxCustomerId)}`);
                if (checkResponse.ok) {
                  const checkData = await checkResponse.json();
                  setIsExistingCustomer(checkData.exists === true);
                } else {
                  setIsExistingCustomer(false); // Default to new customer if check fails
                }
              } else {
                setIsExistingCustomer(null); // Unknown - no DBX Customer ID found
              }
            }
          } catch (checkError) {
            console.warn('[Auto-Validate] Failed to check customer existence:', checkError);
            setIsExistingCustomer(false); // Default to new customer if check fails
          }

          // Step 3: Extract and validate links (if any)
          const links: ExtractedLink[] = [];
          
          if (extractedLinksData.links && Array.isArray(extractedLinksData.links)) {
            extractedLinksData.links.forEach((link: { url: string }) => {
              links.push({
                url: link.url,
                selected: true,
                addendumNumber: extractAddendumNumberFromUrl(link.url),
              });
            });
          } else {
            if (includeOriginalContract && extractedLinksData.originalContractUrl) {
              links.push({
                url: extractedLinksData.originalContractUrl,
                selected: false,
              });
            }
            extractedLinksData.addendumUrls?.forEach((url: string) => {
              links.push({
                url,
                selected: true,
                addendumNumber: extractAddendumNumberFromUrl(url),
              });
            });
          }

          // Validate all links
          const validationPromises = links.map(link => validateLink(link.url));
          const validationResults = await Promise.all(validationPromises);

          // Update links with validation results
          const validatedLinks = links.map((link, idx) => ({
            ...link,
            validation: validationResults[idx],
            type: validationResults[idx].type || link.type,
            number: validationResults[idx].number || link.number,
            name: validationResults[idx].name || link.name,
            addendumNumber: validationResults[idx].addendumNumber || link.addendumNumber,
          }));

          // Step 4: Combine sections from EML table and links, initialize selected sections
          const initialSelected = new Set<string>();
          
          // Add EML table sections
          emlTableSections.forEach(section => {
            if (section.selected !== false) {
              const sectionKey = `eml-table::${section.type}::${section.number || ''}`;
              initialSelected.add(sectionKey);
            }
          });

          // Add link sections
          validatedLinks.forEach((link) => {
            if (link.validation?.isValid && link.validation.sections) {
              link.validation.sections.forEach((section) => {
                if (section.selected !== false) {
                  const sectionKey = `${link.url}::${section.type}::${section.number || ''}`;
                  initialSelected.add(sectionKey);
                }
              });
            }
          });

          setSelectedSections(initialSelected);
          const sortedLinks = sortLinksByAddendumNumber(validatedLinks);
          setExtractedLinks(sortedLinks);
          setShowExtractedLinks(true);
          setEmlStep('select');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to process file');
        } finally {
          setIsExtractingLinks(false);
          setProcessingStage('idle');
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setIsExtractingLinks(false);
        setProcessingStage('idle');
      };

      reader.readAsDataURL(selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
      setIsExtractingLinks(false);
      setProcessingStage('idle');
    }
  };

  // Handle file upload in EML mode
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.eml')) {
      autoValidateEMLFile(droppedFile);
    } else {
      setError('Please upload a .eml file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.eml')) {
      autoValidateEMLFile(selectedFile);
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
        // Collect selected sections from validation results
        const formattedSelectedLinks: Array<{ url: string; type: string; number?: number }> = [];
        
        linkValidationResults.forEach((result) => {
          if (result.isValid && result.sections) {
            result.sections.forEach((section) => {
              const sectionKey = `${result.url}::${section.type}::${section.number || ''}`;
              if (selectedSections.has(sectionKey)) {
                formattedSelectedLinks.push({
                  url: result.url,
                  type: section.type,
                  number: section.number,
                });
              }
            });
          }
        });
        
        if (formattedSelectedLinks.length === 0) {
          setError('Please select at least one section to include');
          setIsProcessing(false);
          return;
        }

        // Process contract
        setProcessingStage('parsing');
        
        const response = await fetch('/api/parse-contract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: 'links',
            // NEW: Pass selectedLinks array with sections
            selectedLinks: formattedSelectedLinks,
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

        // Collect selected sections from both EML table and links
        const selectedSectionsArray: Array<{
          source: 'eml-table' | 'link';
          type: 'original' | 'optional-package' | 'addendum';
          number?: number;
          url?: string;
        }> = [];

        // Add selected EML table sections
        emlTableSections.forEach(section => {
          const sectionKey = `eml-table::${section.type}::${section.number || ''}`;
          if (selectedSections.has(sectionKey)) {
            selectedSectionsArray.push({
              source: 'eml-table',
              type: section.type,
              number: section.number,
            });
          }
        });

        // Add selected link sections
        extractedLinks.forEach(link => {
          if (link.validation?.isValid && link.validation.sections) {
            link.validation.sections.forEach(section => {
              const sectionKey = `${link.url}::${section.type}::${section.number || ''}`;
              if (selectedSections.has(sectionKey)) {
                selectedSectionsArray.push({
                  source: 'link',
                  url: link.url,
                  type: section.type,
                  number: section.number,
                });
              }
            });
          }
        });
        
        if (selectedSectionsArray.length === 0) {
          setError('Please select at least one section to include');
          setIsProcessing(false);
          return;
        }

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
                // NEW: Pass selected sections with source tracking
                selectedSections: selectedSectionsArray,
                parseOriginalContractFromTable: parseOriginalContractFromTable,
                // EXISTING: Keep old format for backward compatibility
                selectedLinks: selectedSectionsArray.filter(s => s.source === 'link').map(s => ({
                  url: s.url!,
                  type: s.type,
                  number: s.number,
                })),
                includeOriginalContract: selectedSectionsArray.some(s => s.type === 'original'),
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
    // Original contract links go first
    if (a.type === 'original' && b.type !== 'original') return -1;
    if (a.type !== 'original' && b.type === 'original') return 1;
    
    // Optional packages go after original, before addendums
    if (a.type === 'optional-package' && b.type === 'addendum') return -1;
    if (a.type === 'addendum' && b.type === 'optional-package') return 1;
    
    // For optional packages, sort by number in ascending order
    if (a.type === 'optional-package' && b.type === 'optional-package') {
      const numA = a.number || 0;
      const numB = b.number || 0;
      return numA - numB;
    }
    
    // For addendums, sort by number in ascending order
    if (a.type === 'addendum' && b.type === 'addendum') {
      const numA = a.number || parseInt(a.addendumNumber || '0', 10);
      const numB = b.number || parseInt(b.addendumNumber || '0', 10);
      return numA - numB;
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
            {/* URL Input Fields - Hidden after validation */}
            {sortedValidationResults.length === 0 && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="links-input">DBX Links (one per line)</Label>
                  <Textarea
                    id="links-input"
                    value={linksInput}
                    onChange={(e) => setLinksInput(e.target.value)}
                    placeholder={`https://l1.prodbx.com/go/view/?35587.426.20251112100816
https://l1.prodbx.com/go/view/?35279.426.20251020095021`}
                    style={{ height: "150px" }}
                    className="w-full max-w-full resize-none"
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
              </>
            )}

            {/* Validation Results - Show all sections from each link */}
            {sortedValidationResults.length > 0 && (
              <div className="space-y-2 border rounded-lg p-3 max-h-[380px] overflow-y-auto">
                <Label className="text-sm font-medium">Validation Results - Select sections to include:</Label>
                <div className="space-y-3">
                  {sortedValidationResults.map((result, resultIndex) => {
                    if (!result.isValid || !result.sections || result.sections.length === 0) {
                      // Show error or invalid link
                      return (
                        <div key={resultIndex} className="flex items-start gap-2 text-sm border-b pb-2">
                          {result.isChecking ? (
                            <Loader2 className="h-4 w-4 animate-spin mt-0.5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground break-all overflow-wrap-anywhere">{result.url}</div>
                            {result.error && (
                              <div className="text-xs text-red-600 mt-1">{result.error}</div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    
                    // Show all sections from this link
                    return (
                      <div key={resultIndex} className="border-b pb-3 last:border-b-0">
                        <div className="text-xs text-muted-foreground break-all overflow-wrap-anywhere mb-2">{result.url}</div>
                        <div className="space-y-2 pl-4">
                          {result.sections.map((section, sectionIndex) => {
                            const sectionKey = `${result.url}::${section.type}::${section.number || ''}`;
                            const isSelected = selectedSections.has(sectionKey);
                            
                            // Format display name
                            let displayName = 'Unknown';
                            if (section.type === 'optional-package') {
                              displayName = section.number 
                                ? `Optional Package ${section.number}${section.name ? `: ${section.name}` : ''}`
                                : 'Optional Package';
                            } else if (section.type === 'addendum') {
                              displayName = section.number 
                                ? `Addendum #${section.number}`
                                : 'Addendum';
                            } else {
                              displayName = 'Original Contract';
                            }
                            
                            return (
                              <div key={sectionIndex} className="flex items-center gap-2">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const newSelected = new Set(selectedSections);
                                    if (checked) {
                                      newSelected.add(sectionKey);
                                    } else {
                                      newSelected.delete(sectionKey);
                                    }
                                    setSelectedSections(newSelected);
                                  }}
                                />
                                <Label className="flex-1 cursor-pointer text-sm min-w-0">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                    <span className="font-medium">{displayName}</span>
                                  </div>
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
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

              {/* Extract and Validate Links Button removed - validation happens automatically on file upload */}
            </div>
          )}

          {/* Step 2: Unified Section Selection */}
          {emlStep === 'select' && (showExtractedLinks || emlTableSections.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col h-full min-h-0"
            >
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <Label className="text-base font-semibold">Validation Results - Select sections to include:</Label>
              </div>

              <div className="space-y-4 overflow-y-auto pr-2 flex-1 min-h-0 mb-3 border rounded-lg p-3">
                {/* EML Table Sections */}
                {emlTableSections.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      From EML File Table
                    </div>
                    {sortSections(emlTableSections).map((section, index) => {
                      const sectionKey = `eml-table::${section.type}::${section.number || ''}`;
                      const isSelected = selectedSections.has(sectionKey);
                      
                      let displayName = 'Unknown';
                      if (section.type === 'original') {
                        displayName = 'Original Contract';
                      } else if (section.type === 'optional-package') {
                        displayName = `Optional Package ${section.number}${section.name ? `: ${section.name}` : ''}`;
                      } else if (section.type === 'addendum') {
                        displayName = `Addendum ${section.number}`;
                      }
                      
                      const isOriginalContract = section.type === 'original';
                      const isRequired = isOriginalContract && isExistingCustomer === false;
                      
                      return (
                        <div key={index} className="flex items-center gap-2 pl-4">
                          <Checkbox
                            checked={isSelected}
                            disabled={isRequired}
                            onCheckedChange={(checked) => {
                              // Prevent unchecking for new customers
                              if (isRequired && !checked) {
                                return; // Don't allow unchecking
                              }
                              const newSelected = new Set(selectedSections);
                              if (checked) {
                                newSelected.add(sectionKey);
                              } else {
                                newSelected.delete(sectionKey);
                              }
                              setSelectedSections(newSelected);
                            }}
                          />
                          <Label className="flex-1 cursor-pointer text-sm">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="font-medium">{displayName}</span>
                              {isRequired && (
                                <span className="text-xs text-muted-foreground">(Required for new customer)</span>
                              )}
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Link Sections */}
                {sortedExtractedLinks.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      From Links
                    </div>
                    {sortedExtractedLinks.map((link, linkIndex) => {
                      if (!link.validation?.isValid || !link.validation.sections) {
                        return (
                          <div key={linkIndex} className="border-b pb-3 last:border-b-0">
                            <div className="text-xs text-muted-foreground break-all mb-2">{link.url}</div>
                            {link.validation?.error && (
                              <div className="text-xs text-red-600">{link.validation.error}</div>
                            )}
                          </div>
                        );
                      }
                      
                      return (
                        <div key={linkIndex} className="border-b pb-3 last:border-b-0">
                          <div className="text-xs text-muted-foreground break-all mb-2">{link.url}</div>
                          <div className="space-y-2 pl-4">
                            {sortSections(link.validation.sections
                              .filter(section => {
                                // When toggle is enabled, hide "original" sections from links
                                if (parseOriginalContractFromTable && section.type === 'original') {
                                  return false;
                                }
                                return true;
                              }))
                              .map((section, sectionIndex) => {
                                const sectionKey = `${link.url}::${section.type}::${section.number || ''}`;
                                const isSelected = selectedSections.has(sectionKey);
                                
                                let displayName = 'Unknown';
                                if (section.type === 'optional-package') {
                                  displayName = section.number 
                                    ? `Optional Package ${section.number}${section.name ? `: ${section.name}` : ''}`
                                    : 'Optional Package';
                                } else if (section.type === 'addendum') {
                                  displayName = section.number 
                                    ? `Addendum #${section.number}`
                                    : 'Addendum';
                                } else {
                                  displayName = 'Original Contract';
                                }
                                
                                const isOriginalContract = section.type === 'original';
                                const isRequired = isOriginalContract && isExistingCustomer === false;
                                
                                return (
                                  <div key={sectionIndex} className="flex items-center gap-2">
                                    <Checkbox
                                      checked={isSelected}
                                      disabled={isRequired}
                                      onCheckedChange={(checked) => {
                                        // Prevent unchecking for new customers
                                        if (isRequired && !checked) {
                                          return; // Don't allow unchecking
                                        }
                                        const newSelected = new Set(selectedSections);
                                        if (checked) {
                                          newSelected.add(sectionKey);
                                        } else {
                                          newSelected.delete(sectionKey);
                                        }
                                        setSelectedSections(newSelected);
                                      }}
                                    />
                                    <Label className="flex-1 cursor-pointer text-sm">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <span className="font-medium">{displayName}</span>
                                        {isRequired && (
                                          <span className="text-xs text-muted-foreground">(Required for new customer)</span>
                                        )}
                                      </div>
                                    </Label>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </motion.div>
          )}

          {/* Options and Parse Button - Always visible when ready */}
          {uploadMode === 'eml' && emlStep === 'select' && (showExtractedLinks || emlTableSections.length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 border-t pt-4 flex-shrink-0"
            >
              {/* Parsing Options Section */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-muted-foreground">Parsing Options</Label>
                
                {/* Parse Original Contract from Table */}
                {uploadMode === 'eml' && hasTable && emlTableSections.length > 0 && (
                  <div className="flex items-center space-x-2 pl-1">
                    <Checkbox
                      id="parse-original-from-table"
                      checked={parseOriginalContractFromTable}
                      onCheckedChange={(checked) => setParseOriginalContractFromTable(checked === true)}
                    />
                    <Label htmlFor="parse-original-from-table" className="cursor-pointer text-sm">
                      Parse Original Contract from EML Table
                    </Label>
                  </div>
                )}
                
                {/* Include Categories Options */}
                <div className="grid grid-cols-2 gap-4 pl-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-main-categories"
                      checked={includeMainCategories}
                      onCheckedChange={(checked) => setIncludeMainCategories(checked === true)}
                    />
                    <Label htmlFor="include-main-categories" className="cursor-pointer text-sm">
                      Include Main Categories
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-subcategories"
                      checked={includeSubcategories}
                      onCheckedChange={(checked) => setIncludeSubcategories(checked === true)}
                    />
                    <Label htmlFor="include-subcategories" className="cursor-pointer text-sm">
                      Include Subcategories
                    </Label>
                  </div>
                </div>
              </div>

              {/* Parse Contract Button - Always visible when ready */}
              <Button
                onClick={handleParseContract}
                disabled={isProcessing || selectedSections.size === 0}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {getProcessingText()}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Add to Contract
                  </>
                )}
              </Button>
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
