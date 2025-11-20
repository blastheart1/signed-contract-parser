'use client';

import { motion } from 'framer-motion';
import ReceivablesCard from '@/components/dashboard/ReceivablesCard';
import SalesPerformanceCard from '@/components/dashboard/SalesPerformanceCard';
import ProjectHealthCard from '@/components/dashboard/ProjectHealthCard';
import RevenueRecognitionCard from '@/components/dashboard/RevenueRecognitionCard';

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Reports and Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Business insights and actionable metrics for your contracts and operations
          </p>
        </div>
      </motion.div>

      {/* Phase 1: High Impact Analytics */}
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <ReceivablesCard />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <SalesPerformanceCard />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <ProjectHealthCard />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <RevenueRecognitionCard />
        </motion.div>
      </div>
    </div>
  );
}

