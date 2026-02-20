/**
 * Regulatory Intelligence — Domain Events
 *
 * Cross-module event bus for regulatory changes.
 * Consumed by:
 *  - Career & Legal Intelligence (update legal requirements)
 *  - Safety Automation Engine (trigger playbooks)
 *  - Workforce Intelligence (strategic risk signals)
 *  - NR Training Lifecycle (update training catalog)
 *  - PCMSO / PGR (update exam schedules)
 */

type EventHandler = (payload: Record<string, unknown>) => void;
const handlers = new Map<string, EventHandler[]>();

export const regulatoryEvents = {
  /** A new regulatory change was detected */
  CHANGE_DETECTED: 'regulatory:change_detected',
  /** Impact analysis completed */
  IMPACT_ANALYZED: 'regulatory:impact_analyzed',
  /** Alert generated for a user/role */
  ALERT_GENERATED: 'regulatory:alert_generated',
  /** Alert resolved */
  ALERT_RESOLVED: 'regulatory:alert_resolved',
  /** Legal base automatically updated */
  LEGAL_BASE_UPDATED: 'regulatory:legal_base_updated',
  /** Norm version created */
  NORM_VERSION_CREATED: 'regulatory:norm_version_created',
  /** Norm revoked */
  NORM_REVOKED: 'regulatory:norm_revoked',
  /** Monitor check completed */
  MONITOR_CHECK_COMPLETED: 'regulatory:monitor_check_completed',

  // ── Typed Alert Events ──
  /** Legislation updated (CLT, Lei, Decreto, etc.) */
  LEGISLATION_UPDATED: 'regulatory:legislation_updated',
  /** NR norm updated */
  NR_UPDATED: 'regulatory:nr_updated',
  /** CCT (Convenção Coletiva) updated */
  CCT_UPDATED: 'regulatory:cct_updated',
  /** eSocial layout changed */
  ESOCIAL_LAYOUT_CHANGED: 'regulatory:esocial_layout_changed',
} as const;

export function emitRegulatoryEvent(event: string, payload: Record<string, unknown>): void {
  const fns = handlers.get(event) || [];
  fns.forEach(fn => fn(payload));
}

export function onRegulatoryEvent(event: string, handler: EventHandler): () => void {
  if (!handlers.has(event)) handlers.set(event, []);
  handlers.get(event)!.push(handler);
  return () => {
    const arr = handlers.get(event);
    if (arr) handlers.set(event, arr.filter(h => h !== handler));
  };
}
