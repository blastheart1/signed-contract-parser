'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { LogIn, FileSpreadsheet, ArrowLeft, Mail, FileText, Sheet } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  return (
    <div 
      className="min-h-screen flex flex-col items-center py-8 sm:py-12 relative"
      style={{
        backgroundImage: 'url(/calimingo-pattern-bg.png)',
        backgroundSize: 'auto',
        backgroundPosition: '50% 0%',
        backgroundRepeat: 'repeat',
        backgroundAttachment: 'scroll',
        backgroundColor: 'rgb(35, 47, 71)'
      }}
    >
      {/* Logo */}
      <div className="mb-8 sm:mb-12 z-10">
        <Image
          src="/cali-logo.svg"
          alt="Calimingo Pools"
          width={280}
          height={93}
          priority
          className="w-auto h-auto max-w-[280px] sm:max-w-[320px]"
        />
      </div>

      {selectedApp === null ? (
        <>
          {/* Welcome Heading */}
          <div className="text-center mb-8 sm:mb-12 z-10 px-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold uppercase mb-4" style={{ 
              fontFamily: 'Oswald, sans-serif',
              color: 'rgb(36, 47, 71)',
              letterSpacing: 'normal'
            }}>
              Calimingo Tools
            </h1>
            <p className="text-lg sm:text-xl text-gray-700 max-w-2xl mx-auto" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Select an application to get started
            </p>
          </div>

          {/* App Selection Grid - Centered since only 1 app */}
          <div className="w-full max-w-6xl px-4 sm:px-6 lg:px-8 mb-12 z-10 flex justify-center">
            <div className="w-full max-w-md">
              {/* Contract Parser App Card */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105 bg-white/95 backdrop-blur-sm"
                onClick={() => setSelectedApp('contract-parser')}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold" style={{ color: 'rgb(36, 47, 71)' }}>
                          Contract Parser
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">Parser</Badge>
                          <Badge className="bg-green-500 text-white text-xs">Available</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Parse contract emails and generate spreadsheets automatically
                  </CardDescription>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="secondary" className="text-xs">
                      <Mail className="h-3 w-3 mr-1" />
                      Email
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      Contract
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Sheet className="h-3 w-3 mr-1" />
                      Spreadsheet
                    </Badge>
                  </div>
                  <div className="flex items-center text-blue-600 font-semibold text-sm">
                    Explore →
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Login Section */}
          <div className="w-full max-w-2xl px-4 sm:px-6 lg:px-8 z-10">
            <Card className="bg-white/95 backdrop-blur-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold" style={{ color: 'rgb(36, 47, 71)' }}>
                  Access Dashboard
                </CardTitle>
                <CardDescription className="text-base mt-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Manage contracts, view history, and access all your tools
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Link href="/login">
                  <Button size="lg" className="gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    <LogIn className="h-5 w-5" />
                    Login
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      ) : selectedApp === 'contract-parser' ? (
        <>
          {/* Back to Apps Button */}
          <motion.div
            className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedApp(null)}
              className="gap-2 bg-white/80 hover:bg-white/90 backdrop-blur-sm border border-[rgb(36,47,71)]/30"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Apps
            </Button>
          </motion.div>
          
          <div className="w-full max-w-4xl px-4 sm:px-6 lg:px-8 z-10 flex flex-col items-center">
            <div className="w-full max-w-2xl">
              <FileUpload />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
