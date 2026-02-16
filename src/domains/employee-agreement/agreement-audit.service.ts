/**
 * AgreementAuditService
 *
 * Maintains a legal audit trail for all agreement lifecycle events.
 * Persists to the existing audit_logs table for unified compliance.
 *
 * AgreementAuditLog shape:
 *   - agreement_id
 *   - employee_id
 *   - ação (enviado, assinado, rejeitado)
 *   - provider
 *   - timestamp
 *   - ip_address
 */

import { supabase } from '@/integrations/supabase/client';
import { onAgreementEvent, type AgreementDomainEvent } from './events';

const ENTITY_TYPE = 'employee_agreement';

// ── Public read-model ──

export interface AgreementAuditLog {
  id: string;
  agreement_id: string | null;
  employee_id: string | null;
  acao: string;
  provider: string | null;
  timestamp: string;
  ip_address: string | null;
  // extras from audit_logs
  tenant_id: string;
  company_id: string | null;
  raw_payload: Record<string, unknown> | null;
}

// ── Internal audit entry for persistence ──

interface AuditEntry {
  tenant_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  new_value: Record<string, unknown> | null;
  company_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ── Action label mapping ──

const ACTION_LABELS: Record<string, string> = {
  'agreement.sent_for_signature': 'enviado',
  'agreement.signed': 'assinado',
  'agreement.rejected': 'rejeitado',
  'agreement.expired': 'expirado',
  'agreement.template.created': 'modelo_criado',
  'agreement.template.updated': 'modelo_atualizado',
  'agreement.template.version_published': 'versao_publicada',
  'agreement.auto_dispatch_triggered': 'envio_automatico',
};

// ── Persistence ──

async function persistAuditLog(entry: AuditEntry): Promise<void> {
  const { error } = await supabase
    .from('audit_logs')
    .insert([entry as any]);

  if (error) {
    console.error('[AgreementAudit] Failed to persist audit log:', error.message);
  }
}

function mapEventToAudit(event: AgreementDomainEvent): AuditEntry {
  return {
    tenant_id: event.tenant_id,
    entity_type: ENTITY_TYPE,
    entity_id: event.agreement_id ?? event.template_id ?? null,
    action: event.type,
    new_value: event.payload,
    company_id: event.company_id ?? null,
    metadata: {
      employee_id: event.employee_id,
      provider: event.payload?.provider ?? null,
      ip_address: event.payload?.ip_address ?? null,
      timestamp: event.timestamp,
      acao: ACTION_LABELS[event.type] ?? event.type,
    },
  };
}

// ── Row → AgreementAuditLog mapper ──

function toAuditLog(row: any): AgreementAuditLog {
  const meta = row.metadata ?? {};
  const payload = row.new_value ?? {};
  return {
    id: row.id,
    agreement_id: row.entity_id,
    employee_id: meta.employee_id ?? payload.employee_id ?? null,
    acao: meta.acao ?? ACTION_LABELS[row.action] ?? row.action,
    provider: meta.provider ?? payload.provider ?? null,
    timestamp: meta.timestamp ?? row.created_at,
    ip_address: meta.ip_address ?? payload.ip_address ?? null,
    tenant_id: row.tenant_id,
    company_id: row.company_id,
    raw_payload: payload,
  };
}

// ── Auto-register listeners ──

const AUDITABLE_EVENTS: AgreementDomainEvent['type'][] = [
  'agreement.template.created',
  'agreement.template.updated',
  'agreement.template.version_published',
  'agreement.sent_for_signature',
  'agreement.signed',
  'agreement.rejected',
  'agreement.expired',
  'agreement.auto_dispatch_triggered',
];

let initialized = false;

/**
 * Initialize audit listeners.
 * Safe to call multiple times — only registers once.
 */
export function initAgreementAudit(): void {
  if (initialized) return;

  for (const eventType of AUDITABLE_EVENTS) {
    onAgreementEvent(eventType, (event) => {
      persistAuditLog(mapEventToAudit(event));
    });
  }

  initialized = true;
}

export const agreementAuditService = {
  init: initAgreementAudit,

  /**
   * Query audit trail for a specific agreement.
   * Returns AgreementAuditLog[] with agreement_id, employee_id, ação, provider, timestamp, ip_address.
   */
  async getAuditTrail(agreementId: string, tenantId: string): Promise<AgreementAuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', ENTITY_TYPE)
      .eq('entity_id', agreementId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(toAuditLog);
  },

  /**
   * Query all agreement audit events for a tenant.
   */
  async getRecentActivity(tenantId: string, limit = 50): Promise<AgreementAuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', ENTITY_TYPE)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(toAuditLog);
  },

  /**
   * Query audit trail for a specific employee across all agreements.
   */
  async getByEmployee(employeeId: string, tenantId: string): Promise<AgreementAuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', ENTITY_TYPE)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    // Filter by employee_id stored in metadata
    return (data || [])
      .map(toAuditLog)
      .filter(log => log.employee_id === employeeId);
  },
};
