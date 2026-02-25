/**
 * Single source of truth for persisting the active tenant ID.
 *
 * Auth.tsx writes this *before* TenantContext mounts (seeding the value).
 * TenantContext reads it on init and updates it via setCurrentTenant.
 * No other code should touch localStorage('currentTenantId') directly.
 */

const STORAGE_KEY = 'currentTenantId';

export const tenantStorage = {
  get(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  },
  set(tenantId: string): void {
    localStorage.setItem(STORAGE_KEY, tenantId);
  },
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
