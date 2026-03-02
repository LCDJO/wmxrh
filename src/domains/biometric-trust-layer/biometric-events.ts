/**
 * Biometric Domain Events — canonical events for the Biometric Trust Layer.
 *
 * Events:
 *  BiometricEnrollmentCompleted  → enrollment facial concluído
 *  BiometricMatchSuccess         → verificação facial aprovada
 *  BiometricMatchFailed          → verificação facial rejeitada
 *  LivenessCheckFailed           → prova de vida reprovada
 *  BiometricConsentRevoked       → consentimento LGPD revogado
 */

// ── Event Constants ─────────────────────────────────────────────

export const BIOMETRIC_EVENTS = {
  BiometricEnrollmentCompleted: 'biometric:enrollment_completed',
  BiometricMatchSuccess: 'biometric:match_success',
  BiometricMatchFailed: 'biometric:match_failed',
  LivenessCheckFailed: 'biometric:liveness_check_failed',
  BiometricConsentRevoked: 'biometric:consent_revoked',
} as const;

export type BiometricEventType = typeof BIOMETRIC_EVENTS[keyof typeof BIOMETRIC_EVENTS];

// ── Payloads ────────────────────────────────────────────────────

export interface BiometricEnrollmentCompletedPayload {
  tenant_id: string;
  employee_id: string;
  enrollment_id: string;
  capture_method: string;
  quality_score: number;
  timestamp: string;
}

export interface BiometricMatchSuccessPayload {
  tenant_id: string;
  employee_id: string;
  match_log_id: string;
  match_score: number;
  liveness_score: number;
  risk_score: number;
  device_fingerprint?: string;
  ip_address?: string;
  timestamp: string;
}

export interface BiometricMatchFailedPayload {
  tenant_id: string;
  employee_id: string;
  match_log_id: string;
  match_score: number;
  match_result: string;
  liveness_score: number;
  risk_score: number;
  auto_action?: string;
  device_fingerprint?: string;
  ip_address?: string;
  timestamp: string;
}

export interface LivenessCheckFailedPayload {
  tenant_id: string;
  employee_id: string;
  stage: 'enrollment' | 'verification' | 'clock_verification';
  confidence_score: number;
  spoof_signals: string[];
  deepfake_detected: boolean;
  deepfake_confidence?: number;
  timestamp: string;
}

export interface BiometricConsentRevokedPayload {
  tenant_id: string;
  employee_id: string;
  consent_type: string;
  revoked_at: string;
  lgpd_article: string;
}

export type BiometricDomainEvent =
  | { type: typeof BIOMETRIC_EVENTS.BiometricEnrollmentCompleted; payload: BiometricEnrollmentCompletedPayload }
  | { type: typeof BIOMETRIC_EVENTS.BiometricMatchSuccess; payload: BiometricMatchSuccessPayload }
  | { type: typeof BIOMETRIC_EVENTS.BiometricMatchFailed; payload: BiometricMatchFailedPayload }
  | { type: typeof BIOMETRIC_EVENTS.LivenessCheckFailed; payload: LivenessCheckFailedPayload }
  | { type: typeof BIOMETRIC_EVENTS.BiometricConsentRevoked; payload: BiometricConsentRevokedPayload };

// ── In-Process Event Bus ────────────────────────────────────────

type BiometricEventHandler = (event: BiometricDomainEvent) => void | Promise<void>;

const handlers = new Map<string, Set<BiometricEventHandler>>();
const wildcardHandlers = new Set<BiometricEventHandler>();

/** Subscribe to a specific biometric event type. */
export function onBiometricEvent(eventType: BiometricEventType, handler: BiometricEventHandler): () => void {
  if (!handlers.has(eventType)) handlers.set(eventType, new Set());
  handlers.get(eventType)!.add(handler);
  return () => { handlers.get(eventType)?.delete(handler); };
}

/** Subscribe to ALL biometric events. */
export function onAnyBiometricEvent(handler: BiometricEventHandler): () => void {
  wildcardHandlers.add(handler);
  return () => { wildcardHandlers.delete(handler); };
}

/** Emit a biometric domain event. */
export function emitBiometricEvent(event: BiometricDomainEvent): void {
  // Specific handlers
  const specific = handlers.get(event.type);
  if (specific) {
    for (const h of specific) {
      try { h(event); } catch (err) { console.error(`[BiometricEvents] Handler error for ${event.type}:`, err); }
    }
  }
  // Wildcard handlers
  for (const h of wildcardHandlers) {
    try { h(event); } catch (err) { console.error('[BiometricEvents] Wildcard handler error:', err); }
  }
}

// ── Domain Catalog ──────────────────────────────────────────────

export const __BIOMETRIC_EVENT_CATALOG = {
  domain: 'BiometricTrustLayer',
  color: 'hsl(280 70% 55%)',
  events: [
    { name: 'BiometricEnrollmentCompleted', description: 'Enrollment biométrico facial concluído com sucesso' },
    { name: 'BiometricMatchSuccess', description: 'Verificação biométrica aprovada — match + liveness OK' },
    { name: 'BiometricMatchFailed', description: 'Verificação biométrica rejeitada — score abaixo do threshold' },
    { name: 'LivenessCheckFailed', description: 'Prova de vida reprovada — deepfake, spoof ou screen detectado' },
    { name: 'BiometricConsentRevoked', description: 'Consentimento biométrico revogado pelo titular (LGPD Art. 18)' },
  ],
};
