'use client';

import { useState } from 'react';
import { RotateCcw, Loader2, AlertCircle } from 'lucide-react';
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

interface RestoreContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName?: string;
}

const CONFIRMATION_TEXT = 'Restore This Contract';

export default function RestoreContractDialog({
  open,
  onOpenChange,
  customerId,
  customerName = 'this contract',
}: RestoreContractDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [confirmationText, setConfirmationText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmationText === CONFIRMATION_TEXT;

  const handleRestore = async () => {
    if (!isConfirmed) return;

    setRestoring(true);
    setError(null);

    try {
      const response = await fetch(`/api/customers/${customerId}/recover`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to restore contract');
      }

      toast({
        title: 'Contract restored',
        description: `${customerName} has been restored successfully.`,
      });

      // Close dialog and reset state
      onOpenChange(false);
      setConfirmationText('');
      setError(null);

      // Refresh the page to show restored state
      router.refresh();
      
      // Redirect to normal customer view after a short delay
      setTimeout(() => {
        router.push(`/dashboard/customers/${customerId}`);
      }, 500);
    } catch (err) {
      console.error('Error restoring contract:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to restore contract. Please try again.';
      setError(errorMessage);
      toast({
        title: 'Failed to restore contract',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!restoring) {
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
            <RotateCcw className="h-5 w-5" />
            Restore Contract
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-4 mt-2">
              <p>
                Are you sure you want to restore <strong>{customerName}</strong>? This will make the contract editable again.
              </p>
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
                  disabled={restoring}
                  className={error ? 'border-destructive' : ''}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isConfirmed && !restoring) {
                      handleRestore();
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
          <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRestore}
            disabled={!isConfirmed || restoring}
            className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {restoring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore Contract
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

