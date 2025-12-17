'use client';

import { useState } from 'react';
import { Trash2, Loader2, AlertCircle } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface PermanentDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName?: string;
}

const CONFIRMATION_TEXT = 'Permanently Delete Customer';

export default function PermanentDeleteDialog({
  open,
  onOpenChange,
  customerId,
  customerName = 'this customer',
}: PermanentDeleteDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [confirmationText, setConfirmationText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmationText === CONFIRMATION_TEXT;

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/customers/${customerId}/permanent-delete`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to permanently delete customer');
      }

      toast({
        title: 'Customer permanently deleted',
        description: `${customerName} and all associated data have been permanently deleted.`,
      });

      // Close dialog and reset state
      onOpenChange(false);
      setConfirmationText('');
      setError(null);

      // Redirect to customers list after a short delay
      setTimeout(() => {
        router.push('/dashboard/customers');
      }, 500);
    } catch (err) {
      console.error('Error permanently deleting customer:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to permanently delete customer. Please try again.';
      setError(errorMessage);
      toast({
        title: 'Failed to permanently delete customer',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!deleting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        // Reset state when closing
        setConfirmationText('');
        setError(null);
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Permanently Delete Customer
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-4 mt-2">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm font-semibold text-destructive mb-2">Warning: This action cannot be undone!</p>
                <p className="text-sm">
                  Are you sure you want to permanently delete <strong>{customerName}</strong>? This will permanently delete:
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>The customer record</li>
                  <li>All associated orders</li>
                  <li>All order items</li>
                  <li>All invoices</li>
                  <li>All change history</li>
                  <li>All alert acknowledgments</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmation-input">
                  Type <strong>{CONFIRMATION_TEXT}</strong> to confirm:
                </Label>
                <Input
                  id="confirmation-input"
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder={CONFIRMATION_TEXT}
                  disabled={deleting}
                  className={error ? 'border-destructive' : ''}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isConfirmed && !deleting) {
                      handleDelete();
                    }
                  }}
                />
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
            className="bg-destructive hover:bg-destructive/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Permanently Delete
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
