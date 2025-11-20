'use client';

import DashboardFileUpload from '@/components/dashboard/DashboardFileUpload';

export default function DashboardUploadPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Upload Contract</h1>
        <p className="text-muted-foreground mt-2">
          Upload and parse a contract to view in the dashboard
        </p>
      </div>
      <DashboardFileUpload />
    </div>
  );
}

