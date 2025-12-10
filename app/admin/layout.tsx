'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  LogOut, 
  Settings, 
  FileText,
  FileSearch,
  Database,
  BarChart3,
  Menu,
  X,
  Repeat
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  username: string;
  email?: string;
  role: string | null;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (!data.success || !data.user || data.user.role !== 'admin') {
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

  const navItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    { href: '/admin/audit-logs', label: 'Audit Logs', icon: FileSearch },
    { href: '/admin/data-management', label: 'Data Management', icon: Database },
    { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header with Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b bg-card h-16 flex items-center justify-between px-4">
        <Link href="/admin" className="font-bold text-xl">
          Admin Panel
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-11 w-11"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
            {/* Sidebar */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed left-0 top-0 h-full w-64 border-r bg-card z-50 lg:hidden"
            >
              <SidebarContent
                navItems={navItems}
                pathname={pathname}
                user={user}
                handleLogout={handleLogout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 h-full w-64 border-r bg-card">
        <SidebarContent
          navItems={navItems}
          pathname={pathname}
          user={user}
          handleLogout={handleLogout}
        />
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4 sm:p-6 lg:p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

function SidebarContent({
  navItems,
  pathname,
  user,
  handleLogout,
}: {
  navItems: Array<{ href: string; label: string; icon: any; exact?: boolean }>;
  pathname: string | null;
  user: User;
  handleLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-6 border-b">
        <Link href="/admin" className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary flex-shrink-0" />
          <div>
            <h1 className="text-l font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">System Management</p>
          </div>
        </Link>
        {/* Toggle to Dashboard View */}
        <div className="mt-4 flex justify-center">
          <Link href="/dashboard">
            <Button
              variant="outline"
              className="w-32 justify-center gap-2 border-2 hover:bg-accent"
            >
              <Repeat className="h-4 w-4" />
              <span className="font-medium">Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname?.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors min-h-[44px]",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <div className="mb-2 px-3 py-2 text-sm">
          <p className="font-medium">{user.username}</p>
          <p className="text-xs text-muted-foreground">{user.role || 'No role'}</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start min-h-[44px]"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}

