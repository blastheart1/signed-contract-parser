'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Menu, X, FileText, LogOut, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import SidebarNavigation from './SidebarNavigation';
import { createPortal } from 'react-dom';
import ChangelogModal from './ChangelogModal';
import ThemeSelector from './ThemeSelector';
import VendorProfileModal from './VendorProfileModal';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: string | null;
}

export interface NavigationItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  isSubItem?: boolean; // For nested items like Vendor Negotiation under Vendors
}

interface SidebarProps {
  user: User;
  onLogout: () => void;
  navigationItems: NavigationItem[];
  isCollapsed?: boolean;
  defaultCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  showToggle?: boolean;
  className?: string;
}

const STORAGE_KEY = 'sidebar-collapsed';
const SIDEBAR_WIDTH_EXPANDED = 256; // w-64 = 16rem = 256px
const SIDEBAR_WIDTH_COLLAPSED = 80; // w-20 = 5rem = 80px

export default function Sidebar({
  user,
  onLogout,
  navigationItems,
  isCollapsed: controlledCollapsed,
  defaultCollapsed = false,
  onToggle,
  showToggle = true,
  className,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');

  // Determine if we're in controlled or uncontrolled mode
  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;

  // Initialize from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    if (!isControlled) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setInternalCollapsed(stored === 'true');
      }
    }
  }, [isControlled]);

  // Fetch current version from API
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    fetch('/api/version', { signal: abortController.signal })
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success && data.version) {
          setCurrentVersion(data.version);
        }
      })
      .catch(error => {
        // Ignore abort errors (component unmounted)
        if (error.name !== 'AbortError' && isMounted) {
          console.error('Error fetching version:', error);
        }
      });

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setMobileOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
    } else {
      const newCollapsed = !collapsed;
      if (isControlled) {
        onToggle?.(newCollapsed);
      } else {
        setInternalCollapsed(newCollapsed);
        localStorage.setItem(STORAGE_KEY, String(newCollapsed));
        onToggle?.(newCollapsed);
      }
    }
  }, [collapsed, isControlled, isMobile, onToggle]);

  // Close mobile sidebar when clicking outside
  useEffect(() => {
    if (!mobileOpen || !isMobile) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-sidebar]') && !target.closest('[data-sidebar-toggle]')) {
        setMobileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileOpen, isMobile]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen, isMobile]);

  if (!isMounted) {
    return null;
  }

  const sidebarWidth = collapsed && !isMobile ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
  const sidebarContent = (
    <motion.aside
      data-sidebar
      initial={false}
      animate={{
        width: isMobile ? SIDEBAR_WIDTH_EXPANDED : sidebarWidth,
        x: isMobile && !mobileOpen ? -SIDEBAR_WIDTH_EXPANDED : 0,
      }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        'fixed left-0 top-0 z-40 h-full border-r bg-card flex flex-col',
        isMobile ? 'shadow-2xl' : '',
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        'p-4 border-b',
        collapsed && !isMobile ? 'flex items-center justify-center' : ''
      )}>
        <div className={cn(
          'flex items-center',
          collapsed && !isMobile ? 'justify-center' : 'justify-between w-full'
        )}>
          {(!collapsed || isMobile) && (
            <div className="flex flex-col gap-1">
              <Link
                href="/dashboard"
                className="flex items-center gap-2"
              >
                <FileText className="h-6 w-6 text-primary flex-shrink-0" />
                <motion.div
                  initial={false}
                  animate={{ opacity: collapsed && !isMobile ? 0 : 1 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <h1 className="text-lg font-bold whitespace-nowrap">Unified Dashboard</h1>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">Build Contracts</p>
                </motion.div>
              </Link>
              <button
                onClick={() => setChangelogOpen(true)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-8 text-left"
              >
                Version {currentVersion}
              </button>
            </div>
          )}
          {showToggle && !isMobile && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggle}
                    className={cn(
                      "h-8 w-8 flex-shrink-0",
                      collapsed ? "mx-auto" : "ml-auto"
                    )}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  >
                    {collapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Admin Button (if applicable) */}
      {user?.role === 'admin' && (!collapsed || isMobile) && (
        <motion.div
          initial={false}
          animate={{ opacity: collapsed && !isMobile ? 0 : 1, height: collapsed && !isMobile ? 0 : 'auto' }}
          transition={{ duration: 0.15 }}
          className="px-4 py-4 border-b"
        >
          <Link href="/admin">
            <Button
              variant="outline"
              className={cn(
                'w-full justify-center gap-2 border-2 hover:bg-accent',
                collapsed && !isMobile ? 'w-12 px-0' : ''
              )}
            >
              <Repeat className="h-4 w-4" />
              {(!collapsed || isMobile) && <span className="font-medium">Admin</span>}
            </Button>
          </Link>
        </motion.div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <SidebarNavigation
          items={navigationItems}
          collapsed={collapsed && !isMobile}
        />
      </nav>

      {/* Footer - Theme Selector, User Info & Logout */}
      <div className={cn(
        "p-4",
        !(collapsed && !isMobile) && "border-t"
      )}>
        {/* Theme Selector */}
        <motion.div
          initial={false}
          animate={{ opacity: collapsed && !isMobile ? 0 : 1, height: collapsed && !isMobile ? 0 : 'auto' }}
          transition={{ duration: 0.15 }}
          className={cn(
            'mb-3',
            collapsed && !isMobile ? 'overflow-hidden' : ''
          )}
        >
          {(!collapsed || isMobile) && (
            <ThemeSelector />
          )}
        </motion.div>
        
        {/* User Info */}
        <motion.div
          initial={false}
          animate={{ opacity: collapsed && !isMobile ? 0 : 1, height: collapsed && !isMobile ? 0 : 'auto' }}
          transition={{ duration: 0.15 }}
          className={cn(
            'mb-2 px-3 py-2 text-sm',
            collapsed && !isMobile ? 'overflow-hidden' : '',
            (!collapsed || isMobile) && user.role === 'vendor' ? 'cursor-pointer hover:bg-muted/50 rounded transition-colors' : ''
          )}
          onClick={() => {
            if ((!collapsed || isMobile) && user.role === 'vendor') {
              setProfileModalOpen(true);
            }
          }}
        >
          {(!collapsed || isMobile) && (
            <>
              <p className="font-medium">{user.username}</p>
              <p className="text-xs text-muted-foreground">{user.role || 'No role'}</p>
            </>
          )}
        </motion.div>
        
        {/* Logout Button */}
        <Button
          variant="ghost"
          className={cn(
            'w-full',
            collapsed && !isMobile ? 'justify-center px-2' : 'justify-start'
          )}
          onClick={onLogout}
        >
          <LogOut className={cn('h-4 w-4', collapsed && !isMobile ? '' : 'mr-2')} />
          {(!collapsed || isMobile) && <span>Logout</span>}
        </Button>
      </div>
      <ChangelogModal open={changelogOpen} onOpenChange={setChangelogOpen} />
      {user.role === 'vendor' && (
        <VendorProfileModal user={user} open={profileModalOpen} onOpenChange={setProfileModalOpen} />
      )}
    </motion.aside>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      {isMobile && showToggle && isMounted && (
        <Button
          data-sidebar-toggle
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className="fixed top-4 left-4 z-50 h-10 w-10 bg-card shadow-md"
          aria-label="Toggle sidebar"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      )}
      {/* Mobile Overlay */}
      {isMobile && mobileOpen && isMounted && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
        />,
        document.body
      )}
      {sidebarContent}
    </>
  );
}
