'use client';

import Link from 'next/link';
import { LogIn } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 sm:py-12 relative">
      {/* Login Button */}
      <Link href="/login" className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <Button variant="outline" size="sm" className="gap-2">
          <LogIn className="h-4 w-4" />
          Login
        </Button>
      </Link>
      
      <FileUpload />
    </div>
  );
}

