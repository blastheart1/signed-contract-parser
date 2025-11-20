'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DashboardFileUpload from './DashboardFileUpload';

interface UploadContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UploadContractModal({ open, onOpenChange }: UploadContractModalProps) {
  // The modal will close automatically when the page redirects after successful upload
  // DashboardFileUpload handles the redirect, so we don't need to manually close the modal
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Contract</DialogTitle>
          <DialogDescription>
            Upload a signed build contract .eml file to parse and view in dashboard
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <DashboardFileUpload />
        </div>
      </DialogContent>
    </Dialog>
  );
}

