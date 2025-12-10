'use client';

import { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { validateOrderItemsTotal } from '@/lib/orderItemsValidation';
import type { OrderItem } from '@/lib/tableExtractor';
import type { StoredContract } from '@/lib/store/contractStore';

interface OrderItemsValidationAlertProps {
  contract: StoredContract;
  currentItems?: OrderItem[];
  customerId?: string;
}

interface AcknowledgmentInfo {
  alertType: string;
  acknowledgedBy: {
    id: string | null;
    username: string;
  };
  acknowledgedAt: string;
}

export default function OrderItemsValidationAlert({ contract, currentItems, customerId }: OrderItemsValidationAlertProps) {
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [acknowledgmentInfo, setAcknowledgmentInfo] = useState<AcknowledgmentInfo | null>(null);
  const [isExpanded, setIsExpanded] = useState(true); // Default to expanded for non-acknowledged
  const [showAcknowledgeDialog, setShowAcknowledgeDialog] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const customerDbxId = customerId || contract.customer?.dbxCustomerId;
  const alertType = 'order_items_mismatch';

  // Fetch acknowledgment status on mount
  useEffect(() => {
    const fetchAcknowledgmentStatus = async () => {
      if (!customerDbxId) return;

      try {
        const response = await fetch(`/api/customers/${customerDbxId}/alerts`);
        const data = await response.json();

        if (data.success && data.acknowledgments) {
          const acknowledgment = data.acknowledgments.find(
            (ack: AcknowledgmentInfo) => ack.alertType === alertType
          );

          if (acknowledgment) {
            setIsAcknowledged(true);
            setAcknowledgmentInfo(acknowledgment);
            setIsExpanded(false); // Start minimized when acknowledged
          } else {
            // Not acknowledged - start expanded
            setIsExpanded(true);
          }
        }
      } catch (error) {
        console.error('Error fetching acknowledgment status:', error);
      }
    };

    fetchAcknowledgmentStatus();
  }, [customerDbxId]);

  // Use currentItems if provided (from OrderTable), otherwise use contract.items
  // Re-validate whenever items change
  const validation = useMemo(() => {
    const itemsToValidate = currentItems && currentItems.length > 0 ? currentItems : contract.items;
    return validateOrderItemsTotal(itemsToValidate, contract.order.orderGrandTotal);
  }, [currentItems, contract.items, contract.order.orderGrandTotal]);
  
  // Only show alert if validation failed
  if (validation.isValid) {
    return null;
  }

  // Handle acknowledge action
  const handleAcknowledge = async () => {
    if (!customerDbxId) return;

    setIsAcknowledging(true);
    try {
      const response = await fetch(`/api/customers/${customerDbxId}/alerts/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alertType }),
      });

      const data = await response.json();

      if (data.success) {
        // Fetch updated acknowledgment info
        const ackResponse = await fetch(`/api/customers/${customerDbxId}/alerts`);
        const ackData = await ackResponse.json();

        if (ackData.success && ackData.acknowledgments) {
          const acknowledgment = ackData.acknowledgments.find(
            (ack: AcknowledgmentInfo) => ack.alertType === alertType
          );

          if (acknowledgment) {
            setIsAcknowledged(true);
            setAcknowledgmentInfo(acknowledgment);
            setIsExpanded(false); // Minimize after acknowledging
          }
        }

        setShowAcknowledgeDialog(false);
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    } finally {
      setIsAcknowledging(false);
    }
  };

  // Handle hide toggle - only works when NOT acknowledged
  const handleToggleHide = () => {
    if (!isAcknowledged) {
      setIsExpanded(!isExpanded);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // State 1: Minimized + Acknowledged
  if (isAcknowledged && !isExpanded) {
    return (
      <>
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <div className="flex items-center justify-between w-full">
            <div className="flex-1">
              <AlertTitle className="mb-1">Order Items Total Mismatch</AlertTitle>
              <AlertDescription className="text-sm">
                {acknowledgmentInfo && (
                  <span className="text-muted-foreground">
                    Acknowledged by <strong>{acknowledgmentInfo.acknowledgedBy.username}</strong> on {formatDate(acknowledgmentInfo.acknowledgedAt)}
                  </span>
                )}
              </AlertDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="ml-4"
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </div>
        </Alert>
      </>
    );
  }

  // State 2: Expanded + Acknowledged
  if (isAcknowledged && isExpanded) {
    return (
      <>
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            <span>Order Items Total Mismatch</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-6"
              title="Minimize"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              {acknowledgmentInfo && (
                <div className="bg-muted/50 p-2 rounded text-sm">
                  Acknowledged by <strong>{acknowledgmentInfo.acknowledgedBy.username}</strong> on {formatDate(acknowledgmentInfo.acknowledgedAt)}
                </div>
              )}
              
              <div>
                <p className="mb-2">
                  The Grand Total specified in the contract (<strong>${validation.orderGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>) differs from the computed sum of all line items (<strong>${validation.itemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>). This may indicate missing items, parsing errors, or additional charges not included in the line items.
                </p>
                <div className="text-sm space-y-1 mt-3">
                  <p>• <strong>Contract Grand Total:</strong> ${validation.orderGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p>• <strong>Sum of Line Items:</strong> ${validation.itemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p>• <strong>Difference:</strong> ${validation.difference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  // State 3 & 4: Expanded or Collapsed + Not Acknowledged
  return (
    <>
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Order Items Total Mismatch</AlertTitle>
        {isExpanded && (
          <AlertDescription>
            <div className="space-y-3">
              <div>
                <p className="mb-2">
                  The Grand Total specified in the contract (<strong>${validation.orderGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>) differs from the computed sum of all line items (<strong>${validation.itemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>). This may indicate missing items, parsing errors, or additional charges not included in the line items.
                </p>
                <div className="text-sm space-y-1 mt-3">
                  <p>• <strong>Contract Grand Total:</strong> ${validation.orderGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p>• <strong>Sum of Line Items:</strong> ${validation.itemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p>• <strong>Difference:</strong> ${validation.difference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAcknowledgeDialog(true)}
                  className="min-w-[130px]"
                >
                  Acknowledge
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleHide}
                  className="min-w-[140px]"
                >
                  Hide Notification
                </Button>
              </div>
            </div>
          </AlertDescription>
        )}
        {!isExpanded && (
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Validation issue detected</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleHide}
                className="ml-4"
              >
                <ChevronDown className="h-4 w-4 mr-2" />
                Show Details
              </Button>
            </div>
          </AlertDescription>
        )}
      </Alert>

      {/* Acknowledge Confirmation Dialog */}
      <AlertDialog open={showAcknowledgeDialog} onOpenChange={setShowAcknowledgeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acknowledge Alert</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark this alert as acknowledged. You can still view the validation details by expanding the alert. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAcknowledge} disabled={isAcknowledging}>
              {isAcknowledging ? 'Acknowledging...' : 'Acknowledge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

