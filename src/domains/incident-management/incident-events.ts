/**
 * Enterprise Incident Management — Kernel Events
 *
 * Canonical events emitted through GlobalEventKernel for cross-cutting
 * integration with Observability, Self-Healing, Governance, and Control Plane.
 */

export const INCIDENT_KERNEL_EVENTS = {
  /** New incident detected (auto or manual) */
  IncidentCreated: 'incident:created',
  /** Incident acknowledged by an operator */
  IncidentAcknowledged: 'incident:acknowledged',
  /** Incident status changed */
  IncidentStatusChanged: 'incident:status_changed',
  /** Incident escalated to a higher level */
  IncidentEscalated: 'incident:escalated',
  /** SLA deadline breached */
  SLABreached: 'incident:sla_breached',
  /** Incident resolved */
  IncidentResolved: 'incident:resolved',
  /** Incident closed after postmortem */
  IncidentClosed: 'incident:closed',
  /** Postmortem published */
  PostmortemPublished: 'incident:postmortem_published',
  /** Component status changed on status page */
  ComponentStatusChanged: 'incident:component_status_changed',
} as const;

export type IncidentKernelEvent = typeof INCIDENT_KERNEL_EVENTS[keyof typeof INCIDENT_KERNEL_EVENTS];

// ── Payload types ───────────────────────────────────

export interface IncidentCreatedPayload {
  incident_id: string;
  title: string;
  severity: string;
  source: string;
  tenant_id: string | null;
  affected_modules: string[];
}

export interface IncidentStatusChangedPayload {
  incident_id: string;
  previous_status: string;
  new_status: string;
  severity: string;
  tenant_id: string | null;
}

export interface IncidentEscalatedPayload {
  incident_id: string;
  from_level: string;
  to_level: string;
  reason: string;
  auto_escalated: boolean;
}

export interface SLABreachedPayload {
  incident_id: string;
  severity: string;
  tenant_id: string | null;
  deadline_type: 'response' | 'acknowledgement' | 'resolution';
  elapsed_minutes: number;
}

export interface PostmortemPublishedPayload {
  postmortem_id: string;
  incident_id: string;
  impact_duration_minutes: number | null;
  action_items_count: number;
}

export const __DOMAIN_CATALOG = {
  domain: 'Incident Management',
  color: 'hsl(0 75% 55%)',
  events: [
    { name: 'IncidentCreated', description: 'Novo incidente detectado' },
    { name: 'IncidentAcknowledged', description: 'Incidente reconhecido pelo operador' },
    { name: 'IncidentStatusChanged', description: 'Status do incidente alterado' },
    { name: 'IncidentEscalated', description: 'Incidente escalonado' },
    { name: 'SLABreached', description: 'SLA violado' },
    { name: 'IncidentResolved', description: 'Incidente resolvido' },
    { name: 'IncidentClosed', description: 'Incidente encerrado' },
    { name: 'PostmortemPublished', description: 'Postmortem publicado' },
    { name: 'ComponentStatusChanged', description: 'Status do componente alterado' },
  ],
};
