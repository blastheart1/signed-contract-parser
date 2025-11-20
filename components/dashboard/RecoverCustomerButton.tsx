'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecoverCustomerButtonProps {
  customerId: string;
  onRecover?: () => void;
}

export default function RecoverCustomerButton({ customerId, onRecover }: RecoverCustomerButtonProps) {
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRecover = async () => {
    setRecovering(true);
    setError(null);

    try {
      const response = await fetch(`/api/customers/${customerId}/recover`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to recover customer');
      }

      // Success - refresh the list
      if (onRecover) {
        onRecover();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recover customer');
      console.error('Error recovering customer:', err);
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-sm text-destructive">{error}</span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRecover}
        disabled={recovering}
        className="gap-2"
      >
        <RotateCcw className={`h-4 w-4 ${recovering ? 'animate-spin' : ''}`} />
        {recovering ? 'Recovering...' : 'Recover'}
      </Button>
    </div>
  );
}

