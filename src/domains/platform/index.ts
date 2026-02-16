/**
 * Platform Domain — Public API
 */
export { PlatformGuard, usePlatformIdentity } from './PlatformGuard';
export type { PlatformRoleType } from './PlatformGuard';
export { hasPlatformPermission, getAllPlatformPermissions, PLATFORM_PERMISSIONS, PLATFORM_PERMISSION_MATRIX } from './platform-permissions';
export type { PlatformPermission } from './platform-permissions';
export { usePlatformPermissions } from './use-platform-permissions';
