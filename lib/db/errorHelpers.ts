/**
 * Check if a database error indicates a table doesn't exist
 * PostgreSQL error code 42P01 = "undefined_table"
 * 
 * Error structure from @vercel/postgres can vary:
 * - error.cause.code (most common)
 * - error.code (sometimes)
 * - error.message may contain "does not exist"
 */
export function isTableNotExistError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as any;

  // Check error.cause.code (most common structure)
  if ('cause' in err && err.cause) {
    const cause = err.cause;
    if (typeof cause === 'object' && 'code' in cause) {
      if (cause.code === '42P01') {
        return true;
      }
    }
  }

  // Check error.code directly
  if ('code' in err && err.code === '42P01') {
    return true;
  }

  // Check error message for "does not exist" pattern (fallback)
  if ('message' in err && typeof err.message === 'string') {
    const message = err.message.toLowerCase();
    if (message.includes('does not exist') && message.includes('alert_acknowledgments')) {
      return true;
    }
  }

  return false;
}
