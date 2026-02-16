/**
 * Multi-Session Module — Public API
 *
 * Future feature: simultaneous login to multiple organizations.
 * Currently exports types and stub service for architectural readiness.
 */

export { MultiSessionService, multiSessionService } from './multi-session.service';

export type {
  OrgSession,
  OrgSessionStatus,
  MultiSessionState,
  MultiSessionEvent,
  MultiSessionEventType,
  AddOrgSessionCommand,
  RemoveOrgSessionCommand,
  FocusOrgSessionCommand,
} from './types';
