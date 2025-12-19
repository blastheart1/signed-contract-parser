'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, FileSpreadsheet, AlertTriangle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { StoredContract } from '@/lib/store/contractStore';
import CustomerInfo from '@/components/dashboard/CustomerInfo';
import OrderTable from '@/components/dashboard/OrderTable';
import InvoiceTable from '@/components/dashboard/InvoiceTable';
import InvoiceSummary from '@/components/dashboard/InvoiceSummary';
import OrderItemsValidationAlert from '@/components/dashboard/OrderItemsValidationAlert';
import DeleteCustomerButton from '@/components/dashboard/DeleteCustomerButton';
import ReuploadContract from '@/components/dashboard/ReuploadContract';
import { useSession } from '@/hooks/use-session';
import type { UserRole } from '@/lib/auth/permissions';

function CustomerDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contract, setContract] = useState<StoredContract | null>(null);
  
  // Check if we came from trash (based on query param, will be enhanced with isDeleted later if contract exists)
  const fromTrash = searchParams.get('from') === 'trash';
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentItems, setCurrentItems] = useState<any[]>([]);
  const [invoiceRefreshTrigger, setInvoiceRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  
  // Get user session for role-based permissions
  const { user } = useSession();
  const userRole: UserRole | null = (user?.role as UserRole) || null;
  
  // Refresh invoice summary when order items are saved
  const handleOrderItemsSave = async () => {
    await refreshContract();
    setInvoiceRefreshTrigger(prev => prev + 1); // Also refresh invoice summary
  };

  const fetchContract = useCallback(async () => {
    if (!params.id) {
      console.error('[CustomerDetailPage] No params.id provided');
      setError('No customer ID provided');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      console.log(`[CustomerDetailPage] ===== Starting fetchContract =====`);
      console.log(`[CustomerDetailPage] params.id:`, params.id);
      console.log(`[CustomerDetailPage] params:`, params);
      
      // Try API first
      console.log(`[CustomerDetailPage] Step 1: Fetching from /api/contracts/${params.id}`);
      let res;
      try {
        res = await fetch(`/api/contracts/${params.id}`);
        console.log(`[CustomerDetailPage] API response status:`, res.status, res.statusText);
      } catch (fetchError) {
        console.error('[CustomerDetailPage] Fetch error:', fetchError);
        throw new Error(`Failed to fetch from API: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
      }
      
      let data;
      try {
        data = await res.json();
        console.log(`[CustomerDetailPage] API response data:`, data);
      } catch (parseError) {
        console.error('[CustomerDetailPage] JSON parse error:', parseError);
        throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
      
      if (data.success && data.contract) {
        console.log(`[CustomerDetailPage] ✓ Contract found via API`);
        console.log(`[CustomerDetailPage] Contract structure:`, {
          hasId: !!data.contract.id,
          hasCustomer: !!data.contract.customer,
          hasOrder: !!data.contract.order,
          hasItems: !!data.contract.items,
          itemsCount: data.contract.items?.length || 0,
          customerId: data.contract.customer?.dbxCustomerId,
          orderNo: data.contract.order?.orderNo,
        });
        
        // Validate contract structure
        if (!data.contract.customer) {
          throw new Error('Contract missing customer data');
        }
        if (!data.contract.order) {
          throw new Error('Contract missing order data');
        }
        if (!Array.isArray(data.contract.items)) {
          console.warn('[CustomerDetailPage] Contract items is not an array, setting to empty array');
          data.contract.items = [];
        }
        
        setContract(data.contract);
        setCurrentItems(data.contract.items || []);
        setLoading(false);
        console.log(`[CustomerDetailPage] ===== fetchContract completed successfully =====`);
        return;
      }
      
      console.warn(`[CustomerDetailPage] Contract not found via API. Response:`, data);
      
      // If not found in API, try localStorage fallback
      console.log(`[CustomerDetailPage] Step 2: Trying localStorage fallback...`);
      try {
        const { LocalStorageStore } = await import('@/lib/store/localStorageStore');
        const localContract = LocalStorageStore.getContract(params.id as string);
        
        if (localContract) {
          console.log(`[CustomerDetailPage] ✓ Contract found in localStorage`);
          setContract(localContract);
          setCurrentItems(localContract.items || []);
          setLoading(false);
          return;
        }
        
        // Try to find by customer ID or name
        console.log(`[CustomerDetailPage] Searching all localStorage contracts...`);
        const allLocalContracts = LocalStorageStore.getAllContracts();
        console.log(`[CustomerDetailPage] Found ${allLocalContracts.length} contracts in localStorage`);
        const found = allLocalContracts.find(
          (c: any) => c.customer?.dbxCustomerId === params.id || 
                     c.customer?.clientName === params.id ||
                     c.id === params.id
        );
        
        if (found) {
          console.log(`[CustomerDetailPage] ✓ Contract found in localStorage by search`);
          setContract(found);
          setCurrentItems(found.items || []);
          setLoading(false);
          return;
        } else {
          console.log(`[CustomerDetailPage] No matching contract found in localStorage`);
        }
      } catch (localStorageError) {
        console.error('[CustomerDetailPage] localStorage fallback error:', localStorageError);
        console.error('[CustomerDetailPage] localStorage error details:', {
          message: localStorageError instanceof Error ? localStorageError.message : 'Unknown error',
          stack: localStorageError instanceof Error ? localStorageError.stack : undefined,
        });
      }
      
      // If still not found, try fetching all contracts from API
      console.log(`[CustomerDetailPage] Step 3: Fetching all contracts from API...`);
      let allRes;
      try {
        allRes = await fetch('/api/contracts');
        console.log(`[CustomerDetailPage] All contracts API response status:`, allRes.status);
      } catch (fetchError) {
        console.error('[CustomerDetailPage] Error fetching all contracts:', fetchError);
        throw new Error(`Failed to fetch all contracts: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
      }
      
      let allData;
      try {
        allData = await allRes.json();
        console.log(`[CustomerDetailPage] All contracts response:`, {
          success: allData.success,
          contractsCount: allData.contracts?.length || 0,
        });
      } catch (parseError) {
        console.error('[CustomerDetailPage] Error parsing all contracts response:', parseError);
        throw new Error(`Failed to parse all contracts response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
      
      if (allData.success && allData.contracts) {
        console.log(`[CustomerDetailPage] Searching through ${allData.contracts.length} contracts...`);
        const found = allData.contracts.find(
          (c: any) => c.customer?.dbxCustomerId === params.id || 
                     c.customer?.clientName === params.id ||
                     c.id === params.id
        );
        if (found) {
          console.log(`[CustomerDetailPage] ✓ Contract found in all contracts list`);
          setContract(found);
          setCurrentItems(found.items || []);
        } else {
          console.error(`[CustomerDetailPage] ✗ Contract not found in any of the ${allData.contracts.length} contracts`);
          setError(`Contract not found. Searched by ID: ${params.id}`);
        }
      } else {
        console.error(`[CustomerDetailPage] ✗ Failed to fetch all contracts:`, allData);
        setError(`Failed to fetch contracts: ${allData.error || 'Unknown error'}`);
      }
      
      setLoading(false);
      console.log(`[CustomerDetailPage] ===== fetchContract completed =====`);
    } catch (error) {
      console.error('[CustomerDetailPage] ===== ERROR in fetchContract =====');
      console.error('[CustomerDetailPage] Error type:', error?.constructor?.name);
      console.error('[CustomerDetailPage] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[CustomerDetailPage] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[CustomerDetailPage] Full error object:', error);
      setError(error instanceof Error ? error.message : 'Failed to load customer');
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  const refreshContract = useCallback(async () => {
    if (!params.id) return;
    
    try {
      console.log(`[CustomerDetailPage] Refreshing contract with ID: ${params.id}`);
      
      // Try multiple ID formats: order ID (UUID), order number, or customer ID
      let res = await fetch(`/api/contracts/${params.id}`);
      let data = await res.json();
      
      // If not found and we have a contract with order ID, try using order number
      if (!data.success && contract?.order?.orderNo) {
        console.log(`[CustomerDetailPage] Retrying with order number: ${contract.order.orderNo}`);
        res = await fetch(`/api/contracts/${contract.order.orderNo}`);
        data = await res.json();
      }
      
      // If still not found and we have customer ID, try that
      if (!data.success && contract?.customer?.dbxCustomerId) {
        console.log(`[CustomerDetailPage] Retrying with customer ID: ${contract.customer.dbxCustomerId}`);
        res = await fetch(`/api/contracts/${contract.customer.dbxCustomerId}`);
        data = await res.json();
      }
      
      if (data.success && data.contract) {
        console.log(`[CustomerDetailPage] Successfully refreshed contract`);
        setContract(data.contract);
        setCurrentItems(data.contract.items || []);
      } else {
        console.error(`[CustomerDetailPage] Failed to refresh contract:`, data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[CustomerDetailPage] Error refreshing contract:', error);
    }
  }, [params.id, contract]);

  const handleGenerateSpreadsheet = async () => {
    if (!contract) return;

    setGenerating(true);
    try {
      // Use current items from OrderTable if available, otherwise use contract items
      const itemsToUse = currentItems.length > 0 ? currentItems : contract.items;
      
      // Try POST endpoint with contract data (works for both API and localStorage contracts)
      const response = await fetch(`/api/contracts/${contract.id}/generate-spreadsheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: itemsToUse,
          contract: contract,
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        
        // Extract filename from Content-Disposition header (same logic as landing page)
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
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to generate spreadsheet: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating spreadsheet:', error);
      alert('Error generating spreadsheet');
    } finally {
      setGenerating(false);
    }
  };

  // Log render state
  useEffect(() => {
    console.log('[CustomerDetailPage] ===== Render State =====');
    console.log('[CustomerDetailPage] loading:', loading);
    console.log('[CustomerDetailPage] error:', error);
    console.log('[CustomerDetailPage] contract:', contract ? {
      hasId: !!contract.id,
      hasCustomer: !!contract.customer,
      hasOrder: !!contract.order,
      hasItems: !!contract.items,
    } : null);
    console.log('[CustomerDetailPage] currentItems count:', currentItems.length);
  }, [loading, error, contract, currentItems]);

  if (loading) {
    console.log('[CustomerDetailPage] Rendering loading state');
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    console.log('[CustomerDetailPage] Rendering error state:', error);
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Error: {error}</p>
        <p className="text-sm text-muted-foreground mb-4">Check the browser console for detailed logs.</p>
        <Button variant="outline" asChild>
          <Link href={fromTrash ? "/dashboard/trash" : "/dashboard/customers"}>
            {fromTrash ? "Back to Trash" : "Back to Customers"}
          </Link>
        </Button>
      </div>
    );
  }

  if (!contract) {
    console.log('[CustomerDetailPage] Rendering not found state');
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Contract not found</p>
        <p className="text-sm text-muted-foreground mb-4">ID: {params.id}</p>
        <Button variant="outline" asChild>
          <Link href={fromTrash ? "/dashboard/trash" : "/dashboard/customers"}>
            {fromTrash ? "Back to Trash" : "Back to Customers"}
          </Link>
        </Button>
      </div>
    );
  }

  console.log('[CustomerDetailPage] Rendering contract view');
  
  // Check if contract is deleted
  const contractWithDeleted = contract as StoredContract & { isDeleted?: boolean; deletedAt?: Date | null };
  const isDeleted = contractWithDeleted.isDeleted === true;
  // Update fromTrash to also consider if contract is deleted (even without query param)
  const fromTrashWithDeleted = fromTrash || isDeleted;
  
  try {
    return (
    <div className="space-y-8">
      {/* Deleted Contract Banner */}
      {isDeleted && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>This contract has been deleted</AlertTitle>
            <AlertDescription>
              This contract is in read-only mode. Restore it to make changes.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex justify-between items-start"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href={fromTrashWithDeleted ? "/dashboard/trash" : "/dashboard/customers"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {fromTrashWithDeleted ? "Back to Trash" : "Back to Customers"}
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowUploadDialog(true)}
            disabled={isDeleted}
            size="lg"
            variant="outline"
            className="gap-2"
          >
            <Upload className="h-5 w-5" />
            Upload Contract
          </Button>
          <Button
            onClick={handleGenerateSpreadsheet}
            disabled={generating}
            size="lg"
            className="gap-2"
          >
            {generating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-5 w-5" />
                Generate Spreadsheet
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Customer Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <CustomerInfo 
              contract={contract}
              isDeleted={isDeleted}
              onContractUpdate={async (updatedContract) => {
                setContract(updatedContract);
                // Refresh from server after a short delay to ensure update is saved
                setTimeout(() => {
                  fetchContract();
                }, 500);
              }}
              onInvoiceChange={invoiceRefreshTrigger}
            />
          </motion.div>

      {/* Tabs: Order Items and Invoices */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Tabs defaultValue="order-items" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="order-items">Order Items</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>
          <TabsContent value="order-items" className="mt-6 space-y-4">
            <OrderItemsValidationAlert 
              contract={contract} 
              currentItems={currentItems}
              customerId={contract.customer?.dbxCustomerId}
            />
            <OrderTable 
              items={contract.items} 
              onItemsChange={setCurrentItems} 
              orderId={contract.id}
              onSaveSuccess={handleOrderItemsSave}
              isDeleted={isDeleted}
              projectStartDate={(contract.order as any)?.projectStartDate}
              userRole={userRole}
            />
          </TabsContent>
          <TabsContent value="invoices" className="mt-6 space-y-6">
            <InvoiceTable 
              orderId={contract.id} 
              onInvoiceChange={() => setInvoiceRefreshTrigger(prev => prev + 1)}
              isDeleted={isDeleted}
            />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Upload Contract Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Contract</DialogTitle>
            <DialogDescription>
              Upload a new EML file or add DBX links to add addendums to this contract.
            </DialogDescription>
          </DialogHeader>
          {contract && (
            <ReuploadContract
              contract={contract}
              onSuccess={async () => {
                await fetchContract();
                setShowUploadDialog(false);
              }}
              onClose={() => setShowUploadDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
    );
  } catch (renderError) {
    console.error('[CustomerDetailPage] ===== RENDER ERROR =====');
    console.error('[CustomerDetailPage] Render error type:', renderError?.constructor?.name);
    console.error('[CustomerDetailPage] Render error message:', renderError instanceof Error ? renderError.message : String(renderError));
    console.error('[CustomerDetailPage] Render error stack:', renderError instanceof Error ? renderError.stack : 'No stack trace');
    console.error('[CustomerDetailPage] Full render error:', renderError);
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Render Error: {renderError instanceof Error ? renderError.message : 'Unknown error'}</p>
        <p className="text-sm text-muted-foreground mb-4">Check the browser console for detailed logs.</p>
        <Button variant="outline" asChild>
          <Link href={fromTrash ? "/dashboard/trash" : "/dashboard/customers"}>
            {fromTrash ? "Back to Trash" : "Back to Customers"}
          </Link>
        </Button>
      </div>
    );
  }
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CustomerDetailContent />
    </Suspense>
  );
}
