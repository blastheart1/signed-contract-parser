'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { normalizeToMmddyyyy } from '@/lib/utils/dateFormat';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Client-safe URL validation function (moved from addendumParser to avoid cheerio import)
const validateAddendumUrl = (url: string): boolean => {
  try {
    // Accept both l1.prodbx.com and login.prodbx.com
    const urlPattern = /^https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?/i;
    return urlPattern.test(url.trim());
  } catch {
    return false;
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
}

interface ExtractedLink {
  url: string;
  type?: 'original' | 'optional-package' | 'addendum'; // NEW: Optional field, detected from validation
  number?: number; // NEW: Package number or addendum number
  name?: string; // NEW: Optional package name
  selected: boolean; // EXISTING
  validation?: LinkValidationResult; // EXISTING
}

export default function DashboardFileUpload() {
  const router = useRouter();
  const { toast } = useToast();
  const [uploadMode, setUploadMode] = useState<UploadMode>('links');
  
  // Common state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deleteExtraRows, setDeleteExtraRows] = useState(false);
  const [includeMainCategories, setIncludeMainCategories] = useState(true);
  const [includeSubcategories, setIncludeSubcategories] = useState(true);
  
  // DBX Links Only mode state
  const [originalContractUrl, setOriginalContractUrl] = useState('');
  const [addendumLinksInput, setAddendumLinksInput] = useState('');
  const [linkValidationResults, setLinkValidationResults] = useState<LinkValidationResult[]>([]);
  const [isValidatingLinks, setIsValidatingLinks] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingLinks, setPendingLinks] = useState<{ originalContractUrl: string; addendumLinks: string[] } | null>(null);
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
  // Auto-invoice generation for Permits & Engineering
  const [generateFirstInvoice, setGenerateFirstInvoice] = useState(false);
  const [hasPermitsEngineering, setHasPermitsEngineering] = useState(false);
  const [fileBase64, setFileBase64] = useState<string | null>(null);

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
      // Use API endpoint for validation (client-side fetch may have CORS issues)
      const response = await fetch('/api/validate-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const responseData = await response.json().catch(() => ({}));
      
      // Check the 'valid' field in the response body, not just HTTP status
      // The API returns status 200 for both success and format validation failures
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
      } else {
        result.isValid = false;
        result.error = responseData.error || responseData.message || `Failed to access link (${response.status})`;
      }
    } catch (err) {
      result.isValid = false;
      result.error = err instanceof Error ? err.message : 'Failed to validate link';
    }

    result.isChecking = false;
    return result;
  };

  // Validate all links in DBX Links Only mode
  const handleValidateLinks = async () => {
    if (!originalContractUrl.trim()) {
      setError('Original Contract URL is required');
      return;
    }

    setIsValidatingLinks(true);
    setError(null);
    setProcessingStage('validating');

    try {
      // Collect all links to validate (type will be detected by API)
      const linksToValidate: string[] = [];
      
      if (originalContractUrl.trim()) {
        linksToValidate.push(originalContractUrl.trim());
      }

      // Add addendum links
      if (addendumLinksInput.trim()) {
        const addendumUrls = addendumLinksInput
          .split('\n')
          .map(link => link.trim())
          .filter(link => link.length > 0);
        
        linksToValidate.push(...addendumUrls);
      }

      // Validate all links (sections will be detected by API)
      const validationPromises = linksToValidate.map((url) => validateLink(url));
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
      } else {
        // Do preview parse for Permits & Engineering detection after validation
        const selectedSectionsArray: Array<{
          source: 'eml-table' | 'link';
          type: 'original' | 'optional-package' | 'addendum';
          number?: number;
          url?: string;
        }> = [];
        
        // Add link sections
        results.forEach((result) => {
          if (result.isValid && result.sections) {
            result.sections.forEach((section) => {
              const sectionKey = `${result.url}::${section.type}::${section.number || ''}`;
              if (selectedSections.has(sectionKey)) {
                selectedSectionsArray.push({
                  source: 'link',
                  type: section.type,
                  number: section.number,
                  url: result.url,
                });
              }
            });
          }
        });
        
        // Run preview parse for detection (links mode)
        if (selectedSectionsArray.length > 0) {
          previewParseForDetection(null, selectedSectionsArray, false)
            .then((detected) => {
              setHasPermitsEngineering(detected);
              if (!detected) {
                setGenerateFirstInvoice(false);
              }
            })
            .catch((error) => {
              console.error('[Validate Links] Error during preview parse:', error);
            });
        } else {
          setHasPermitsEngineering(false);
          setGenerateFirstInvoice(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate links');
    } finally {
      setIsValidatingLinks(false);
      setProcessingStage('idle');
    }
  };

  // Extract links from .eml file
  const handleExtractLinks = async () => {
    if (!file) return;

    setIsExtractingLinks(true);
    setError(null);
    setProcessingStage('parsing');

    try {
      // Read file and parse EML
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1];
          
          // Extract links from .eml file using API endpoint
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
                selected: true, // Default: all checked (user can deselect)
                // type, number, name will be set during validation
              });
            });
          } else {
            // EXISTING: Fall back to old format for backward compatibility
          if (extractedLinksData.originalContractUrl) {
            links.push({
              url: extractedLinksData.originalContractUrl,
              selected: true, // Default: checked
                // type will be determined by validation
            });
          }

          extractedLinksData.addendumUrls.forEach((url: string) => {
            links.push({
              url,
              selected: true, // Default: all checked
                // type will be determined by validation
            });
          });
          }
          
          // Step 2: Validate all links immediately (sections will be detected by API)
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
              };
            }
            return link;
          });
          
          // Initialize selected sections for EML mode based on validation results
          const initialSelected = new Set<string>();
          validatedLinks.forEach((link) => {
            if (link.selected && link.validation?.isValid && link.validation.sections) {
              link.validation.sections.forEach((section) => {
                if (section.selected !== false) {
                  const sectionKey = `${link.url}::${section.type}::${section.number || ''}`;
                  initialSelected.add(sectionKey);
                }
              });
            }
          });
          setSelectedSections(initialSelected);

          setExtractedLinks(validatedLinks);
          setShowExtractedLinks(true);
          setEmlStep('select');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to extract links');
          setIsExtractingLinks(false);
          setProcessingStage('idle');
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setIsExtractingLinks(false);
        setProcessingStage('idle');
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract links');
      setIsExtractingLinks(false);
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
      // Validate each selected link (sections will be detected by API)
      const validationPromises = selectedLinks.map((link: ExtractedLink) => validateLink(link.url));
      const results = await Promise.all(validationPromises);

      // Update extractedLinks with validation results and detected sections
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
        };
        }
        return link;
      });
      
      // Update selected sections based on validation results
      const newSelected = new Set<string>();
      updatedLinks.forEach((link) => {
        if (link.selected && link.validation?.isValid && link.validation.sections) {
          link.validation.sections.forEach((section) => {
            if (section.selected !== false) {
              const sectionKey = `${link.url}::${section.type}::${section.number || ''}`;
              newSelected.add(sectionKey);
            }
          });
        }
      });
      setSelectedSections(newSelected);

      setExtractedLinks(updatedLinks);

      // Check if all validations passed
      const allValid = results.every(r => r.isValid);
      if (!allValid) {
        const failedLinks = results.filter(r => !r.isValid);
        setError(`${failedLinks.length} selected link(s) failed validation. Please check the errors below.`);
      } else {
        // Do preview parse for Permits & Engineering detection after validation
        const selectedSectionsArray: Array<{
          source: 'eml-table' | 'link';
          type: 'original' | 'optional-package' | 'addendum';
          number?: number;
          url?: string;
        }> = [];
        
        // Add EML table sections if any
        emlTableSections.forEach(section => {
          if (section.selected !== false) {
            selectedSectionsArray.push({
              source: 'eml-table',
              type: section.type,
              number: section.number,
            });
          }
        });
        
        // Add link sections
        updatedLinks.forEach((link) => {
          if (link.selected && link.validation?.isValid && link.validation.sections) {
            link.validation.sections.forEach((section) => {
              if (section.selected !== false) {
                selectedSectionsArray.push({
                  source: 'link',
                  type: section.type,
                  number: section.number,
                  url: link.url,
                });
              }
            });
          }
        });
        
        // Run preview parse for detection
        if (selectedSectionsArray.length > 0 && fileBase64) {
          previewParseForDetection(fileBase64, selectedSectionsArray, parseOriginalContractFromTable)
            .then((detected) => {
              setHasPermitsEngineering(detected);
              if (!detected) {
                setGenerateFirstInvoice(false);
              }
            })
            .catch((error) => {
              console.error('[Validate Links] Error during preview parse:', error);
            });
        } else {
          setHasPermitsEngineering(false);
          setGenerateFirstInvoice(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate links');
    } finally {
      setIsValidatingLinks(false);
      setProcessingStage('idle');
    }
  };

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

  // Sort links by addendum number (for display order)
  const sortLinksByAddendumNumber = (links: ExtractedLink[]): ExtractedLink[] => {
    return [...links].sort((a, b) => {
      // Get addendum numbers from validation sections
      const aAddendumNum = a.validation?.sections?.find(s => s.type === 'addendum')?.number || 0;
      const bAddendumNum = b.validation?.sections?.find(s => s.type === 'addendum')?.number || 0;
      
      // If both are addendums, sort by number
      if (aAddendumNum > 0 && bAddendumNum > 0) {
        return aAddendumNum - bAddendumNum;
      }
      
      // Original contract goes first
      const aIsOriginal = a.validation?.sections?.some(s => s.type === 'original');
      const bIsOriginal = b.validation?.sections?.some(s => s.type === 'original');
      if (aIsOriginal && !bIsOriginal) return -1;
      if (!aIsOriginal && bIsOriginal) return 1;
      
      // Optional packages go after original
      const aIsOptional = a.validation?.sections?.some(s => s.type === 'optional-package');
      const bIsOptional = b.validation?.sections?.some(s => s.type === 'optional-package');
      if (aIsOptional && !bIsOptional && !bIsOriginal) return -1;
      if (!aIsOptional && bIsOptional && !aIsOriginal) return 1;
      
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
      // Read file and convert to base64
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
              links.push({ url: link.url, selected: true });
            });
          } else {
            // Fallback to old format
            if (extractedLinksData.originalContractUrl) {
              links.push({ url: extractedLinksData.originalContractUrl, selected: true });
            }
            extractedLinksData.addendumUrls?.forEach((url: string) => {
              links.push({ url, selected: true });
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

          // Sort links by addendum number for display
          const sortedValidatedLinks = sortLinksByAddendumNumber(validatedLinks);
          
          setSelectedSections(initialSelected);
          setExtractedLinks(sortedValidatedLinks);
          setShowExtractedLinks(true);
          setEmlStep('select');
          
          // Store file base64 for preview parse
          setFileBase64(base64Data);
          
          // Do preview parse for Permits & Engineering detection
          const selectedSectionsArray: Array<{
            source: 'eml-table' | 'link';
            type: 'original' | 'optional-package' | 'addendum';
            number?: number;
            url?: string;
          }> = [];
          
          // Add EML table sections
          emlTableSections.forEach(section => {
            if (section.selected !== false) {
              selectedSectionsArray.push({
                source: 'eml-table',
                type: section.type,
                number: section.number,
              });
            }
          });
          
          // Add link sections
          validatedLinks.forEach((link) => {
            if (link.validation?.isValid && link.validation.sections) {
              link.validation.sections.forEach((section) => {
                if (section.selected !== false) {
                  selectedSectionsArray.push({
                    source: 'link',
                    type: section.type,
                    number: section.number,
                    url: link.url,
                  });
                }
              });
            }
          });
          
          // Run preview parse for detection
          if (selectedSectionsArray.length > 0) {
            previewParseForDetection(base64Data, selectedSectionsArray, parseOriginalContractFromTable)
              .then((detected) => {
                setHasPermitsEngineering(detected);
                if (!detected) {
                  setGenerateFirstInvoice(false);
                }
              })
              .catch((error) => {
                console.error('[Auto-Validate] Error during preview parse:', error);
              });
          } else {
            setHasPermitsEngineering(false);
            setGenerateFirstInvoice(false);
          }
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
    } else {
      setError('Please select a .eml file');
    }
  };

  // Handle final parsing/upload
  const handleParseContract = async () => {
    setIsProcessing(true);
    setError(null);
    setShowConfirmDialog(false);

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

        setProcessingStage('parsing');

        const dataResponse = await fetch('/api/parse-contract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: 'links',
            // NEW: Pass selectedLinks array with sections
            selectedLinks: formattedSelectedLinks,
            deleteExtraRows: deleteExtraRows,
            includeMainCategories: includeMainCategories,
            includeSubcategories: includeSubcategories,
            returnData: true,
          }),
        });

        await handleParseResponse(dataResponse);
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
          url?: string; // Only for link sections
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

        setProcessingStage('uploading');

      // Read file as base64
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1];
          
          setProcessingStage('parsing');
          
          const dataResponse = await fetch('/api/parse-contract', {
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
              deleteExtraRows: deleteExtraRows,
              includeMainCategories: includeMainCategories,
              includeSubcategories: includeSubcategories,
              returnData: true,
            }),
          });

            await handleParseResponse(dataResponse);
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

  // Handle API response and store contract
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

    // Store contract (same logic as before)
          const { location, items, addendums, isLocationParsed, orderItemsValidation } = dataResult.data;
    const newContractId = `contract-${Date.now()}-${location.orderNo || 'unknown'}`;
          
          // Combine items with addendum structure preserved
          const allItems: any[] = [...items];
          
          // Add addendums with headers and markers
          if (addendums && addendums.length > 0) {
            // Add 2 blank rows separator before addendums
            allItems.push({
              type: 'item',
              productService: '',
              qty: '',
              rate: '',
              amount: '',
        columnBLabel: 'Initial',
              isBlankRow: true,
            });
            allItems.push({
              type: 'item',
              productService: '',
              qty: '',
              rate: '',
              amount: '',
        columnBLabel: 'Initial',
              isBlankRow: true,
            });
            
            // Process each addendum
            addendums.forEach((addendum: any) => {
              const addendumNum = addendum.addendumNumber;
              const urlId = addendum.urlId || addendum.addendumNumber;
              const headerText = `Addendum #${addendumNum} (${urlId})`;
              
              allItems.push({
          type: 'maincategory',
                productService: headerText,
                qty: '',
                rate: '',
                amount: '',
                columnBLabel: 'Addendum',
                isAddendumHeader: true,
                addendumNumber: addendumNum,
                addendumUrlId: urlId,
              });
              
              addendum.items.forEach((item: any) => {
                allItems.push({
                  ...item,
            columnBLabel: 'Addendum',
                });
              });
            });
          }
          
    // Ensure all main items have 'Initial' marker
          items.forEach((item: any, index: number) => {
            if (allItems[index] && !allItems[index].columnBLabel) {
              allItems[index].columnBLabel = 'Initial';
            }
          });

          // Save contract (invoice creation will be handled in saveContractAndCreateInvoice if checkbox was checked)
          await saveContractAndCreateInvoice(location, allItems, addendums, isLocationParsed, orderItemsValidation, newContractId, generateFirstInvoice);
  };

  // Preview parse for detection (doesn't save to database)
  const previewParseForDetection = async (
    fileBase64: string | null,
    selectedSectionsArray: Array<{
      source: 'eml-table' | 'link';
      type: 'original' | 'optional-package' | 'addendum';
      number?: number;
      url?: string;
    }>,
    parseOriginalContractFromTable: boolean
  ): Promise<boolean> => {
    try {
      if (uploadMode === 'eml' && fileBase64) {
        // For EML mode, do a preview parse
        const previewResponse = await fetch('/api/parse-contract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: 'eml',
            file: fileBase64,
            filename: file?.name || 'preview.eml',
            selectedSections: selectedSectionsArray,
            parseOriginalContractFromTable: parseOriginalContractFromTable,
            selectedLinks: selectedSectionsArray.filter(s => s.source === 'link').map(s => ({
              url: s.url!,
              type: s.type,
              number: s.number,
            })),
            deleteExtraRows: deleteExtraRows,
            includeMainCategories: includeMainCategories,
            includeSubcategories: includeSubcategories,
            returnData: true,
          }),
        });

        if (previewResponse.ok) {
          const previewData = await previewResponse.json();
          if (previewData.success && previewData.data?.items) {
            const { items, addendums } = previewData.data;
            // Combine items with addendums
            const allItems: any[] = [...items];
            if (addendums && addendums.length > 0) {
              addendums.forEach((addendum: any) => {
                if (addendum.items) {
                  allItems.push(...addendum.items);
                }
              });
            }
            return detectPermitsEngineering(allItems);
          }
        }
      } else if (uploadMode === 'links') {
        // For links mode, do a preview parse
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

        if (formattedSelectedLinks.length > 0) {
          const previewResponse = await fetch('/api/parse-contract', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mode: 'links',
              selectedLinks: formattedSelectedLinks,
              deleteExtraRows: deleteExtraRows,
              includeMainCategories: includeMainCategories,
              includeSubcategories: includeSubcategories,
              returnData: true,
            }),
          });

          if (previewResponse.ok) {
            const previewData = await previewResponse.json();
            if (previewData.success && previewData.data?.items) {
              const { items, addendums } = previewData.data;
              // Combine items with addendums
              const allItems: any[] = [...items];
              if (addendums && addendums.length > 0) {
                addendums.forEach((addendum: any) => {
                  if (addendum.items) {
                    allItems.push(...addendum.items);
                  }
                });
              }
              return detectPermitsEngineering(allItems);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Preview Parse] Error during preview parse:', error);
    }
    
    return false;
  };

  // Detect Permits & Engineering items
  const detectPermitsEngineering = (items: any[]): boolean => {
    if (!items || items.length === 0) return false;
    
    for (const item of items) {
      // Check main category items (type: 'maincategory') - category name is in productService
      if (item.type === 'maincategory') {
        const categoryName = item.productService || '';
        if (categoryName) {
          const normalizedCategory = categoryName
            .replace(/&amp;/g, '&')
            .replace(/&nbsp;/g, ' ')
            .toLowerCase()
            .trim();
          
          // Check for various formats
          if (
            normalizedCategory.includes('permits') && 
            normalizedCategory.includes('engineering')
          ) {
            return true;
          }
          
          // Check for specific pattern "0401 Calimingo - Permits & Engineering"
          if (normalizedCategory.includes('0401') && 
              normalizedCategory.includes('calimingo') &&
              normalizedCategory.includes('permits') &&
              normalizedCategory.includes('engineering')) {
            return true;
          }
        }
      }
      
      // Check regular line items (type: 'item') - category name is in mainCategory
      if (item.type === 'item' && item.mainCategory) {
        const mainCategory = item.mainCategory || '';
        if (!mainCategory) continue;
        
        // Normalize: handle HTML entities and case-insensitive matching
        const normalizedCategory = mainCategory
          .replace(/&amp;/g, '&')
          .replace(/&nbsp;/g, ' ')
          .toLowerCase()
          .trim();
        
        // Check for various formats
        if (
          normalizedCategory.includes('permits') && 
          normalizedCategory.includes('engineering')
        ) {
          return true;
        }
        
        // Check for specific pattern "0401 Calimingo - Permits & Engineering"
        if (normalizedCategory.includes('0401') && 
            normalizedCategory.includes('calimingo') &&
            normalizedCategory.includes('permits') &&
            normalizedCategory.includes('engineering')) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Save contract and optionally create invoice
  const saveContractAndCreateInvoice = async (
    location: any,
    allItems: any[],
    addendums: any[],
    isLocationParsed: boolean,
    orderItemsValidation: any,
    newContractId: string,
    shouldCreateInvoice: boolean
  ) => {
    const contractData = {
      id: newContractId,
      customer: {
        dbxCustomerId: location.dbxCustomerId,
        clientName: location.clientName || 'Unknown',
        email: location.email,
        phone: location.phone,
        streetAddress: location.streetAddress,
        city: location.city,
        state: location.state,
        zip: location.zip,
      },
      order: {
        orderNo: location.orderNo,
        orderDate: location.orderDate,
        orderPO: location.orderPO,
        orderDueDate: location.orderDueDate,
        orderType: location.orderType,
        orderDelivered: location.orderDelivered,
        quoteExpirationDate: location.quoteExpirationDate,
        orderGrandTotal: location.orderGrandTotal || 0,
        progressPayments: location.progressPayments,
        balanceDue: location.balanceDue || 0,
        salesRep: location.salesRep,
        // Set Contract Date (DBX) from Order Date
        contractDate: location.orderDate ? (normalizeToMmddyyyy(location.orderDate) ?? undefined) : undefined,
      },
      items: allItems,
      parsedAt: new Date(),
      isLocationParsed: isLocationParsed !== false,
      orderItemsValidation: orderItemsValidation,
    };

    // Store in localStorage
    try {
      const { LocalStorageStore } = await import('@/lib/store/localStorageStore');
      LocalStorageStore.addContract(contractData);
      console.log('Contract stored in localStorage');
    } catch (localStorageError) {
      console.warn('localStorage storage failed:', localStorageError);
    }

    // Store via API
    let savedOrderId: string | null = null;
    try {
      const storeResponse = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contractData),
      });

      if (storeResponse.ok) {
        const storeResult = await storeResponse.json();
        // The contract.id is the orderId (they use the same ID)
        savedOrderId = storeResult.contract?.id || null;
        console.log('Contract stored in API, orderId:', savedOrderId);
        
        // Create invoice if requested (wait a bit for order items to be saved)
        if (shouldCreateInvoice && savedOrderId) {
          console.log('[Auto-Invoice] Starting invoice creation process...', {
            shouldCreateInvoice,
            savedOrderId,
            hasItems: allItems.length > 0,
          });
          // Wait a short time for order items to be fully saved, then create invoice
          setTimeout(async () => {
            try {
              console.log('[Auto-Invoice] Calling createPermitsEngineeringInvoice...');
              await createPermitsEngineeringInvoice(savedOrderId!, allItems, location.orderDate || location.contractDate);
              toast({
                title: 'Invoice created',
                description: 'First invoice for Permits & Engineering items has been created successfully.',
              });
            } catch (error) {
              console.error('[Auto-Invoice] Error creating invoice:', error);
              toast({
                title: 'Invoice creation failed',
                description: 'Contract was saved, but invoice creation failed. You can create the invoice manually.',
                variant: 'destructive',
              });
            }
          }, 1000);
        } else {
          console.log('[Auto-Invoice] Invoice creation skipped:', {
            shouldCreateInvoice,
            savedOrderId,
          });
        }
      } else {
        console.warn('API storage failed, but localStorage storage succeeded');
      }
    } catch (apiError) {
      console.warn('API storage error, but localStorage storage succeeded:', apiError);
    }

    // Redirect to customer view
    router.push(`/dashboard/customers/${newContractId}`);
  };

  // Create invoice for Permits & Engineering items
  const createPermitsEngineeringInvoice = async (orderId: string, allItems: any[], contractDate: string | undefined) => {
    console.log('[Auto-Invoice] Function called with:', {
      orderId,
      totalItems: allItems.length,
      contractDate,
    });
    try {
      // Filter items for Permits & Engineering category
      const permitsEngItems = allItems.filter(item => {
        if (item.type !== 'item') return false; // Only process actual line items
        const mainCategory = item.mainCategory || '';
        if (!mainCategory) return false;
        
        // Normalize: handle HTML entities and case-insensitive matching
        const normalizedCategory = mainCategory
          .replace(/&amp;/g, '&')
          .replace(/&nbsp;/g, ' ')
          .toLowerCase()
          .trim();
        
        // Check for various formats
        return (
          (normalizedCategory.includes('permits') && normalizedCategory.includes('engineering')) ||
          (normalizedCategory.includes('0401') && normalizedCategory.includes('calimingo') && 
           normalizedCategory.includes('permits') && normalizedCategory.includes('engineering'))
        );
      });

      if (permitsEngItems.length === 0) {
        console.log('No Permits & Engineering items found for invoice creation');
        return;
      }

      // Store productService and amounts (not IDs) since PUT will recreate items with new IDs
      const itemsToUpdateByProductService: Array<{ productService: string; amount: number }> = [];
      let totalInvoiceAmount = 0;

      for (const item of permitsEngItems) {
        const productService = item.productService?.trim() || '';
        if (!productService) {
          console.warn('[Auto-Invoice] Item missing productService:', item);
          continue;
        }

        // Use max amount (or 0 if no amount)
        const maxAmount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0));
        
        // Store by productService (will match after update)
        itemsToUpdateByProductService.push({
          productService,
          amount: maxAmount,
        });
        
        // Only include items with amount > 0 in invoice total
        if (maxAmount > 0) {
          totalInvoiceAmount += maxAmount;
        }
      }

      if (itemsToUpdateByProductService.length === 0) {
        console.log('[Auto-Invoice] No valid Permits & Engineering items found');
        return;
      }

      console.log(`[Auto-Invoice] Found ${itemsToUpdateByProductService.length} Permits & Engineering items to update`);

      // IMPORTANT: Update order items progress percentages FIRST
      // The invoice validation requires progressOverallPct > 0 before items can be linked
      // Update ALL items (even those with 0 amount) to 100% progress
      // Use PUT endpoint for bulk update (it replaces all items, so we need to preserve existing ones)
      console.log(`[Auto-Invoice] Fetching existing order items for update...`);
      
      // Get all order items first
      const allOrderItemsResponse = await fetch(`/api/orders/${orderId}/items`);
      if (!allOrderItemsResponse.ok) {
        const errorText = await allOrderItemsResponse.text();
        console.error('[Auto-Invoice] Failed to fetch order items:', errorText);
        throw new Error('Failed to fetch order items for update');
      }
      const allOrderItemsData = await allOrderItemsResponse.json();
      if (!allOrderItemsData.success || !allOrderItemsData.items) {
        console.error('[Auto-Invoice] Invalid order items response:', allOrderItemsData);
        throw new Error('Invalid order items response');
      }

      console.log(`[Auto-Invoice] Fetched ${allOrderItemsData.items.length} existing order items`);

      // Create a map of productService to update info
      const itemsToUpdateMap = new Map<string, number>();
      itemsToUpdateByProductService.forEach(item => {
        itemsToUpdateMap.set(item.productService, item.amount);
      });
      
      // Update only the items that need updating, preserving other items
      // Convert to OrderItem format expected by PUT endpoint
      const updatedItems = allOrderItemsData.items.map((orderItem: any) => {
        const productService = orderItem.productService?.trim() || '';
        const updateAmount = itemsToUpdateMap.get(productService);
        
        if (updateAmount !== undefined) {
          // This is a Permits & Engineering item - update to 100%
          return {
            type: orderItem.itemType || 'item',
            productService: orderItem.productService || '',
            qty: orderItem.qty || '',
            rate: orderItem.rate || '',
            amount: orderItem.amount || 0,
            mainCategory: orderItem.mainCategory || null,
            subCategory: orderItem.subCategory || null,
            progressOverallPct: '100',
            previouslyInvoicedPct: '100',
            previouslyInvoicedAmount: updateAmount.toString(),
            thisBill: updateAmount.toString(),
          };
        }
        // Preserve existing item
        return {
          type: orderItem.itemType || 'item',
          productService: orderItem.productService || '',
          qty: orderItem.qty || '',
          rate: orderItem.rate || '',
          amount: orderItem.amount || 0,
          mainCategory: orderItem.mainCategory || null,
          subCategory: orderItem.subCategory || null,
          progressOverallPct: orderItem.progressOverallPct || '0',
          previouslyInvoicedPct: orderItem.previouslyInvoicedPct || '0',
          previouslyInvoicedAmount: orderItem.previouslyInvoicedAmount || '0',
          thisBill: orderItem.thisBill || '0',
        };
      });

      console.log(`[Auto-Invoice] Sending PUT request to update ${updatedItems.length} items...`);
      const putResponse = await fetch(`/api/orders/${orderId}/items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: updatedItems }),
      });

      if (!putResponse.ok) {
        const errorData = await putResponse.json();
        console.error('[Auto-Invoice] Failed to update order items:', errorData);
        throw new Error(`Failed to update order items: ${errorData.error || errorData.message || 'Unknown error'}`);
      }
      
      console.log(`[Auto-Invoice] Successfully updated order items`);

      // Wait for database to commit the changes
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Now fetch items again to get NEW IDs (PUT recreates items with new IDs)
      console.log(`[Auto-Invoice] Fetching updated order items to get new IDs...`);
      const updatedOrderItemsResponse = await fetch(`/api/orders/${orderId}/items`);
      if (!updatedOrderItemsResponse.ok) {
        throw new Error('Failed to fetch updated order items');
      }
      const updatedOrderItemsData = await updatedOrderItemsResponse.json();
      if (!updatedOrderItemsData.success || !updatedOrderItemsData.items) {
        throw new Error('Invalid updated order items response');
      }

      // Create a map of productService to NEW order item ID
      const productServiceToNewItemId = new Map<string, string>();
      updatedOrderItemsData.items.forEach((orderItem: any) => {
        if (orderItem.productService) {
          productServiceToNewItemId.set(orderItem.productService.trim(), orderItem.id);
        }
      });

      // Build linkedLineItems with NEW IDs and only items with amount > 0
      const linkedLineItems: Array<{ itemId: string; amount: number }> = [];
      for (const item of itemsToUpdateByProductService) {
        if (item.amount > 0) {
          const newItemId = productServiceToNewItemId.get(item.productService);
          if (newItemId) {
            linkedLineItems.push({
              itemId: newItemId,
              amount: item.amount,
            });
          } else {
            console.warn(`[Auto-Invoice] Could not find new ID for: ${item.productService}`);
          }
        }
      }

      // Only create invoice if there are items with amount > 0
      if (linkedLineItems.length === 0) {
        console.log('[Auto-Invoice] No items with amount > 0 to include in invoice, but progress percentages have been updated');
        return;
      }

      // Now create invoice (after items are updated with progress percentages)
      // Convert contract date to ISO format for API (YYYY-MM-DD)
      let invoiceDateISO: string | null = null;
      if (contractDate) {
        const normalizedDate = normalizeToMmddyyyy(contractDate);
        if (normalizedDate) {
          // Convert MM/DD/YYYY to YYYY-MM-DD
          const [month, day, year] = normalizedDate.split('/');
          invoiceDateISO = `${year}-${month}-${day}`;
        }
      }
      
      console.log(`[Auto-Invoice] Creating invoice with ${linkedLineItems.length} linked items (total: $${totalInvoiceAmount})...`);
      const invoiceResponse = await fetch(`/api/orders/${orderId}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceNumber: null,
          invoiceDate: invoiceDateISO,
          invoiceAmount: totalInvoiceAmount.toString(),
          paymentsReceived: '0',
          exclude: false,
          linkedLineItems: linkedLineItems,
        }),
      });

      if (!invoiceResponse.ok) {
        const errorData = await invoiceResponse.json();
        console.error('[Auto-Invoice] Failed to create invoice:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to create invoice');
      }

      const invoiceResult = await invoiceResponse.json();
      console.log('[Auto-Invoice] Invoice created successfully:', invoiceResult.invoice?.id);
      console.log('[Auto-Invoice] Permits & Engineering invoice created and order items updated successfully');
    } catch (error) {
      console.error('Error creating Permits & Engineering invoice:', error);
      // Don't throw - allow contract save to succeed even if invoice creation fails
    }
  };

  // Prepare links for confirmation (DBX Links Only mode)
  // NOTE: This function is no longer needed since we now pass selectedLinks directly
  // But keeping it for backward compatibility with the confirmation dialog
  const handlePrepareConfirm = () => {
    // Collect selected sections
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
      return;
    }

    // Format for confirmation dialog (backward compatibility)
    const addendumUrls = formattedSelectedLinks
      .filter(l => l.type === 'addendum')
      .map(l => l.url);

    setPendingLinks({
      originalContractUrl: formattedSelectedLinks.find(l => l.type === 'original')?.url || originalContractUrl.trim(),
      addendumLinks: addendumUrls,
    });
    setShowConfirmDialog(true);
  };


  const getProcessingText = () => {
    switch (processingStage) {
      case 'uploading':
        return 'Uploading...';
      case 'parsing':
        return 'Parsing contract...';
      case 'storing':
        return 'Storing contract...';
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
    setOriginalContractUrl('');
    setAddendumLinksInput('');
    setLinkValidationResults([]);
    setExtractedLinks([]);
    setShowExtractedLinks(false);
    setEmlStep('upload');
    setPendingLinks(null);
    setIsValidatingLinks(false);
    setProcessingStage('idle');
    setIsExtractingLinks(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const allLinksValidatedAndValid = uploadMode === 'links' 
    ? linkValidationResults.length > 0 && linkValidationResults.every(r => r.isValid)
    : extractedLinks.filter(l => l.selected).length > 0 && extractedLinks.filter(l => l.selected).every(l => l.validation?.isValid === true);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode Selection */}
      <Tabs value={uploadMode} onValueChange={(value) => handleModeChange(value as UploadMode)} className="flex flex-col h-full min-h-0 flex-1">
        <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
          <TabsTrigger value="links" className="data-[state=active]:bg-primary data-[state=active]:text-white">DBX Links Only</TabsTrigger>
          <TabsTrigger value="eml" className="data-[state=active]:bg-primary data-[state=active]:text-white">EML Upload</TabsTrigger>
        </TabsList>

        {/* DBX Links Only Mode */}
        <TabsContent value="links" className="overflow-y-auto mt-3 max-h-[400px]">
          <div className="space-y-3">
              {/* URL Input Fields - Hidden after validation */}
              {linkValidationResults.length === 0 && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="original-contract-url">Original Contract URL *</Label>
                    <Input
                      id="original-contract-url"
                      type="url"
                      placeholder="https://l1.prodbx.com/go/view/?..."
                      value={originalContractUrl}
                      onChange={(e) => setOriginalContractUrl(e.target.value)}
                      className="w-full max-w-full"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="addendum-links">Addendum Links (optional, one per line)</Label>
                    <Textarea
                      id="addendum-links"
                      value={addendumLinksInput}
                      onChange={(e) => setAddendumLinksInput(e.target.value)}
                      placeholder={`https://l1.prodbx.com/go/view/?35587.426.20251112100816
https://l1.prodbx.com/go/view/?35279.426.20251020095021`}
                      style={{ height: "150px" }}
                      className="w-full max-w-full resize-none"
                    />
                  </div>

                  <Button
                    onClick={handleValidateLinks}
                    disabled={!originalContractUrl.trim() || isValidatingLinks}
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
              {linkValidationResults.length > 0 && (
                <div className="space-y-2 border rounded-lg p-3 max-h-[380px] overflow-y-auto">
                  <Label className="text-sm font-medium">Validation Results - Select sections to include:</Label>
                  <div className="space-y-3">
                    {linkValidationResults.map((result, resultIndex) => {
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
            </div>
          </TabsContent>

          {/* EML Upload Mode */}
          <TabsContent value="eml" className="mt-3 flex flex-col min-h-0">
            {emlStep === 'upload' && (
              <div className="space-y-3 flex flex-col h-full">
        <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-300 flex-shrink-0 ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-primary/50'
          } ${!file ? 'cursor-pointer' : ''}`}
                  style={{ height: '339px', marginTop: '12px' }}
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

                {/* Extract Links Button removed - validation happens automatically on file upload */}
              </div>
            )}

            {/* Step 2: Unified Section Selection */}
            {emlStep === 'select' && (showExtractedLinks || emlTableSections.length > 0) && (
          <motion.div
                initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
                className="flex flex-col h-full min-h-0"
                style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
              >
                {/* Header - stays at top */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0" style={{ order: 1 }}>
                  <Label className="text-base font-semibold">Validation Results - Select sections to include:</Label>
                </div>

                {/* Unified Sections Display - takes available space, scrollable */}
                <div className="space-y-4 overflow-y-auto pr-2 flex-1 min-h-0 mb-3 border rounded-lg p-3" style={{ order: 2, flex: '1 1 auto' }}>
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
                  {extractedLinks.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        From Links
                      </div>
                      {sortLinksByAddendumNumber(extractedLinks).map((link, linkIndex) => {
                        if (!link.validation?.isValid || !link.validation.sections) {
                          // Show error for invalid links
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
        </TabsContent>
      </Tabs>

      {/* Options and Parse Button (visible for both modes when ready to parse) */}
      {((uploadMode === 'links' && linkValidationResults.length > 0) || 
        (uploadMode === 'eml' && emlStep === 'select' && (showExtractedLinks || emlTableSections.length > 0))) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4 border-t pt-4 flex-shrink-0"
          >
            {/* Parsing Options Section */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-muted-foreground">Parsing Options</Label>
              
              {/* EML mode: Parse Original Contract from Table */}
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
              
              {/* Generate 1st Invoice Option (only shown when Permits & Engineering detected) */}
              {hasPermitsEngineering && (
                <div className="flex items-center space-x-2 pl-1 pt-2 border-t">
                  <Checkbox
                    id="generate-first-invoice"
                    checked={generateFirstInvoice}
                    onCheckedChange={(checked) => setGenerateFirstInvoice(checked === true)}
                  />
                  <Label htmlFor="generate-first-invoice" className="cursor-pointer text-sm">
                    Generate 1st invoice
                  </Label>
                </div>
              )}
              {hasPermitsEngineering && generateFirstInvoice && (
                <p className="text-xs text-muted-foreground pl-6">
                  An invoice will be created with all Permits & Engineering line items linked, using max amounts and setting progress percentages to 100%.
                </p>
              )}
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
                  Parse Contract
                </>
              )}
            </Button>
          </motion.div>
        )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2 flex-shrink-0"
        >
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </motion.div>
      )}

        {/* Confirmation Dialog (DBX Links Only mode) */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Contract Parsing</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-2 mt-2">
                  {linkValidationResults.filter(r => r.isValid).flatMap((result) => {
                    if (!result.sections || result.sections.length === 0) {
                      return [{
                        key: result.url,
                        displayName: result.type === 'original' ? 'Original Contract' : 'Unknown',
                        url: result.url,
                      }];
                    }
                    
                    return result.sections
                      .map((section, idx) => {
                        const sectionKey = `${result.url}::${section.type}::${section.number || ''}`;
                        if (!selectedSections.has(sectionKey)) return null;
                        
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
                        
                        return {
                          key: sectionKey,
                          displayName,
                          url: result.url,
                        };
                      })
                      .filter((item): item is { key: string; displayName: string; url: string } => item !== null);
                  }).map((item, idx) => (
                    <div key={item.key || idx}>
                      <strong>{item.displayName}:</strong>
                    <div className="text-xs text-muted-foreground break-all mt-1">
                        {item.url}
                    </div>
                          </div>
                        ))}
                  <p className="text-sm mt-3">
                    Ready to parse and store this contract in the database. Continue?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleParseContract}>Parse Contract</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


    </div>
  );
}
