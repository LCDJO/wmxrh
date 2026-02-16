/**
 * usePlatformPermissions — Hook for platform-level permission checks.
 */
import { usePlatformIdentity } from './PlatformGuard';
import { hasPlatformPermission, type PlatformPermission } from './platform-permissions';

export function usePlatformPermissions() {
  const { identity, loading } = usePlatformIdentity();

  const can = (permission: PlatformPermission): boolean =>
    hasPlatformPermission(identity?.role, permission);

  const canAny = (...permissions: PlatformPermission[]): boolean =>
    permissions.some(p => can(p));

  const canAll = (...permissions: PlatformPermission[]): boolean =>
    permissions.every(p => can(p));

  return { can, canAny, canAll, role: identity?.role ?? null, loading };
}
