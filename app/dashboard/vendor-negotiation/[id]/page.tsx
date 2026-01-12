'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
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
import VendorApprovalOrderItemsTable from '@/components/dashboard/VendorApprovalOrderItemsTable';
import type { OrderItem } from '@/lib/tableExtractor';

interface OrderApproval {
  id: string;
  referenceNo: string;
  vendorId: string;
  vendorName: string | null;
  customerId: string;
  customerName: string | null;
  orderId: string;
  stage: 'draft' | 'sent' | 'negotiating' | 'approved';
  pmApproved: boolean;
  vendorApproved: boolean;
  dateCreated: string;
  sentAt: string | null;
  selectedItems: Array<{
    id: string;
    orderItemId: string;
    orderItem: any;
  }>;
}

const STAGE_COLORS: Record<string, string> = {
  draft: 'bg-gray-500',
  negotiating: 'bg-yellow-500',
  approved: 'bg-green-500',
};

const STAGE_LABELS: Record<string, string> = {
  draft: 'Draft',
  negotiating: 'Negotiating',
  approved: 'Approved',
};

const STAGE_ORDER = ['draft', 'negotiating', 'approved'];

export default function OrderApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useSession();
  const [approval, setApproval] = useState<OrderApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  
  // #region agent log
  // Log isEditMode state changes
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:70',message:'isEditMode state changed',data:{isEditMode,stage:approval?.stage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  }, [isEditMode, approval?.stage]);
  // #endregion
  const [saving, setSaving] = useState(false);
  const [stageChangeDialogOpen, setStageChangeDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState<string | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [isVendor, setIsVendor] = useState(false);

  useEffect(() => {
    if (user?.role === 'vendor') {
      setIsVendor(true);
    }
  }, [user]);

  const fetchApproval = useCallback(async () => {
    if (!params.id) return;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:83',message:'fetchApproval entry',data:{approvalId:params.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion

    setLoading(true);
    try {
      const response = await fetch(`/api/order-approvals/${params.id}`);
      const data = await response.json();

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:91',message:'Approval API response',data:{success:data.success,customerId:data.data?.customerId,stage:data.data?.stage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion

      if (data.success) {
        setApproval(data.data);
        setSelectedItemIds(new Set(data.data.selectedItems?.map((item: any) => item.orderItemId) || []));
        
        // Fetch ALL order items for the customer (from all orders)
        // Use contracts API to get all contracts, then filter by customerId
        const contractsResponse = await fetch(`/api/contracts`);
        const contractsData = await contractsResponse.json();
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:112',message:'Contracts API response',data:{success:contractsData.success,contractsCount:contractsData.contracts?.length||0,customerId:data.data.customerId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        if (contractsData.success && contractsData.contracts) {
          // Filter contracts by customerId (contracts API returns all contracts)
          const customerContracts = contractsData.contracts.filter((contract: any) => 
            contract.customer?.dbxCustomerId === data.data.customerId
          );
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:120',message:'Filtered contracts by customerId',data:{totalContracts:contractsData.contracts.length,filteredContracts:customerContracts.length,customerId:data.data.customerId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // Collect all order IDs from filtered contracts
          // Note: contract.id is the order ID (UUID), not contract.order.id
          const allOrderIds: string[] = [];
          customerContracts.forEach((contract: any) => {
            // contract.id is the order UUID, contract.order.orderNo is the order number
            if (contract.id) {
              allOrderIds.push(contract.id);
            }
          });
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:130',message:'Order IDs collected (FIXED)',data:{orderIdsCount:allOrderIds.length,orderIds:allOrderIds.slice(0,5),contractsProcessed:customerContracts.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          // Fetch items from all orders
          const allItems: any[] = [];
          for (const orderId of allOrderIds) {
            try {
              const orderResponse = await fetch(`/api/orders/${orderId}/items`);
              const orderData = await orderResponse.json();
              
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:115',message:'Order items API response',data:{orderId,success:orderData.success,itemsCount:orderData.items?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
              
              if (orderData.success && orderData.items) {
                console.log(`[OrderApproval] Fetched ${orderData.items.length} items from order ${orderId}`);
                allItems.push(...orderData.items);
              } else {
                console.warn(`[OrderApproval] No items found for order ${orderId}`);
              }
            } catch (err) {
              console.error(`[OrderApproval] Error fetching items for order ${orderId}:`, err);
            }
          }
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:126',message:'Total items before conversion',data:{totalItems:allItems.length,orderIdsProcessed:allOrderIds.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          // Create maps from selectedItems (snapshot data)
          const negotiatedAmountMap = new Map<string, number | null>();
          const snapshotQtyMap = new Map<string, number | string>();
          const snapshotRateMap = new Map<string, number | string>();
          const snapshotAmountMap = new Map<string, number>();
          if (data.data.selectedItems) {
            data.data.selectedItems.forEach((selectedItem: any) => {
              if (selectedItem.orderItemId) {
                if (selectedItem.negotiatedVendorAmount !== undefined) {
                  const amount = selectedItem.negotiatedVendorAmount 
                    ? parseFloat(String(selectedItem.negotiatedVendorAmount)) 
                    : null;
                  negotiatedAmountMap.set(selectedItem.orderItemId, amount);
                }
                // Use snapshot qty/rate/amount if available, otherwise use order_items values
                if (selectedItem.qty !== null && selectedItem.qty !== undefined) {
                  snapshotQtyMap.set(selectedItem.orderItemId, selectedItem.qty);
                }
                if (selectedItem.rate !== null && selectedItem.rate !== undefined) {
                  snapshotRateMap.set(selectedItem.orderItemId, selectedItem.rate);
                }
                if (selectedItem.amount !== null && selectedItem.amount !== undefined) {
                  snapshotAmountMap.set(selectedItem.orderItemId, parseFloat(String(selectedItem.amount)) || 0);
                }
              }
            });
          }

          // Convert database order items to OrderItem format, using snapshot data when available
          // Determine if current user is vendor (we need this here to conditionally include originalAmount)
          const currentUserIsVendor = user?.role === 'vendor';
          
          const convertedItems: (OrderItem & { originalAmount?: number })[] = allItems.map((dbItem: any) => {
            const snapshotQty = snapshotQtyMap.get(dbItem.id);
            const snapshotRate = snapshotRateMap.get(dbItem.id);
            const snapshotAmount = snapshotAmountMap.get(dbItem.id);
            
            // Get original amount from order_items (only for PM users, not vendors)
            const originalAmount = dbItem.amount ? parseFloat(String(dbItem.amount)) : 0;
            
            return {
              id: dbItem.id,
              type: dbItem.itemType || 'item',
              productService: dbItem.productService || '',
              // Use only snapshot data - do NOT fall back to order_items (prevents vendors from seeing original estimates)
              qty: snapshotQty !== undefined 
                ? (typeof snapshotQty === 'number' ? snapshotQty : parseFloat(String(snapshotQty)) || '')
                : '',
              rate: snapshotRate !== undefined
                ? (typeof snapshotRate === 'number' ? snapshotRate : parseFloat(String(snapshotRate)) || '')
                : '',
              amount: snapshotAmount !== undefined
                ? snapshotAmount
                : 0,
              // Include originalAmount only for PM users (not vendors) - used for price difference calculation
              ...(currentUserIsVendor ? {} : { originalAmount }),
              progressOverallPct: dbItem.progressOverallPct ? parseFloat(String(dbItem.progressOverallPct)) : undefined,
              completedAmount: dbItem.completedAmount ? parseFloat(String(dbItem.completedAmount)) : undefined,
              previouslyInvoicedPct: dbItem.previouslyInvoicedPct ? parseFloat(String(dbItem.previouslyInvoicedPct)) : undefined,
              previouslyInvoicedAmount: dbItem.previouslyInvoicedAmount ? parseFloat(String(dbItem.previouslyInvoicedAmount)) : undefined,
              newProgressPct: dbItem.newProgressPct ? parseFloat(String(dbItem.newProgressPct)) : undefined,
              thisBill: dbItem.thisBill ? parseFloat(String(dbItem.thisBill)) : undefined,
              mainCategory: dbItem.mainCategory || undefined,
              subCategory: dbItem.subCategory || undefined,
              // Vendor selection fields
              vendorName1: dbItem.vendorName1 || undefined,
              vendorPercentage: dbItem.vendorPercentage ? parseFloat(String(dbItem.vendorPercentage)) : undefined,
              totalWorkAssignedToVendor: dbItem.totalWorkAssignedToVendor ? parseFloat(String(dbItem.totalWorkAssignedToVendor)) : undefined,
              estimatedVendorCost: dbItem.estimatedVendorCost ? parseFloat(String(dbItem.estimatedVendorCost)) : undefined,
              totalAmountWorkCompleted: dbItem.totalAmountWorkCompleted ? parseFloat(String(dbItem.totalAmountWorkCompleted)) : undefined,
              vendorBillingToDate: dbItem.vendorBillingToDate ? parseFloat(String(dbItem.vendorBillingToDate)) : undefined,
              vendorSavingsDeficit: dbItem.vendorSavingsDeficit ? parseFloat(String(dbItem.vendorSavingsDeficit)) : undefined,
              negotiatedVendorAmount: negotiatedAmountMap.get(dbItem.id) ?? undefined,
            };
          });
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:155',message:'Items after conversion',data:{convertedCount:convertedItems.length,originalCount:allItems.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          
          console.log('[OrderApproval] Fetched all customer order items:', convertedItems.length, 'from', allOrderIds.length, 'orders');
          setOrderItems(convertedItems);
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:156',message:'setOrderItems called',data:{itemsCount:convertedItems.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:158',message:'No contracts found',data:{success:contractsData.success,hasContracts:!!contractsData.contracts},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          console.log('[OrderApproval] No contracts found for customer');
          setOrderItems([]);
        }
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch order approval',
          variant: 'destructive',
        });
        router.push('/dashboard/vendor-negotiation');
      }
    } catch (error) {
      console.error('Error fetching approval:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch order approval',
        variant: 'destructive',
      });
      router.push('/dashboard/vendor-negotiation');
    } finally {
      setLoading(false);
    }
  }, [params.id, router, toast]);

  useEffect(() => {
    fetchApproval();
  }, [fetchApproval]);

  // #region agent log
  // Log orderItems state changes
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:178',message:'orderItems state changed',data:{itemsCount:orderItems.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  }, [orderItems]);
  
  // Log isEditMode state changes
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/vendor-negotiation/[id]/page.tsx:183',message:'isEditMode state changed',data:{isEditMode,stage:approval?.stage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  }, [isEditMode, approval?.stage]);
  // #endregion

  const handleStageChange = async (targetStage: string) => {
    if (!approval) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/order-approvals/${approval.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: `Stage changed to ${STAGE_LABELS[targetStage]}`,
        });
        fetchApproval();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to change stage',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error changing stage:', error);
      toast({
        title: 'Error',
        description: 'Failed to change stage',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setStageChangeDialogOpen(false);
      setNewStage(null);
    }
  };

  const handleApprove = async () => {
    if (!approval) return;

    setSaving(true);
    try {
      const isPmApproval = user?.role !== 'vendor';
      const updateData: any = {};
      
      if (isPmApproval) {
        // PM: Toggle approval (can approve or retract)
        updateData.pmApproved = !approval.pmApproved;
      } else {
        // Vendor: Toggle approval (can approve or retract)
        updateData.vendorApproved = !approval.vendorApproved;
      }

      const response = await fetch(`/api/order-approvals/${approval.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        const action = (isPmApproval ? !approval.pmApproved : !approval.vendorApproved) ? 'approved' : 'retracted';
        toast({
          title: 'Success',
          description: `Approval ${action} successfully`,
        });
        fetchApproval();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update approval',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating approval:', error);
      toast({
        title: 'Error',
        description: 'Failed to update approval',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setApprovalDialogOpen(false);
    }
  };

  const handleSendToVendor = async () => {
    if (!approval) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/order-approvals/${approval.id}/send`, {
        method: 'PATCH',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Approval sent to vendor successfully',
        });
        fetchApproval();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send to vendor',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending to vendor:', error);
      toast({
        title: 'Error',
        description: 'Failed to send to vendor',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };


  // PM can edit in draft stage, vendors can edit in negotiating stage
  const canEditItems = approval?.stage === 'draft' && !isVendor || approval?.stage === 'negotiating' && isVendor;
  const isReadOnly = approval?.stage === 'approved';
  const canChangeStage = !isReadOnly && !isVendor;
  const canSendToVendor = approval?.stage === 'draft' && selectedItemIds.size > 0 && !isVendor;

  const currentStageIndex = approval ? STAGE_ORDER.indexOf(approval.stage) : -1;
  const canGoBack = currentStageIndex > 0;
  const canGoForward = currentStageIndex < STAGE_ORDER.length - 1;


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!approval) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Order approval not found</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/vendor-negotiation">Back to List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/vendor-negotiation">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{approval.customerName || '—'}</CardTitle>
          <CardDescription>
            Vendor: {approval.vendorName || '—'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Reference</p>
            <p className="font-medium font-mono">{approval.referenceNo}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Date Created</p>
              <p className="font-medium">
                {new Date(approval.dateCreated).toLocaleDateString()}
              </p>
            </div>
            {approval.sentAt && (
              <div>
                <p className="text-sm text-muted-foreground">Sent At</p>
                <p className="font-medium">
                  {new Date(approval.sentAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">PM Approved:</span>
              {approval.pmApproved ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Vendor Approved:</span>
              {approval.vendorApproved ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-3">Stage:</p>
            <div className="flex items-center gap-2">
              {STAGE_ORDER.map((stage, index) => {
                const isCurrent = approval.stage === stage;
                const isCompleted = index < currentStageIndex;
                // Only allow clicking to move to 'approved' if both parties have approved
                let isClickable = false;
                if (canChangeStage && !saving && index !== currentStageIndex) {
                  if (stage === 'approved') {
                    // Can only move to approved if both parties have approved
                    isClickable = approval.pmApproved && approval.vendorApproved;
                  } else {
                    // Can move to other stages normally
                    isClickable = true;
                  }
                }
                
                return (
                  <div key={stage} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (isClickable) {
                          setNewStage(stage);
                          setStageChangeDialogOpen(true);
                        }
                      }}
                      disabled={!isClickable}
                      className={`
                        min-w-[100px] text-center flex items-center justify-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                        ${isCurrent 
                          ? `${STAGE_COLORS[stage] || 'bg-gray-500'} text-white cursor-default` 
                          : isCompleted
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-default'
                          : isClickable
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer'
                          : 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        }
                      `}
                    >
                      {STAGE_LABELS[stage]}
                    </button>
                    {index < STAGE_ORDER.length - 1 && (
                      <div className={`w-2 h-0.5 mx-1 ${isCompleted ? 'bg-gray-400' : 'bg-gray-300 dark:bg-gray-700'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>


          {canSendToVendor && (
            <div className="pt-4 border-t">
              <Button onClick={handleSendToVendor} disabled={saving}>
                <Send className="h-4 w-4 mr-2" />
                Send to Vendor
              </Button>
            </div>
          )}

          {approval.stage === 'negotiating' && (
            <div className="pt-4 border-t space-y-2">
              {!isVendor && (
                <Button
                  onClick={() => setApprovalDialogOpen(true)}
                  disabled={saving}
                  variant="outline"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {approval.pmApproved ? 'Retract Approval (PM)' : 'Approve (PM)'}
                </Button>
              )}

              {isVendor && (
                <Button
                  onClick={() => setApprovalDialogOpen(true)}
                  disabled={saving}
                  variant="outline"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {approval.vendorApproved ? 'Retract Approval (Vendor)' : 'Approve (Vendor)'}
                </Button>
              )}

              {!isVendor && approval.pmApproved && approval.vendorApproved && (
                <Button
                  onClick={() => {
                    setNewStage('approved');
                    setStageChangeDialogOpen(true);
                  }}
                  disabled={saving}
                  className="ml-2"
                >
                  Move to Approved
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <VendorApprovalOrderItemsTable
        items={orderItems}
        selectedItemIds={selectedItemIds}
        onSelectedItemsChange={setSelectedItemIds}
        approvalId={approval.id}
        isEditMode={isEditMode}
        onEditModeChange={setIsEditMode}
        canEdit={canEditItems}
        onSaveSuccess={fetchApproval}
        saving={saving}
        onSavingChange={setSaving}
        isVendor={isVendor}
      />

      <AlertDialog open={stageChangeDialogOpen} onOpenChange={setStageChangeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change the stage to{' '}
              <strong>{newStage ? STAGE_LABELS[newStage] : ''}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => newStage && handleStageChange(newStage)}
              disabled={saving}
            >
              {saving ? 'Changing...' : 'Change Stage'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isVendor 
                ? (approval.vendorApproved ? 'Retract Vendor Approval' : 'Approve Order (Vendor)')
                : (approval.pmApproved ? 'Retract PM Approval' : 'Approve Order (PM)')
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isVendor
                ? (approval.vendorApproved 
                    ? 'Are you sure you want to retract your approval?'
                    : 'Are you sure you want to approve this order?')
                : (approval.pmApproved
                    ? 'Are you sure you want to retract your approval?'
                    : 'Are you sure you want to approve this order?')
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={saving}>
              {saving 
                ? (isVendor 
                    ? (approval.vendorApproved ? 'Updating...' : 'Approving...')
                    : (approval.pmApproved ? 'Updating...' : 'Approving...')
                  )
                : (isVendor
                    ? (approval.vendorApproved ? 'Retract' : 'Approve')
                    : (approval.pmApproved ? 'Retract' : 'Approve')
                  )
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

