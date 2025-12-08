'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, FileText, LogOut, Settings, Clock, BarChart3, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  username: string;
  email?: string;
  role: string | null;
}

function NavigationItems() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/dashboard/customers', label: 'Customers', icon: Users },
    { href: '/dashboard/timeline', label: 'Timeline', icon: Clock },
    { href: '/dashboard/reports', label: 'Reports and Analytics', icon: BarChart3 },
    { href: '/dashboard/trash', label: 'Trash', icon: Trash2 },
  ];

  return (
    <>
      {navItems.map((item) => {
        // Special handling: if viewing a customer detail page with from=trash query param, highlight Trash instead of Customers
        const fromTrash = searchParams.get('from') === 'trash';
        const isViewingCustomerDetail = pathname?.startsWith('/dashboard/customers/');
        
        let isActive = item.exact
          ? pathname === item.href
          : pathname?.startsWith(item.href);
        
        // Override: if viewing customer detail from trash, highlight Trash instead of Customers
        if (isViewingCustomerDetail && fromTrash) {
          isActive = item.href === '/dashboard/trash';
        }
        
        const Icon = item.icon;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-64 border-r bg-card">
        <div className="flex h-full flex-col">
          <div className="p-6 border-b">
            <Link href="/dashboard" className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary flex-shrink-0" />
              <div>
                <h1 className="text-l font-bold">Unified Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Build Contracts</p>
              </div>
            </Link>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <Suspense fallback={<div className="space-y-1"><div className="h-10 bg-muted animate-pulse rounded-lg" /><div className="h-10 bg-muted animate-pulse rounded-lg" /></div>}>
              <NavigationItems />
              {user?.role === 'admin' && (
                <Link
                  href="/admin"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Settings className="h-5 w-5" />
                  <span className="font-medium">Admin</span>
                </Link>
              )}
            </Suspense>
          </nav>
          <div className="p-4 border-t">
            <div className="mb-2 px-3 py-2 text-sm">
              <p className="font-medium">{user.username}</p>
              <p className="text-xs text-muted-foreground">{user.role || 'No role'}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
