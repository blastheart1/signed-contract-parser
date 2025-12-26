'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Edit, ChevronDown, ChevronUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import VendorDetailsModal from './VendorDetailsModal';

interface Vendor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  category?: string | null;
  status: 'active' | 'inactive';
  notes?: string | null;
  specialties?: string[] | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  performanceMetrics?: {
    totalWorkAssigned: number;
    totalEstimatedCost: number;
    totalActualCost: number;
    totalProfitability: number;
    costVariance: number;
    costVariancePercentage: number;
    profitMargin: number;
    itemCount: number;
    projectCount: number;
    costAccuracyScore: number;
    profitabilityScore: number;
    reliabilityScore: number;
    overallPerformanceScore: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

interface VendorInfoProps {
  vendor: Vendor;
  isDeleted?: boolean;
  onVendorUpdate?: (updatedVendor: Vendor) => void;
}

export default function VendorInfo({ vendor, isDeleted = false, onVendorUpdate }: VendorInfoProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [currentVendor, setCurrentVendor] = useState<Vendor>(vendor);

  useEffect(() => {
    setCurrentVendor(vendor);
  }, [vendor]);

  const handleSave = () => {
    // The modal doesn't return the updated vendor, so we'll rely on onVendorUpdate
    // to trigger a refetch from the parent component
    if (onVendorUpdate) {
      // Pass current vendor as a placeholder - parent should refetch
      onVendorUpdate(currentVendor);
    }
  };

  const fullAddress = currentVendor.address 
    ? `${currentVendor.address}${currentVendor.city ? `, ${currentVendor.city}` : ''}${currentVendor.state ? `, ${currentVendor.state}` : ''}${currentVendor.zip ? ` ${currentVendor.zip}` : ''}`
    : '';

  const InfoRow = ({ label, value, highlight }: { label: string; value: string | number | null | undefined; highlight?: boolean }) => (
    <div className="flex justify-between items-center py-1">
      <dt className="text-sm font-medium text-muted-foreground min-w-[140px]">{label}</dt>
      <dd className={`text-sm text-foreground ${highlight ? 'font-bold text-lg' : 'font-medium'} text-right flex-1`}>
        {value || '-'}
      </dd>
    </div>
  );

  return (
    <>
      <Card className="h-full max-h-[336px] flex flex-col overflow-hidden">
        <CardContent className={`pt-6 flex flex-col ${showMoreInfo ? 'overflow-y-auto max-h-[336px]' : 'flex-1 min-h-0 overflow-hidden'}`}>
          <div className="pb-3 flex items-start justify-between gap-4">
            <div className="flex-1 flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl font-bold tracking-tight">{currentVendor.name}</h1>
              <Badge
                variant={currentVendor.status === 'active' ? 'default' : 'secondary'}
                className={`min-w-[100px] text-center ${
                  currentVendor.status === 'active' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-500 hover:bg-gray-600'
                }`}
              >
                {currentVendor.status}
              </Badge>
              {currentVendor.category && (
                <Badge variant="outline">{currentVendor.category}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowMoreInfo(!showMoreInfo)}
                      className="p-1 hover:bg-muted rounded-md transition-colors duration-150"
                      aria-label="More information"
                    >
                      {showMoreInfo ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>More information</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {!isDeleted && (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="p-1 hover:bg-muted rounded-md transition-colors duration-150"
                  aria-label="Edit vendor"
                >
                  <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
              {isDeleted && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-1 opacity-50 cursor-not-allowed">
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Restore first before editing</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Performance Metrics Summary */}
          {currentVendor.performanceMetrics && (
            <div className="pb-3 border-b mb-3">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Work Assigned</div>
                  <div className="text-lg font-semibold">
                    ${currentVendor.performanceMetrics.totalWorkAssigned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Projects</div>
                  <div className="text-lg font-semibold">{currentVendor.performanceMetrics.projectCount}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Profit Margin</div>
                  <div className={`text-lg font-semibold ${currentVendor.performanceMetrics.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currentVendor.performanceMetrics.profitMargin >= 0 ? '+' : ''}{currentVendor.performanceMetrics.profitMargin.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Performance Score</div>
                  <div className="text-lg font-semibold">
                    {currentVendor.performanceMetrics.overallPerformanceScore.toFixed(0)}/100
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={`${showMoreInfo ? 'flex-shrink-0' : 'flex-1 min-h-0'} overflow-hidden`}>
            <motion.div
              initial={false}
              animate={{
                height: showMoreInfo ? 250 : 0,
                opacity: showMoreInfo ? 1 : 0,
              }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
              className="flex-shrink-0"
            >
              {showMoreInfo && (
                <div className="mt-2 pt-2 border-t h-full relative">
                  <div className="space-y-1 pb-12 h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <InfoRow label="Email" value={currentVendor.email} />
                    <InfoRow label="Phone" value={currentVendor.phone} />
                    <InfoRow label="Contact Person" value={currentVendor.contactPerson} />
                    {currentVendor.address && (
                      <>
                        <div className="pt-1 border-t mt-2 mb-2"></div>
                        <InfoRow label="Address" value={currentVendor.address} />
                        <InfoRow label="City" value={currentVendor.city} />
                        <InfoRow label="State" value={currentVendor.state} />
                        <InfoRow label="Zip" value={currentVendor.zip} />
                        {fullAddress && (
                          <div className="pt-1">
                            <div className="flex justify-between items-start py-1">
                              <dt className="text-sm font-medium text-muted-foreground min-w-[140px]">Full Address</dt>
                              <dd className="text-sm text-foreground font-medium text-right flex-1">{fullAddress}</dd>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {currentVendor.specialties && currentVendor.specialties.length > 0 && (
                      <>
                        <div className="pt-1 border-t mt-2 mb-2"></div>
                        <div className="flex justify-between items-start py-1">
                          <dt className="text-sm font-medium text-muted-foreground min-w-[140px]">Specialties</dt>
                          <dd className="text-sm text-foreground font-medium text-right flex-1">
                            {currentVendor.specialties.join(', ')}
                          </dd>
                        </div>
                      </>
                    )}
                    {currentVendor.notes && (
                      <>
                        <div className="pt-1 border-t mt-2 mb-2"></div>
                        <div className="flex justify-between items-start py-1">
                          <dt className="text-sm font-medium text-muted-foreground min-w-[140px]">Notes</dt>
                          <dd className="text-sm text-foreground font-medium text-right flex-1">{currentVendor.notes}</dd>
                        </div>
                      </>
                    )}
                    <div className="pt-1 border-t mt-2 mb-2"></div>
                    <InfoRow label="Created" value={new Date(currentVendor.createdAt).toLocaleDateString()} />
                    <InfoRow label="Updated" value={new Date(currentVendor.updatedAt).toLocaleDateString()} />
                  </div>
                  {/* Floating scroll down indicator */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">Scroll down</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground animate-bounce" />
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </CardContent>
      </Card>

      <VendorDetailsModal
        vendor={currentVendor}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={handleSave}
        viewOnly={false}
      />
    </>
  );
}

