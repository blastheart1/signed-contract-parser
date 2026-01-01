'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { NavigationItem } from './Sidebar';

interface SidebarNavigationProps {
  items: NavigationItem[];
  collapsed: boolean;
}

function NavigationItemsContent({ items, collapsed }: SidebarNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <>
      {items.map((item) => {
        const fromTrash = searchParams?.get('from') === 'trash';
        const isViewingCustomerDetail = pathname?.startsWith('/dashboard/customers/');

        let isActive = item.exact
          ? pathname === item.href
          : pathname?.startsWith(item.href);

        if (isViewingCustomerDetail && fromTrash) {
          isActive = item.href === '/dashboard/trash';
        }

        const Icon = item.icon;
        const linkContent = (
          <Link
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              collapsed ? 'justify-center' : '',
              item.isSubItem ? 'pl-8' : '', // Indent sub-items
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium">{item.label}</span>}
          </Link>
        );

        if (collapsed) {
          return (
            <TooltipProvider key={item.href}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }

        return <div key={item.href}>{linkContent}</div>;
      })}
    </>
  );
}

export default function SidebarNavigation({ items, collapsed }: SidebarNavigationProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-1">
          <div className="h-10 bg-muted animate-pulse rounded-lg" />
          <div className="h-10 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <NavigationItemsContent items={items} collapsed={collapsed} />
    </Suspense>
  );
}
