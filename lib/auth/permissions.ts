import type { SessionUser } from './session';

export type UserRole = 'admin' | 'contract_manager' | 'sales_rep' | 'accountant' | 'viewer' | 'vendor';

/**
 * Check if user has required role
 */
export function hasRole(user: SessionUser | null, requiredRole: UserRole | UserRole[]): boolean {
  if (!user || !user.role) {
    return false;
  }

  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(user.role as UserRole);
  }

  return user.role === requiredRole;
}

/**
 * Check if user is admin
 */
export function isAdmin(user: SessionUser | null): boolean {
  return hasRole(user, 'admin');
}

/**
 * Check if user can edit contracts
 */
export function canEditContracts(user: SessionUser | null): boolean {
  if (!user || !user.role) return false;
  return ['admin', 'contract_manager'].includes(user.role);
}

/**
 * Check if user can view all contracts
 */
export function canViewAllContracts(user: SessionUser | null): boolean {
  if (!user || !user.role) return false;
  return ['admin', 'contract_manager', 'accountant', 'viewer'].includes(user.role);
}

/**
 * Check if user can manage users
 */
export function canManageUsers(user: SessionUser | null): boolean {
  return isAdmin(user);
}

/**
 * Get user's accessible contracts filter
 * Returns null if user can view all, or a filter function for sales_rep
 */
export function getContractFilter(user: SessionUser | null): ((salesRep: string | null) => boolean) | null {
  if (!user || !user.role) return null;
  
  if (user.role === 'sales_rep') {
    // Sales reps can only see their own contracts
    return (salesRep: string | null) => salesRep === user.username;
  }
  
  // Admin, contract_manager, accountant, viewer can see all
  return null;
}

