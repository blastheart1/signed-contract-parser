'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Edit, Trash2, History, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { StoredContract } from '@/lib/store/contractStore';
import EditCustomerInfo from './EditCustomerInfo';
import DeleteCustomerButton from './DeleteCustomerButton';
import CustomerHistory from './CustomerHistory';
import RestoreContractDialog from './RestoreContractDialog';

interface CustomerInfoProps {
  contract: StoredContract;
  isDeleted?: boolean;
  onContractUpdate?: (updatedContract: StoredContract) => void;
}

export default function CustomerInfo({ contract, isDeleted = false, onContractUpdate }: CustomerInfoProps) {
  console.log('[CustomerInfo] ===== Component Render =====');
  console.log('[CustomerInfo] contract:', contract ? {
    hasId: !!contract.id,
    hasCustomer: !!contract.customer,
    hasOrder: !!contract.order,
    customerName: contract.customer?.clientName,
    orderNo: contract.order?.orderNo,
  } : 'null');
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [currentContract, setCurrentContract] = useState<StoredContract>(contract);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [stage, setStage] = useState<string>((contract.order as any)?.stage || '');
  const [contractDate, setContractDate] = useState<string>((contract.order as any)?.contractDate || '');
  const [firstBuildInvoiceDate, setFirstBuildInvoiceDate] = useState<string>((contract.order as any)?.firstBuildInvoiceDate || '');
  const [projectStartDate, setProjectStartDate] = useState<string>((contract.order as any)?.projectStartDate || '');
  const [projectEndDate, setProjectEndDate] = useState<string>((contract.order as any)?.projectEndDate || '');
  const [saving, setSaving] = useState(false);
  const [isEditingProjectStatus, setIsEditingProjectStatus] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  
  if (!currentContract?.customer) {
    console.error('[CustomerInfo] Contract missing customer data');
    return (
      <div className="p-4 border border-destructive rounded-md">
        <p className="text-destructive">Error: Contract is missing customer information</p>
      </div>
    );
  }
  
  const fullAddress = `${currentContract.customer.streetAddress}, ${currentContract.customer.city}, ${currentContract.customer.state} ${currentContract.customer.zip}`;
  const needsManualUpdate = currentContract.isLocationParsed === false;

  // Sync with prop changes
  useEffect(() => {
    setCurrentContract(contract);
    // Update project status fields when contract changes
    const order = contract.order as any;
    const newStage = order?.stage || '';
    const newContractDate = order?.contractDate || '';
    const newFirstBuildInvoiceDate = order?.firstBuildInvoiceDate || '';
    const newProjectStartDate = order?.projectStartDate || '';
    const newProjectEndDate = order?.projectEndDate || '';
    
    console.log('[CustomerInfo] Contract updated, loading project status:', {
      stage: newStage,
      contractDate: newContractDate,
      firstBuildInvoiceDate: newFirstBuildInvoiceDate,
      projectStartDate: newProjectStartDate,
      projectEndDate: newProjectEndDate,
    });
    
    setStage(newStage);
    setContractDate(newContractDate);
    setFirstBuildInvoiceDate(newFirstBuildInvoiceDate);
    setProjectStartDate(newProjectStartDate);
    setProjectEndDate(newProjectEndDate);
  }, [contract]);

  const handleSaveProjectStatus = async () => {
    if (!currentContract?.id) {
      console.error('[CustomerInfo] Cannot save: contract ID is missing');
      alert('Cannot save: Contract ID is missing');
      return;
    }

    console.log('[CustomerInfo] Saving project status:', {
      orderId: currentContract.id,
      stage,
      contractDate,
      firstBuildInvoiceDate,
      projectStartDate,
      projectEndDate,
    });

    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${currentContract.id}/project-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          stage: stage || null,
          contractDate: contractDate || null,
          firstBuildInvoiceDate: firstBuildInvoiceDate || null,
          projectStartDate: projectStartDate || null,
          projectEndDate: projectEndDate || null,
        }),
      });

      console.log('[CustomerInfo] Save response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[CustomerInfo] Failed to save project status:', errorData.error || `HTTP ${response.status}`);
        alert(`Failed to save project status: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      console.log('[CustomerInfo] Save response data:', data);

      if (data.success) {
        // Update local contract state
        const updatedContract = {
          ...currentContract,
          order: {
            ...currentContract.order,
            stage: data.order.stage || undefined,
            contractDate: data.order.contractDate || undefined,
            firstBuildInvoiceDate: data.order.firstBuildInvoiceDate || undefined,
            projectStartDate: data.order.projectStartDate || undefined,
            projectEndDate: data.order.projectEndDate || undefined,
          } as any,
        };
        console.log('[CustomerInfo] Updated contract state:', updatedContract);
        setCurrentContract(updatedContract);
        if (onContractUpdate) {
          onContractUpdate(updatedContract);
        }
        // Exit edit mode after successful save
        setIsEditingProjectStatus(false);
      } else {
        console.error('[CustomerInfo] Failed to save project status:', data.error);
        alert(`Failed to save project status: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[CustomerInfo] Error saving project status:', error);
      alert(`Error saving project status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (updatedContract: StoredContract) => {
    setCurrentContract(updatedContract);
    if (onContractUpdate) {
      onContractUpdate(updatedContract);
    }
  };

  const InfoRow = ({ label, value, highlight }: { label: string; value: string | number | undefined; highlight?: boolean }) => (
    <div className="flex justify-between items-center py-1">
      <dt className="text-sm font-medium text-muted-foreground min-w-[140px]">{label}</dt>
      <dd className={`text-sm text-foreground ${highlight ? 'font-bold text-lg' : 'font-medium'} text-right flex-1`}>
        {value || '-'}
      </dd>
    </div>
  );

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          <Card className="h-full flex flex-col">
            <CardContent className="space-y-1 pt-6 flex-1">
              {needsManualUpdate && (
                <div className="mb-4 flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Customer information needs manual update
                  </p>
                </div>
              )}
            <div className="pb-3 flex items-start justify-between gap-4">
              <div className="flex-1 flex items-center gap-3 flex-wrap">
                <h1 className="text-4xl font-bold tracking-tight">{currentContract.customer.clientName || 'Customer'}</h1>
                {/* Stage Badge/Dropdown */}
                {isEditingProjectStatus && !isDeleted ? (
                  <Select value={stage} onValueChange={setStage}>
                    <SelectTrigger id="stage" className="w-[200px]">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="waiting_for_permit">Waiting for Permit</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isDeleted) {
                              setIsEditingProjectStatus(true);
                            }
                          }}
                          disabled={isDeleted}
                          className={isDeleted ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                        >
                          <Badge
                            variant={
                              stage === 'active'
                                ? 'default'
                                : stage === 'waiting_for_permit'
                                ? 'secondary'
                                : stage === 'completed'
                                ? 'default'
                                : 'outline'
                            }
                            className={`min-w-[160px] text-center flex items-center justify-center ${
                              stage === 'active'
                                ? 'bg-green-600 hover:bg-green-700'
                                : stage === 'waiting_for_permit'
                                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                : stage === 'completed'
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : ''
                            }`}
                          >
                            {stage === 'waiting_for_permit'
                              ? 'Waiting for Permit'
                              : stage === 'active'
                              ? 'Active'
                              : stage === 'completed'
                              ? 'Completed'
                              : 'No Stage'}
                          </Badge>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Click to Update</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                {!isDeleted && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(true)}
                      className="p-1 hover:bg-muted rounded-md transition-colors duration-150"
                      aria-label="Edit customer"
                    >
                      <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                    {currentContract?.customer?.dbxCustomerId && (
                      <>
                        <button
                          type="button"
                          onClick={() => setHistoryModalOpen(true)}
                          className="p-1 hover:bg-muted rounded-md transition-colors duration-150"
                          aria-label="View history"
                        >
                          <History className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </button>
                        <DeleteCustomerButton contract={currentContract} />
                      </>
                    )}
                  </>
                )}
                {isDeleted && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-1 opacity-50 cursor-not-allowed">
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Restore first before editing</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            <div className="pb-3">
              <p className="text-muted-foreground mt-2">
                Order #{currentContract.order.orderNo || 'N/A'}
                {currentContract.customer.dbxCustomerId && (
                  <span className="ml-2">| Customer #{currentContract.customer.dbxCustomerId}</span>
                )}
              </p>
            </div>
            {(currentContract.customer as any).status && (
              <div className="flex justify-between items-center py-1">
                <dt className="text-sm font-medium text-muted-foreground min-w-[140px]">Status</dt>
                <dd className="text-sm text-foreground font-medium text-right flex-1">
                  {(currentContract.customer as any).status === 'completed' ? (
                    <Badge variant="default" className="bg-green-600 min-w-[120px] text-center">Completed</Badge>
                  ) : (
                    <Badge variant="secondary" className="min-w-[120px] text-center">Pending Updates</Badge>
                  )}
                </dd>
              </div>
            )}
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMoreInfo(!showMoreInfo)}
                className="w-full justify-between p-2 h-auto"
              >
                <span className="text-sm font-medium text-muted-foreground">More information</span>
                {showMoreInfo ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <motion.div
                initial={false}
                animate={{
                  height: showMoreInfo ? 'auto' : 0,
                  opacity: showMoreInfo ? 1 : 0,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                {showMoreInfo && (
                  <div className="mt-2 space-y-1 pt-2 border-t">
                    <InfoRow label="Email" value={currentContract.customer.email} />
                    <InfoRow label="Phone" value={currentContract.customer.phone} />
                    <InfoRow label="Address" value={currentContract.customer.streetAddress} />
                    <InfoRow label="City" value={currentContract.customer.city} />
                    <InfoRow label="State" value={currentContract.customer.state} />
                    <InfoRow label="Zip" value={currentContract.customer.zip} />
                    <div className="pt-1">
                      <div className="flex justify-between items-start py-1">
                        <dt className="text-sm font-medium text-muted-foreground min-w-[140px]">Full Address</dt>
                        <dd className="text-sm text-foreground font-medium text-right flex-1">{fullAddress}</dd>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
            {/* Project Status Fields - Hidden when More Information is expanded */}
            <AnimatePresence>
              {!showMoreInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                  className="pt-4 border-t mt-2"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-sm font-semibold">Project Status</h4>
                    {!isEditingProjectStatus && (
                      isDeleted ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="p-1 opacity-50 cursor-not-allowed">
                                <Edit className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Restore first before editing</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isDeleted) {
                              setIsEditingProjectStatus(true);
                            }
                          }}
                          className="p-1 hover:bg-muted rounded-md transition-colors duration-150"
                          aria-label="Edit project status"
                          disabled={isDeleted}
                        >
                          <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      )
                    )}
                  </div>
                  <div className="space-y-3">
                    {/* Row 1: Contract Date */}
                    <div className="flex items-center gap-4">
                      <Label htmlFor="contractDate" className="text-sm font-medium min-w-[180px]">Contract Date: (DBX)</Label>
                      {isEditingProjectStatus && !isDeleted ? (
                        <Input
                          id="contractDate"
                          type="text"
                          placeholder="MM/DD/YYYY"
                          value={contractDate}
                          onChange={(e) => {
                            let value = e.target.value;
                            // Format as MM/DD/YYYY
                            value = value.replace(/\D/g, '');
                            if (value.length >= 2) {
                              value = value.slice(0, 2) + '/' + value.slice(2);
                            }
                            if (value.length >= 5) {
                              value = value.slice(0, 5) + '/' + value.slice(5, 9);
                            }
                            setContractDate(value);
                          }}
                          maxLength={10}
                          className="flex-1"
                        />
                      ) : (
                        <div className="flex-1 text-sm text-foreground">{contractDate || '-'}</div>
                      )}
                    </div>
                    {/* Row 3: First Build Invoice Date */}
                    <div className="flex items-center gap-4">
                      <Label htmlFor="firstBuildInvoiceDate" className="text-sm font-medium min-w-[180px]">First Build Invoice Date:</Label>
                      {isEditingProjectStatus && !isDeleted ? (
                        <Input
                          id="firstBuildInvoiceDate"
                          type="text"
                          placeholder="MM/DD/YYYY"
                          value={firstBuildInvoiceDate}
                          onChange={(e) => {
                            let value = e.target.value;
                            // Format as MM/DD/YYYY
                            value = value.replace(/\D/g, '');
                            if (value.length >= 2) {
                              value = value.slice(0, 2) + '/' + value.slice(2);
                            }
                            if (value.length >= 5) {
                              value = value.slice(0, 5) + '/' + value.slice(5, 9);
                            }
                            setFirstBuildInvoiceDate(value);
                          }}
                          maxLength={10}
                          className="flex-1"
                        />
                      ) : (
                        <div className="flex-1 text-sm text-foreground">{firstBuildInvoiceDate || '-'}</div>
                      )}
                    </div>
                    {/* Row 4: Project Start Date */}
                    <div className="flex items-center gap-4">
                      <Label htmlFor="projectStartDate" className="text-sm font-medium min-w-[180px]">Project Start Date:</Label>
                      {isEditingProjectStatus && !isDeleted ? (
                        <Input
                          id="projectStartDate"
                          type="text"
                          placeholder="MM/DD/YYYY"
                          value={projectStartDate}
                          onChange={(e) => {
                            let value = e.target.value;
                            // Format as MM/DD/YYYY
                            value = value.replace(/\D/g, '');
                            if (value.length >= 2) {
                              value = value.slice(0, 2) + '/' + value.slice(2);
                            }
                            if (value.length >= 5) {
                              value = value.slice(0, 5) + '/' + value.slice(5, 9);
                            }
                            setProjectStartDate(value);
                          }}
                          maxLength={10}
                          className="flex-1"
                        />
                      ) : (
                        <div className="flex-1 text-sm text-foreground">{projectStartDate || '-'}</div>
                      )}
                    </div>
                    {/* Row 5: Project End Date */}
                    <div className="flex items-center gap-4">
                      <Label htmlFor="projectEndDate" className="text-sm font-medium min-w-[180px]">Project End Date:</Label>
                      {isEditingProjectStatus && !isDeleted ? (
                        <Input
                          id="projectEndDate"
                          type="text"
                          placeholder="MM/DD/YYYY"
                          value={projectEndDate}
                          onChange={(e) => {
                            let value = e.target.value;
                            // Format as MM/DD/YYYY
                            value = value.replace(/\D/g, '');
                            if (value.length >= 2) {
                              value = value.slice(0, 2) + '/' + value.slice(2);
                            }
                            if (value.length >= 5) {
                              value = value.slice(0, 5) + '/' + value.slice(5, 9);
                            }
                            setProjectEndDate(value);
                          }}
                          maxLength={10}
                          className="flex-1"
                        />
                      ) : (
                        <div className="flex-1 text-sm text-foreground">{projectEndDate || '-'}</div>
                      )}
                    </div>
                    {/* Cancel and Save Buttons - Only show when editing and not deleted */}
                    {isEditingProjectStatus && !isDeleted && (
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          onClick={() => {
                            setIsEditingProjectStatus(false);
                            // Reset to original values
                            const order = currentContract.order as any;
                            setStage(order?.stage || '');
                            setContractDate(order?.contractDate || '');
                            setFirstBuildInvoiceDate(order?.firstBuildInvoiceDate || '');
                            setProjectStartDate(order?.projectStartDate || '');
                            setProjectEndDate(order?.projectEndDate || '');
                          }}
                          disabled={saving}
                          size="sm"
                          variant="outline"
                          className="min-w-[80px]"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveProjectStatus}
                          disabled={saving}
                          size="sm"
                          variant="outline"
                          className="min-w-[80px]"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="h-full"
      >
        <Card className="h-full flex flex-col">
          <CardContent className="space-y-1 pt-6 flex-1">
            <div className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold leading-none tracking-tight">Job Information</h3>
                  {isDeleted && (
                    <Badge variant="secondary" className="mt-1.5 gap-1 min-w-[140px] text-center">
                      <Trash2 className="h-3 w-3" />
                      Deleted Contract
                    </Badge>
                  )}
                </div>
                {isDeleted && currentContract?.customer?.dbxCustomerId && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setRestoreDialogOpen(true)}
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore Contract
                  </Button>
                )}
              </div>
            </div>
            <InfoRow label="Order Date" value={currentContract.order.orderDate} />
            <InfoRow label="Order PO" value={currentContract.order.orderPO} />
            <InfoRow label="Order Due Date" value={currentContract.order.orderDueDate} />
            <InfoRow label="Order Type" value={currentContract.order.orderType} />
            <InfoRow label="Order Delivered" value={currentContract.order.orderDelivered ? 'Yes' : 'No'} />
            <InfoRow label="Quote Expiration Date" value={currentContract.order.quoteExpirationDate} />
            <InfoRow label="Progress Payments" value={currentContract.order.progressPayments} />
            <div className="flex justify-between items-center py-1">
              <dt className="text-sm font-medium text-muted-foreground min-w-[140px]">Balance Due</dt>
              <dd className="text-lg font-bold text-foreground text-right flex-1">
                ${currentContract.order.balanceDue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </dd>
            </div>
            <InfoRow label="Sales Rep" value={currentContract.order.salesRep} />
          </CardContent>
        </Card>
      </motion.div>
    </div>

    <EditCustomerInfo
      contract={currentContract}
      open={editModalOpen}
      onOpenChange={setEditModalOpen}
      onSave={handleSave}
    />
    {currentContract?.customer?.dbxCustomerId && (
      <>
        <CustomerHistory
          customerId={currentContract.customer.dbxCustomerId}
          open={historyModalOpen}
          onOpenChange={setHistoryModalOpen}
        />
        {isDeleted && (
          <RestoreContractDialog
            open={restoreDialogOpen}
            onOpenChange={setRestoreDialogOpen}
            customerId={currentContract.customer.dbxCustomerId}
            customerName={currentContract.customer.clientName}
          />
        )}
      </>
    )}
    </>
  );
}
