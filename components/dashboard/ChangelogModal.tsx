'use client';

import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { changelog } from '@/lib/changelog';
import ChangelogEntry from './ChangelogEntry';

interface ChangelogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChangelogModal({ open, onOpenChange }: ChangelogModalProps) {
  // Mark latest version as viewed when modal opens
  useEffect(() => {
    if (open && changelog.length > 0) {
      const latestVersion = changelog[0].version;
      // Import dynamically to avoid SSR issues
      import('@/lib/utils/versionTracking').then(({ markVersionAsViewed }) => {
        markVersionAsViewed(latestVersion);
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Changelog</DialogTitle>
          <DialogDescription>
            View all updates, new features, and improvements to the application
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 pr-2 -mr-2">
          <div className="space-y-0">
            {changelog.map((entry, index) => (
              <ChangelogEntry
                key={entry.version}
                entry={entry}
                isLast={index === changelog.length - 1}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
