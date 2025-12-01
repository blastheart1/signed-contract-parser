'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Trash2, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DataManagementPage() {
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{
    success: boolean;
    message?: string;
    deletedCount?: number;
    errors?: string[];
  } | null>(null);

  const handleCleanupTrash = async () => {
    if (!confirm('Are you sure you want to permanently delete customers that have been in trash for more than 30 days? This action cannot be undone.')) {
      return;
    }

    setCleaning(true);
    setCleanupResult(null);

    try {
      const response = await fetch('/api/customers/cleanup-trash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setCleanupResult({
          success: true,
          message: data.message,
          deletedCount: data.deletedCount,
          errors: data.errors,
        });
      } else {
        setCleanupResult({
          success: false,
          message: data.error || 'Failed to cleanup trash',
        });
      }
    } catch (error) {
      console.error('Error cleaning up trash:', error);
      setCleanupResult({
        success: false,
        message: 'An error occurred while cleaning up trash',
      });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Data Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage database operations and data maintenance
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Trash Cleanup</CardTitle>
            </div>
            <CardDescription>
              Permanently delete customers that have been in trash for more than 30 days
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This action will permanently delete customers and all associated data (orders, invoices, order items, change history) that have been in trash for more than 30 days. This action cannot be undone.
              </AlertDescription>
            </Alert>

            {cleanupResult && (
              <Alert variant={cleanupResult.success ? 'default' : 'destructive'}>
                {cleanupResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {cleanupResult.success ? 'Cleanup Successful' : 'Cleanup Failed'}
                </AlertTitle>
                <AlertDescription>
                  {cleanupResult.message}
                  {cleanupResult.deletedCount !== undefined && (
                    <div className="mt-2">
                      <strong>Deleted:</strong> {cleanupResult.deletedCount} customer(s)
                    </div>
                  )}
                  {cleanupResult.errors && cleanupResult.errors.length > 0 && (
                    <div className="mt-2">
                      <strong>Errors:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {cleanupResult.errors.map((error, idx) => (
                          <li key={idx} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleCleanupTrash}
              disabled={cleaning}
              variant="destructive"
              className="min-h-[44px]"
            >
              {cleaning ? (
                <>
                  <Trash2 className="mr-2 h-4 w-4 animate-spin" />
                  Cleaning up...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Cleanup Trash
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Database Statistics</CardTitle>
            </div>
            <CardDescription>
              View database statistics and health metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Database statistics will be available here.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Export & Backup</CardTitle>
            </div>
            <CardDescription>
              Export data and create backups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Export and backup options will be available here.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Data Validation</CardTitle>
            </div>
            <CardDescription>
              Validate and fix data inconsistencies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Data validation tools will be available here.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

