/**
 * User Presence — Domain Event Catalog
 *
 * Events:
 *   UserLoggedIn            → emitted on successful authentication
 *   UserSessionUpdated      → emitted on heartbeat / status change
 *   UserLoggedOut           → emitted on explicit logout or session expiry
 *   SuspiciousLoginDetected → emitted by LoginSecurityAnalyzer
 */

import { eventKernel, type DomainEvent } from '@/domains/shared/event-kernel';
import type { AlertSeverity, AlertType } from './login-security-analyzer';

// ── Payload types ──────────────────────────────────────────────

export interface UserLoggedInPayload {
  userId: string;
  tenantId: string;
  ip: string;
  country?: string;
  city?: string;
  browser?: string;
  os?: string;
  loginMethod?: string;
}

export interface UserSessionUpdatedPayload {
  sessionId: string;
  userId: string;
  tenantId: string;
  status: 'online' | 'idle' | 'away';
  lastActivity: string;
}

export interface UserLoggedOutPayload {
  userId: string;
  tenantId: string;
  sessionId: string;
  reason: 'explicit' | 'timeout' | 'forced' | 'expired';
  durationSeconds?: number;
}

export interface SuspiciousLoginDetectedPayload {
  userId: string;
  tenantId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  description: string;
  ip?: string;
  country?: string;
  details?: Record<string, unknown>;
}

// ── Event type constants ───────────────────────────────────────

export const USER_PRESENCE_EVENTS = {
  USER_LOGGED_IN: 'UserLoggedIn',
  USER_SESSION_UPDATED: 'UserSessionUpdated',
  USER_LOGGED_OUT: 'UserLoggedOut',
  SUSPICIOUS_LOGIN_DETECTED: 'SuspiciousLoginDetected',
} as const;

// ── Emitters ───────────────────────────────────────────────────

const SOURCE = 'user-presence';

export function emitUserLoggedIn(payload: UserLoggedInPayload): void {
  eventKernel.emit<UserLoggedInPayload>({
    type: USER_PRESENCE_EVENTS.USER_LOGGED_IN,
    payload,
    timestamp: new Date().toISOString(),
    source: SOURCE,
    priority: 'medium',
  });
}

export function emitUserSessionUpdated(payload: UserSessionUpdatedPayload): void {
  eventKernel.emit<UserSessionUpdatedPayload>({
    type: USER_PRESENCE_EVENTS.USER_SESSION_UPDATED,
    payload,
    timestamp: new Date().toISOString(),
    source: SOURCE,
    priority: 'low',
  });
}

export function emitUserLoggedOut(payload: UserLoggedOutPayload): void {
  eventKernel.emit<UserLoggedOutPayload>({
    type: USER_PRESENCE_EVENTS.USER_LOGGED_OUT,
    payload,
    timestamp: new Date().toISOString(),
    source: SOURCE,
    priority: 'medium',
  });
}

export function emitSuspiciousLoginDetected(payload: SuspiciousLoginDetectedPayload): void {
  const priorityMap: Record<AlertSeverity, DomainEvent['priority']> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
  };

  eventKernel.emit<SuspiciousLoginDetectedPayload>({
    type: USER_PRESENCE_EVENTS.SUSPICIOUS_LOGIN_DETECTED,
    payload,
    timestamp: new Date().toISOString(),
    source: SOURCE,
    priority: priorityMap[payload.severity],
  });
}
