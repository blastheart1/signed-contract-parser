'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DashboardFileUpload from './DashboardFileUpload';
import PrivacyDisclaimer from '../PrivacyDisclaimer';

interface UploadContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UploadContractModal({ open, onOpenChange }: UploadContractModalProps) {
  // The modal will close automatically when the page redirects after successful upload
  // DashboardFileUpload handles the redirect, so we don't need to manually close the modal
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[580px] flex flex-col p-6">
        <DialogHeader className="pb-2 flex-shrink-0">
          <DialogTitle>Upload Contract</DialogTitle>
          <div className="flex items-center justify-between gap-2 mt-1">
            <DialogDescription className="flex-1 m-0">
            Upload a signed build contract .eml file to parse and view in dashboard
          </DialogDescription>
            <PrivacyDisclaimer />
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <DashboardFileUpload />
        </div>
      </DialogContent>
    </Dialog>
  );
}

