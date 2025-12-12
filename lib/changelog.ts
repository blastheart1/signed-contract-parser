/**
 * Changelog entries for Calimingo Pools Contract Management System
 * Entries are stored in reverse chronological order (newest first)
 */

export interface ChangelogEntry {
  version: string;
  date: string; // ISO date string (YYYY-MM-DD)
  type: 'major' | 'minor' | 'patch';
  features?: string[];
  fixes?: string[];
  improvements?: string[];
  breakingChanges?: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '1.0.0-beta',
    date: '2024-12-12',
    type: 'major',
    features: [
      'Toggleable sidebar navigation with collapsed/expanded states (256px expanded, 80px collapsed)',
      'Icon-only sidebar mode with tooltips when collapsed',
      'Sticky table headers (freeze pane) for better column context while scrolling',
      'Column header sorting with reusable SortableTableHeader components',
      'Excel-style multi-select dropdown filters for table columns',
      'Text-based filtering for string columns',
      'Default contract stage set to "Waiting for Permit" for all new contracts',
      'Viewport-aware filter popup positioning with automatic collision detection',
    ],
    improvements: [
      'Edit/View mode consistency: fixed column widths prevent layout shifts',
      'Auto-resizing textarea for PRODUCT/SERVICE column with dynamic row height adjustment',
      'Reduced input padding for better space utilization in edit mode',
      'Hidden number input spinners for cleaner UI',
      'Mobile-optimized sidebar with overlay drawer on small screens',
      'localStorage persistence for sidebar state preference',
      'React Portal rendering for filter popups to prevent overflow clipping',
      'Set-based filtering for O(1) lookup performance',
      'Pure utility functions for sorting/filtering (no React dependencies)',
      'Proper z-index management and stacking context handling',
      'Body scroll lock on mobile when sidebar is open',
      'SSR-safe state initialization for sidebar',
      'Reusable table header components for standardization across the project',
      'Consistent header heights and visual alignment',
      'Mobile-responsive filter UI with touch-friendly targets',
    ],
    fixes: [
      'Fixed layout shift when entering/exiting edit mode',
      'Fixed filter popups being clipped by table overflow containers',
      'Fixed filter popups becoming unclickable when table collapses',
      'Fixed nested scroll contexts preventing sticky header functionality',
      'Fixed inconsistent column widths between view and edit modes',
      'Fixed content bleeding through sticky headers',
      'Normalized null/empty contract stages to display as "Waiting for Permit"',
    ],
  },
];

/**
 * Get the latest changelog entry
 */
export function getLatestChangelog(): ChangelogEntry | null {
  return changelog.length > 0 ? changelog[0] : null;
}

/**
 * Get changelog entry by version
 */
export function getChangelogByVersion(version: string): ChangelogEntry | undefined {
  return changelog.find(entry => entry.version === version);
}
