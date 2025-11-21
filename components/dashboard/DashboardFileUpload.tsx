'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import PrivacyDisclaimer from '../PrivacyDisclaimer';

type ProcessingStage = 'idle' | 'uploading' | 'parsing' | 'storing';

export default function DashboardFileUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [addAddendum, setAddAddendum] = useState(false);
  const [addendumLinks, setAddendumLinks] = useState<string>('');
  const [deleteExtraRows, setDeleteExtraRows] = useState(false);
  const [includeMainCategories, setIncludeMainCategories] = useState(true);
  const [includeSubcategories, setIncludeSubcategories] = useState(true);
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
    } else {
      setError('Please upload a .eml file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.eml')) {
      setFile(selectedFile);
      setError(null);
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
    setProcessingStage('uploading');

    try {
      // Read file as base64
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1];
          
          setProcessingStage('parsing');
          
          // Parse and get JSON data
          const dataResponse = await fetch('/api/parse-contract', {
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
              returnData: true,
            }),
          });

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

          // Store contract
          const { location, items, addendums, isLocationParsed, orderItemsValidation } = dataResult.data;
          const newContractId = `contract-${Date.now()}-${location.orderNo}`;
          
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
              columnBLabel: 'Initial', // Blank rows use 'Initial'
              isBlankRow: true,
            });
            allItems.push({
              type: 'item',
              productService: '',
              qty: '',
              rate: '',
              amount: '',
              columnBLabel: 'Initial', // Blank rows use 'Initial'
              isBlankRow: true,
            });
            
            // Process each addendum
            addendums.forEach((addendum: any) => {
              // Add addendum header item
              const addendumNum = addendum.addendumNumber;
              const urlId = addendum.urlId || addendum.addendumNumber;
              const headerText = `Addendum #${addendumNum} (${urlId})`;
              
              allItems.push({
                type: 'maincategory', // Use maincategory type for addendum headers
                productService: headerText,
                qty: '',
                rate: '',
                amount: '',
                columnBLabel: 'Addendum',
                isAddendumHeader: true,
                addendumNumber: addendumNum,
                addendumUrlId: urlId,
              });
              
              // Add addendum items with 'Addendum' marker in column B
              addendum.items.forEach((item: any) => {
                allItems.push({
                  ...item,
                  columnBLabel: 'Addendum', // Mark all addendum items
                });
              });
            });
          }
          
          // Ensure all main items have 'Initial' marker (if not already set)
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
            isLocationParsed: isLocationParsed !== false, // Default to true if not provided
            orderItemsValidation: orderItemsValidation, // Include validation result
          };

          // Store in localStorage first to ensure it's available immediately
          // This fixes the issue where GET doesn't work the first time
          try {
            const { LocalStorageStore } = await import('@/lib/store/localStorageStore');
            LocalStorageStore.addContract(contractData);
            console.log('Contract stored in localStorage');
          } catch (localStorageError) {
            console.warn('localStorage storage failed:', localStorageError);
          }

          // Also try to store contract via API (for server-side access)
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
      setError(err instanceof Error ? err.message : 'Failed to process contract');
      setIsProcessing(false);
      setProcessingStage('idle');
    }
  };

  const getProcessingText = () => {
    switch (processingStage) {
      case 'uploading':
        return 'Uploading...';
      case 'parsing':
        return 'Parsing contract...';
      case 'storing':
        return 'Storing contract...';
      default:
        return 'Processing...';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Contract</CardTitle>
        <CardDescription>
          Upload a signed build contract .eml file to parse and view in dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Privacy Disclaimer */}
        <div className="flex justify-end">
          <PrivacyDisclaimer />
        </div>

        {/* Drag and Drop Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-primary/50'
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
              className="space-y-4"
            >
              <FileText className="h-12 w-12 text-primary mx-auto" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setError(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Remove file
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-primary hover:underline">Click to upload</span>
                  {' '}or drag and drop
                </Label>
                <Input
                  id="file-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".eml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  EML files only
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
          >
            <p className="text-sm text-destructive">{error}</p>
          </motion.div>
        )}

        {/* Options */}
        {file && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4 border-t pt-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="add-addendum"
                  checked={addAddendum}
                  onCheckedChange={(checked) => setAddAddendum(checked === true)}
                />
                <Label htmlFor="add-addendum" className="cursor-pointer">
                  Add Addendum
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delete-extra-rows"
                  checked={deleteExtraRows}
                  onCheckedChange={(checked) => setDeleteExtraRows(checked === true)}
                />
                <Label htmlFor="delete-extra-rows" className="cursor-pointer">
                  Delete Extra Rows
                </Label>
              </div>
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

            {addAddendum && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <Label htmlFor="addendum-links">Addendum Links (one per line)</Label>
                <Textarea
                  id="addendum-links"
                  value={addendumLinks}
                  onChange={(e) => setAddendumLinks(e.target.value)}
                  placeholder="https://l1.prodbx.com/go/view/?35587.426.20251112100816&#10;https://l1.prodbx.com/go/view/?35279.426.20251020095021"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Enter one link per line. Links will be processed in order.
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Process Button */}
        {file && (
          <Button
            onClick={handleUpload}
            disabled={isProcessing}
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
        )}
      </CardContent>
    </Card>
  );
}

