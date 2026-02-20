/**
 * eSocial Governance — Domain Events
 */

type EventHandler = (...args: unknown[]) => void;
const handlers = new Map<string, Set<EventHandler>>();

export const esocialGovernanceEvents = {
  LAYOUT_VERSION_CHANGED: 'esocial_gov.layout_version_changed',
  TENANT_STATUS_CHANGED: 'esocial_gov.tenant_status_changed',
  EVENT_REJECTED: 'esocial_gov.event_rejected',
  DEADLINE_APPROACHING: 'esocial_gov.deadline_approaching',
  BATCH_COMPLETED: 'esocial_gov.batch_completed',
  COMPLIANCE_GAP_DETECTED: 'esocial_gov.compliance_gap_detected',
  ALERT_GENERATED: 'esocial_gov.alert_generated',
  ALERT_RESOLVED: 'esocial_gov.alert_resolved',
  LAYOUT_MISMATCH_DETECTED: 'esocial_gov.layout_mismatch_detected',
  CERTIFICATE_EXPIRING: 'esocial_gov.certificate_expiring',
  CERTIFICATE_EXPIRED: 'esocial_gov.certificate_expired',
  CERTIFICATE_INVALID: 'esocial_gov.certificate_invalid',
  CLIENT_COMM_DISPATCHED: 'esocial_gov.client_comm_dispatched',
} as const;

export function emitEsocialGovEvent(event: string, payload?: unknown): void {
  const fns = handlers.get(event);
  if (fns) fns.forEach(fn => { try { fn(payload); } catch (e) { console.error(`[eSocialGov Event] ${event}:`, e); } });
}

export function onEsocialGovEvent(event: string, handler: EventHandler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  return () => { handlers.get(event)?.delete(handler); };
}
