'use client';

import FileUpload from '@/components/FileUpload';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 sm:py-12">
      <FileUpload />
    </div>
  );
}

