/**
 * User Presence & Login Intelligence — Barrel export.
 *
 * Architecture:
 *  UserPresenceEngine
 *   ├── SessionTracker          → capture device, geo, IP on login
 *   ├── GeoLocationResolver     → browser + IP fallback
 *   ├── DeviceFingerprintService→ UA parsing
 *   ├── SessionHeartbeatService → 60s heartbeat
 *   ├── LoginAnalyticsEngine    → login trends, peak hours, SSO %
 *   └── LiveUserMapRenderer     → geo-clustered map of active users
 */
export type * from './types';
export {
  fetchActiveSessions,
  fetchRecentSessions,
  computePresenceSummary,
  computeLoginAnalytics,
} from './presence-engine';
export { usePresenceRealtime } from './use-presence-realtime';
export { analyzeLoginSecurity } from './login-security-analyzer';
export type { SecurityAlert, AlertSeverity, AlertType } from './login-security-analyzer';
export {
  USER_PRESENCE_EVENTS,
  emitUserLoggedIn,
  emitUserSessionUpdated,
  emitUserLoggedOut,
  emitSuspiciousLoginDetected,
} from './event-catalog';
export type {
  UserLoggedInPayload,
  UserSessionUpdatedPayload,
  UserLoggedOutPayload,
  SuspiciousLoginDetectedPayload,
} from './event-catalog';
