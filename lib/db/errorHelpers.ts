/**
 * Check if a database error indicates a table doesn't exist
 * PostgreSQL error code 42P01 = "undefined_table"
 */
export function isTableNotExistError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'cause' in error) {
    const cause = (error as any).cause;
    if (cause && typeof cause === 'object' && 'code' in cause) {
      return cause.code === '42P01';
    }
  }
  return false;
}
