'use client';

import { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { StoredContract } from '@/lib/store/contractStore';

interface DeleteCustomerButtonProps {
  contract: StoredContract;
  onDelete?: () => void;
}

export default function DeleteCustomerButton({ contract, onDelete }: DeleteCustomerButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    setDeleted(false);

    try {
      // Get the customer ID (dbxCustomerId)
      const customerId = contract?.customer?.dbxCustomerId;
      
      if (!customerId) {
        throw new Error('Customer ID not found. Cannot delete customer without DBX Customer ID.');
      }

      console.log(`[DeleteCustomerButton] Deleting customer: ${customerId}`);
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete customer');
      }

      const data = await response.json();
      console.log(`[DeleteCustomerButton] Customer deleted successfully:`, data);

      // Mark as deleted and show success message
      setDeleted(true);
      
      // Show success toast
      toast({
        title: 'Customer deleted',
        description: `${contract?.customer?.clientName || 'Customer'} has been moved to trash.`,
      });
      
      // Call onDelete callback if provided
      if (onDelete) {
        onDelete();
      }

      // Wait a moment to show success feedback, then redirect
      setTimeout(() => {
        router.push('/dashboard/customers');
      }, 1500);
    } catch (err) {
      console.error('[DeleteCustomerButton] Error deleting customer:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete customer. Please try again.';
      setError(errorMessage);
      toast({
        title: 'Failed to delete customer',
        description: errorMessage,
        variant: 'destructive',
      });
      setDeleting(false);
      // Don't close dialog on error so user can see the error message
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setOpen(true);
                setError(null);
                setDeleted(false);
              }}
              className="w-8 p-0"
              disabled={deleting || deleted}
            >
              {deleting || deleted ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete customer (moves to trash)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialog open={open} onOpenChange={(isOpen) => {
        if (!deleting && !deleted) {
          setOpen(isOpen);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleted ? (
                <>
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  Customer Deleted
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Delete Customer
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                {deleted ? (
                  <>
                    <p className="text-green-600 dark:text-green-400">
                      <strong>{contract?.customer?.clientName || 'Customer'}</strong> has been moved to trash.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Redirecting to customers list...
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Are you sure you want to delete <strong>{contract?.customer?.clientName || 'this customer'}</strong>?
                    </p>
                    <p className="text-sm text-muted-foreground">
                      This will move the customer to trash. All related data (orders, items, invoices) will be deleted.
                      The customer will be permanently deleted after 30 days.
                    </p>
                    {error && (
                      <p className="text-sm text-destructive mt-2">{error}</p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {!deleted && (
              <>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

