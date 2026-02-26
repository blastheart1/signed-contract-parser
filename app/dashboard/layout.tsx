'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, Clock, BarChart3, Trash2, Building2, FileText } from 'lucide-react';
import Sidebar, { type User } from '@/components/dashboard/Sidebar';

/** Vendors are restricted to the vendor negotiation area only. */
const VENDOR_ALLOWED_PATH_PREFIX = '/dashboard/vendor-negotiation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (!data.success || !data.user) {
        router.push('/login');
        return;
      }

      setUser(data.user);
    } catch (error) {
      console.error('Error checking session:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  // Restrict vendor users to vendor-negotiation only (list and detail pages)
  useEffect(() => {
    if (!user || user.role !== 'vendor' || loading) return;
    const isAllowed =
      pathname === VENDOR_ALLOWED_PATH_PREFIX ||
      pathname.startsWith(`${VENDOR_ALLOWED_PATH_PREFIX}/`);
    if (!isAllowed) {
      router.replace('/dashboard/vendor-negotiation');
    }
  }, [user, pathname, loading, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Filter navigation items based on user role
  const allNavigationItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/dashboard/customers', label: 'Customers', icon: Users },
    { href: '/dashboard/vendors', label: 'Vendors', icon: Building2 },
    { href: '/dashboard/vendor-negotiation', label: 'Vendor Negotiation', icon: FileText, isSubItem: true },
    { href: '/dashboard/timeline', label: 'Timeline', icon: Clock },
    { href: '/dashboard/reports', label: 'Reports and Analytics', icon: BarChart3 },
    { href: '/dashboard/trash', label: 'Trash', icon: Trash2 },
  ];

  // For vendors, show only Negotiation/Approval navigation item
  const navigationItems = user?.role === 'vendor'
    ? [{ href: '/dashboard/vendor-negotiation', label: 'Negotiation/Approval', icon: FileText }]
    : allNavigationItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const sidebarWidth = sidebarCollapsed ? 80 : 256;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        user={user}
        onLogout={handleLogout}
        navigationItems={navigationItems}
        isCollapsed={sidebarCollapsed}
        onToggle={setSidebarCollapsed}
      />

      {/* Main Content */}
      <motion.main
        initial={false}
        animate={{
          marginLeft: `${sidebarWidth}px`,
        }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="min-h-screen"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-8"
        >
          {children}
        </motion.div>
      </motion.main>
    </div>
  );
}
