'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Edit, Trash2, History } from 'lucide-react';
import type { StoredContract } from '@/lib/store/contractStore';
import EditCustomerInfo from './EditCustomerInfo';
import DeleteCustomerButton from './DeleteCustomerButton';
import CustomerHistory from './CustomerHistory';

interface CustomerInfoProps {
  contract: StoredContract;
  onContractUpdate?: (updatedContract: StoredContract) => void;
}

export default function CustomerInfo({ contract, onContractUpdate }: CustomerInfoProps) {
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
  }, [contract]);

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
              <div className="mb-4 flex items-center justify-between">
                {needsManualUpdate && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md flex-1 mr-4">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Customer information needs manual update
                    </p>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <Button
                    variant={needsManualUpdate ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditModalOpen(true)}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  {currentContract?.customer?.dbxCustomerId && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryModalOpen(true)}
                        className="gap-2"
                      >
                        <History className="h-4 w-4" />
                        History
                      </Button>
                      <DeleteCustomerButton contract={currentContract} />
                    </>
                  )}
                </div>
              </div>
            <div className="pb-3">
              <h1 className="text-4xl font-bold tracking-tight">{currentContract.customer.clientName || 'Customer'}</h1>
              <p className="text-muted-foreground mt-2">Order #{currentContract.order.orderNo || 'N/A'}</p>
            </div>
            {currentContract.customer.dbxCustomerId && (
              <div className="flex justify-between items-center py-1">
                <dt className="text-sm font-medium text-muted-foreground min-w-[140px]">DBX</dt>
                <dd className="text-sm text-foreground font-medium text-right flex-1">
                  {currentContract.customer.dbxCustomerId}
                </dd>
              </div>
            )}
            {(currentContract.customer as any).status && (
              <div className="flex justify-between items-center py-1">
                <dt className="text-sm font-medium text-muted-foreground min-w-[140px]">Status</dt>
                <dd className="text-sm text-foreground font-medium text-right flex-1">
                  {(currentContract.customer as any).status === 'completed' ? (
                    <Badge variant="default" className="bg-green-600">Completed</Badge>
                  ) : (
                    <Badge variant="secondary">Pending Updates</Badge>
                  )}
                </dd>
              </div>
            )}
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
              <h3 className="text-lg font-semibold leading-none tracking-tight">Job Information</h3>
              <p className="text-xs text-muted-foreground mt-1.5">
                Order #{currentContract.order.orderNo || 'details and financial information'}
              </p>
            </div>
            <div className="flex justify-between items-center py-1">
              <dt className="text-sm font-medium text-muted-foreground min-w-[140px]">Order Id</dt>
              <dd className="text-sm text-foreground font-medium text-right flex-1">
                {currentContract.order.orderNo || '-'}
              </dd>
            </div>
            <InfoRow label="Order Date" value={currentContract.order.orderDate} />
            <InfoRow label="Order PO" value={currentContract.order.orderPO} />
            <InfoRow label="Order Due Date" value={currentContract.order.orderDueDate} />
            <InfoRow label="Order Type" value={currentContract.order.orderType} />
            <InfoRow label="Order Delivered" value={currentContract.order.orderDelivered ? 'Yes' : 'No'} />
            <InfoRow label="Quote Expiration Date" value={currentContract.order.quoteExpirationDate} />
            <InfoRow label="Order Grand Total" value={`$${currentContract.order.orderGrandTotal?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`} />
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
      <CustomerHistory
        customerId={currentContract.customer.dbxCustomerId}
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
      />
    )}
    </>
  );
}
