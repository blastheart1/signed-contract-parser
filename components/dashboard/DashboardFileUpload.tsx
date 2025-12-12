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

interface LinkValidationResult {
  url: string;
  type: 'original' | 'addendum';
  isValid: boolean;
  error?: string;
  isChecking: boolean;
}

interface ExtractedLink {
  url: string;
  type: 'original' | 'addendum';
  selected: boolean;
  validation?: LinkValidationResult;
}

export default function DashboardFileUpload() {
  const router = useRouter();
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
  
  // EML Upload mode state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extractedLinks, setExtractedLinks] = useState<ExtractedLink[]>([]);
  const [showExtractedLinks, setShowExtractedLinks] = useState(false);
  const [isExtractingLinks, setIsExtractingLinks] = useState(false);
  const [emlStep, setEmlStep] = useState<'upload' | 'select' | 'confirm'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate a single link (format and accessibility)
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

    // Check accessibility by attempting to fetch
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
      const linksToValidate: Array<{ url: string; type: 'original' | 'addendum' }> = [
        { url: originalContractUrl, type: 'original' },
      ];

      // Add addendum links
      if (addendumLinksInput.trim()) {
        const addendumUrls = addendumLinksInput
          .split('\n')
          .map(link => link.trim())
          .filter(link => link.length > 0);
        
        addendumUrls.forEach(url => {
          linksToValidate.push({ url, type: 'addendum' });
        });
      }

      // Validate all links
      const validationPromises = linksToValidate.map(({ url, type }) => validateLink(url, type));
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
          
          if (extractedLinksData.originalContractUrl) {
            links.push({
              url: extractedLinksData.originalContractUrl,
              type: 'original',
              selected: true, // Default: checked
            });
          }

          extractedLinksData.addendumUrls.forEach((url: string) => {
            links.push({
              url,
              type: 'addendum',
              selected: true, // Default: all checked
            });
          });

          setExtractedLinks(links);
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
      // Validate each selected link
      const validationPromises = selectedLinks.map((link: ExtractedLink) => validateLink(link.url, link.type));
      const results = await Promise.all(validationPromises);

      // Update extractedLinks with validation results
      const updatedLinks = extractedLinks.map(link => {
        const validation = results.find(r => r.url === link.url);
        return {
          ...link,
          validation,
        };
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
    setShowConfirmDialog(false);

    try {
      if (uploadMode === 'links') {
        // DBX Links Only mode
        if (!pendingLinks) {
          setError('No links to process');
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
            originalContractUrl: pendingLinks.originalContractUrl,
            addendumLinks: pendingLinks.addendumLinks,
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

        const selectedLinks = extractedLinks.filter(link => link.selected);
        const originalContract = selectedLinks.find(l => l.type === 'original');
        const addendumUrls = selectedLinks.filter(l => l.type === 'addendum').map(l => l.url);

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
                originalContractUrl: originalContract?.url,
                addendumLinks: addendumUrls.length > 0 ? addendumUrls : undefined,
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
          try {
            const storeResponse = await fetch('/api/contracts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(contractData),
            });

            if (storeResponse.ok) {
              console.log('Contract stored in API');
            } else {
              console.warn('API storage failed, but localStorage storage succeeded');
            }
          } catch (apiError) {
            console.warn('API storage error, but localStorage storage succeeded:', apiError);
          }

          // Redirect to customer view
          router.push(`/dashboard/customers/${newContractId}`);
  };

  // Prepare links for confirmation (DBX Links Only mode)
  const handlePrepareConfirm = () => {
    const addendumUrls = addendumLinksInput
      .split('\n')
      .map(link => link.trim())
      .filter(link => link.length > 0);

    // Verify all links are validated and valid
    const allValid = linkValidationResults.every(r => r.isValid);
    if (!allValid || linkValidationResults.length === 0) {
      setError('Please validate all links first and ensure they pass validation');
      return;
    }

    setPendingLinks({
      originalContractUrl: originalContractUrl.trim(),
      addendumLinks: addendumUrls,
    });
    setShowConfirmDialog(true);
  };

  // Prepare confirmation for EML mode
  const handlePrepareEmlConfirm = () => {
    const selectedLinks = extractedLinks.filter(link => link.selected);
    
    if (selectedLinks.length === 0) {
      setError('Please select at least one link');
      return;
    }

    // Check if all selected links are validated and valid
    const allValidated = selectedLinks.every(link => link.validation);
    const allValid = selectedLinks.every(link => link.validation?.isValid);

    if (!allValidated) {
      setError('Please validate selected links first');
      return;
    }

    if (!allValid) {
      setError('Some selected links failed validation. Please fix errors or deselect them.');
      return;
    }

    setEmlStep('confirm');
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
    : extractedLinks.filter(l => l.selected).every(l => l.validation?.isValid === true);

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
              <div className="space-y-1.5">
                <Label htmlFor="original-contract-url">Original Contract URL *</Label>
                <Input
                  id="original-contract-url"
                  type="url"
                  placeholder="https://l1.prodbx.com/go/view/?..."
                  value={originalContractUrl}
                  onChange={(e) => setOriginalContractUrl(e.target.value)}
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
    style={{ height: "237px" }}
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

              {/* Validation Results */}
              {linkValidationResults.length > 0 && (
                <div className="space-y-2 border rounded-lg p-3 mt-3 max-h-[200px] overflow-y-auto">
                  <Label className="text-sm font-medium">Validation Results:</Label>
                  <div className="space-y-2">
                    {linkValidationResults.map((result, index) => (
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
                            {result.type === 'original' ? 'Original Contract' : `Addendum ${index}`}:
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

                {/* Extract Links Button - appears after file is selected */}
                {file && (
                  <Button
                    onClick={handleExtractLinks}
                    disabled={isExtractingLinks}
                    variant="outline"
                    className="w-full"
                  >
                    {isExtractingLinks ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Extracting Links...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Extract Links
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Step 2: Link Selection */}
            {emlStep === 'select' && showExtractedLinks && extractedLinks.length > 0 && (
          <motion.div
                initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
                className="flex flex-col h-full min-h-0"
                style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
              >
                {/* Header - stays at top */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0" style={{ order: 1 }}>
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

                {/* Checkboxes - takes available space, scrollable */}
                <div className="space-y-3 overflow-y-auto pr-2 flex-1 min-h-0 mb-3" style={{ order: 2, flex: '1 1 auto' }}>
                  {extractedLinks.map((link, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Checkbox
                        id={`link-${index}`}
                        checked={link.selected}
                        onCheckedChange={(checked) => {
                          const updated = [...extractedLinks];
                          updated[index].selected = checked === true;
                          setExtractedLinks(updated);
                        }}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`link-${index}`} className="cursor-pointer font-medium">
                            {link.type === 'original' ? 'Original Contract' : `Addendum ${index}`}
                          </Label>
                          {link.validation && (
                            link.validation.isValid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground break-all">{link.url}</div>
                        {link.validation?.error && (
                          <div className="text-xs text-red-600">{link.validation.error}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

          </motion.div>
        )}
        </TabsContent>
      </Tabs>

      {/* Options (visible for both modes when ready to parse) */}
      {((uploadMode === 'links' && linkValidationResults.length > 0) || 
        (uploadMode === 'eml' && showExtractedLinks && emlStep !== 'confirm')) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          className="space-y-3 border-t pt-3 flex-shrink-0"
        >
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-main-categories"
                  checked={includeMainCategories}
                  onCheckedChange={(checked) => setIncludeMainCategories(checked === true)}
                />
                <Label htmlFor="include-main-categories" className="cursor-pointer">
                  Include Main Categories
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-subcategories"
                  checked={includeSubcategories}
                  onCheckedChange={(checked) => setIncludeSubcategories(checked === true)}
                />
                <Label htmlFor="include-subcategories" className="cursor-pointer">
                  Include Subcategories
                </Label>
              </div>
            </div>
          </motion.div>
        )}

      {/* Validate Selected Links Button - for EML mode only, shown after Options */}
      {uploadMode === 'eml' && emlStep === 'select' && showExtractedLinks && extractedLinks.length > 0 && (
        <div className="flex-shrink-0 mt-3">
          <Button
            onClick={handleValidateSelectedLinks}
            disabled={extractedLinks.filter(l => l.selected).length === 0 || isValidatingLinks}
            variant="outline"
            className="w-full"
          >
            {isValidatingLinks ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating Selected Links...
              </>
            ) : (
              <>
                <LinkIcon className="mr-2 h-4 w-4" />
                Validate Selected Links
              </>
            )}
          </Button>
        </div>
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

      {/* Process Button - Only for DBX Links Only mode */}
      {uploadMode === 'links' && allLinksValidatedAndValid && (
        <Button
          onClick={handlePrepareConfirm}
          disabled={isProcessing}
          className="w-full flex-shrink-0"
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
        )}

        {/* Confirmation Dialog (DBX Links Only mode) */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Contract Parsing</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-2 mt-2">
                  <div>
                    <strong>Original Contract:</strong>
                    <div className="text-xs text-muted-foreground break-all mt-1">
                      {pendingLinks?.originalContractUrl}
                    </div>
                  </div>
                  {pendingLinks && pendingLinks.addendumLinks.length > 0 && (
                    <div>
                      <strong>Addendums ({pendingLinks.addendumLinks.length}):</strong>
                      <div className="space-y-1 mt-1">
                        {pendingLinks.addendumLinks.map((url, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground break-all">
                            {idx + 1}. {url}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

      {/* Confirmation View (EML mode) */}
      {uploadMode === 'eml' && emlStep === 'confirm' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 flex-shrink-0"
        >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              <Label className="text-base font-semibold">Ready to Parse</Label>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <strong>File:</strong> {file?.name}
              </div>
              <div>
                <strong>Selected Links:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-xs text-muted-foreground">
                  {extractedLinks.filter(l => l.selected).map((link, idx) => (
                    <li key={idx} className="break-all">
                      {link.type === 'original' ? 'Original Contract' : `Addendum ${idx}`}: {link.url}
                    </li>
                  ))}
                </ul>
              </div>
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
                    Parsing...
                  </>
                ) : (
                  'Parse Contract'
                )}
              </Button>
            </div>
          </motion.div>
        )}
    </div>
  );
}
