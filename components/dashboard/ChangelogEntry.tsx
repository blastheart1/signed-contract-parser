'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Plus, Wrench, Sparkles, AlertTriangle } from 'lucide-react';
import type { ChangelogEntry } from '@/lib/changelog';

interface ChangelogEntryProps {
  entry: ChangelogEntry;
  isLast?: boolean;
}

export default function ChangelogEntry({ entry, isLast = false }: ChangelogEntryProps) {
  const { version, date, type, features, fixes, improvements, breakingChanges } = entry;

  // Badge color based on version type
  const badgeVariant = 
    type === 'major' ? 'destructive' :
    type === 'minor' ? 'default' :
    'secondary';

  // Format date for display
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className={cn('pb-6', !isLast && 'border-b border-border')}>
      {/* Version Header */}
      <div className="flex items-center gap-3 mb-4">
        <Badge variant={badgeVariant} className="text-xs">
          {version}
        </Badge>
        <span className="text-sm text-muted-foreground">{formattedDate}</span>
      </div>

      {/* Breaking Changes */}
      {breakingChanges && breakingChanges.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h4 className="text-sm font-semibold text-destructive">Breaking Changes</h4>
          </div>
          <ul className="list-disc list-inside space-y-1 ml-6">
            {breakingChanges.map((change, idx) => (
              <li key={idx} className="text-sm text-foreground">{change}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Features */}
      {features && features.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">New Features</h4>
          </div>
          <ul className="list-disc list-inside space-y-1 ml-6">
            {features.map((feature, idx) => (
              <li key={idx} className="text-sm text-muted-foreground">{feature}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {improvements && improvements.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <h4 className="text-sm font-semibold">Improvements</h4>
          </div>
          <ul className="list-disc list-inside space-y-1 ml-6">
            {improvements.map((improvement, idx) => (
              <li key={idx} className="text-sm text-muted-foreground">{improvement}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Bug Fixes */}
      {fixes && fixes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-4 w-4 text-green-600" />
            <h4 className="text-sm font-semibold">Bug Fixes</h4>
          </div>
          <ul className="list-disc list-inside space-y-1 ml-6">
            {fixes.map((fix, idx) => (
              <li key={idx} className="text-sm text-muted-foreground">{fix}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
