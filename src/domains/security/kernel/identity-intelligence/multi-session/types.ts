/**
 * Multi-Session Types — Future: simultaneous login to multiple organizations
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  MULTI-SESSION MODEL                                            ║
 * ║                                                                  ║
 * ║  Each "OrgSession" is an independently authenticated context.    ║
 * ║  The user can have N active sessions, one per organization.      ║
 * ║                                                                  ║
 * ║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             ║
 * ║  │  Org A (★)  │  │  Org B      │  │  Org C      │             ║
 * ║  │  active tab │  │  background │  │  background │             ║
 * ║  └─────────────┘  └─────────────┘  └─────────────┘             ║
 * ║                                                                  ║
 * ║  (★) = primary/focused session                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { TenantRole, ScopeType } from '@/domains/shared/types';
import type { RiskAssessment } from '../types';

// ════════════════════════════════════
// ORG SESSION
// ════════════════════════════════════

export type OrgSessionStatus = 'active' | 'background' | 'expired' | 'error';

/**
 * Represents one authenticated session to a single organization/tenant.
 */
export interface OrgSession {
  /** Unique per org-session (not the global session_id) */
  readonly id: string;

  /** Tenant identity */
  readonly tenant_id: string;
  readonly tenant_name: string;
  readonly tenant_logo_url: string | null;

  /** User's role in this tenant */
  readonly role: TenantRole;

  /** Current scope within this tenant */
  readonly scope_level: ScopeType;
  readonly group_id: string | null;
  readonly company_id: string | null;

  /** Session lifecycle */
  readonly status: OrgSessionStatus;
  readonly authenticated_at: number;
  readonly last_active_at: number;
  readonly expires_at: number;

  /** Risk assessment specific to this org session */
  readonly risk: RiskAssessment;

  /** Unread notifications / pending actions count */
  readonly badge_count: number;
}

// ════════════════════════════════════
// MULTI-SESSION STORE
// ════════════════════════════════════

/**
 * The multi-session store holds all org sessions and tracks the primary one.
 */
export interface MultiSessionState {
  /** All active org sessions, keyed by tenant_id */
  readonly sessions: ReadonlyMap<string, OrgSession>;

  /** The currently focused/primary session */
  readonly primary_tenant_id: string | null;

  /** Maximum allowed concurrent sessions */
  readonly max_sessions: number;

  /** Total unread badge across all sessions */
  readonly total_badge_count: number;
}

// ════════════════════════════════════
// MULTI-SESSION EVENTS
// ════════════════════════════════════

export type MultiSessionEventType =
  | 'OrgSessionAdded'
  | 'OrgSessionRemoved'
  | 'OrgSessionFocused'
  | 'OrgSessionExpired'
  | 'OrgSessionBadgeUpdated';

export interface MultiSessionEvent {
  readonly type: MultiSessionEventType;
  readonly timestamp: number;
  readonly tenant_id: string;
  readonly tenant_name: string;
  readonly metadata?: Record<string, unknown>;
}

// ════════════════════════════════════
// MULTI-SESSION COMMANDS
// ════════════════════════════════════

export interface AddOrgSessionCommand {
  tenant_id: string;
  /** If true, immediately focus this session */
  focus?: boolean;
}

export interface RemoveOrgSessionCommand {
  tenant_id: string;
  /** If true, also logout from this org (revoke token) */
  logout?: boolean;
}

export interface FocusOrgSessionCommand {
  tenant_id: string;
}
