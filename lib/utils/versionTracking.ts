/**
 * Version tracking utilities for changelog feature
 * Tracks which versions a user has viewed using localStorage
 */

const STORAGE_KEY = 'calimingo-viewed-versions';

/**
 * Get array of versions the user has viewed
 */
export function getViewedVersions(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const versions = JSON.parse(stored);
    return Array.isArray(versions) ? versions : [];
  } catch (error) {
    console.error('Error reading viewed versions from localStorage:', error);
    return [];
  }
}

/**
 * Mark a version as viewed by the user
 */
export function markVersionAsViewed(version: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const viewed = getViewedVersions();
    if (!viewed.includes(version)) {
      viewed.push(version);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(viewed));
    }
  } catch (error) {
    console.error('Error saving viewed version to localStorage:', error);
  }
}

/**
 * Get list of versions that haven't been viewed yet
 */
export function getUnreadVersions(allVersions: string[]): string[] {
  const viewed = getViewedVersions();
  return allVersions.filter(version => !viewed.includes(version));
}

/**
 * Check if a specific version has been viewed
 */
export function hasViewedVersion(version: string): boolean {
  const viewed = getViewedVersions();
  return viewed.includes(version);
}

/**
 * Clear all viewed versions (useful for testing)
 */
export function clearViewedVersions(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing viewed versions from localStorage:', error);
  }
}
