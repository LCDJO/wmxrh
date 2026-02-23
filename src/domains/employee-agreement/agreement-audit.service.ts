/**
 * AgreementAuditService
 *
 * Maintains an immutable, append-only legal audit trail for all
 * agreement lifecycle events. Persists to audit_logs table.
 *
 * AgreementAuditLog shape:
 *   - employee_id
 *   - agreement_template_id
 *   - versao
 *   - ação (criado | enviado | assinado | expirado | revogado | rejeitado | renovado)
 *   - user_id
 *   - timestamp
 *   - ip_address
 */

import { supabase } from '@/integrations/supabase/client';
import { onAgreementEvent, type AgreementDomainEvent, type AgreementEventType } from './events';

const ENTITY_TYPE = 'employee_agreement';

// ── Public read-model ──

export interface AgreementAuditLog {
  id: string;
  agreement_id: string | null;
  employee_id: string | null;
  agreement_template_id: string | null;
  versao: number | null;
  acao: string;
  user_id: string | null;
  provider: string | null;
  timestamp: string;
  ip_address: string | null;
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
  user_id?: string | null;
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
  'agreement.renewal_required': 'renovado',
  'agreement.template.created': 'modelo_criado',
  'agreement.template.updated': 'modelo_atualizado',
  'agreement.template.version_published': 'versao_publicada',
  'agreement.auto_dispatch_triggered': 'envio_automatico',
  'agreement.governance.dispatch_triggered': 'governance_dispatch',
  'agreement.governance.compliance_gate_checked': 'compliance_gate_verificado',
  'agreement.governance.compliance_blocked': 'compliance_bloqueado',
  'agreement.governance.all_mandatory_signed': 'todos_assinados',
  'agreement.integration.epi_term_dispatched': 'termo_epi_disparado',
  'agreement.integration.fleet_term_dispatched': 'termo_frota_disparado',
  'agreement.integration.nr_training_term_dispatched': 'termo_nr_disparado',
  'agreement.integration.career_term_dispatched': 'termo_cargo_disparado',
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
    user_id: (event.payload?.user_id as string) ?? null,
    new_value: event.payload,
    company_id: event.company_id ?? null,
    metadata: {
      employee_id: event.employee_id,
      agreement_template_id: event.template_id ?? event.payload?.template_id ?? null,
      versao: event.payload?.versao ?? null,
      user_id: event.payload?.user_id ?? null,
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
    agreement_template_id: meta.agreement_template_id ?? payload.template_id ?? null,
    versao: meta.versao ?? payload.versao ?? null,
    acao: meta.acao ?? ACTION_LABELS[row.action] ?? row.action,
    user_id: meta.user_id ?? row.user_id ?? null,
    provider: meta.provider ?? payload.provider ?? null,
    timestamp: meta.timestamp ?? row.created_at,
    ip_address: meta.ip_address ?? payload.ip_address ?? null,
    tenant_id: row.tenant_id,
    company_id: row.company_id,
    raw_payload: payload,
  };
}

// ── Auto-register listeners ──

const AUDITABLE_EVENTS: AgreementEventType[] = [
  'agreement.template.created',
  'agreement.template.updated',
  'agreement.template.version_published',
  'agreement.sent_for_signature',
  'agreement.signed',
  'agreement.rejected',
  'agreement.expired',
  'agreement.renewal_required',
  'agreement.auto_dispatch_triggered',
  'agreement.governance.dispatch_triggered',
  'agreement.governance.compliance_gate_checked',
  'agreement.governance.compliance_blocked',
  'agreement.governance.all_mandatory_signed',
  'agreement.integration.epi_term_dispatched',
  'agreement.integration.fleet_term_dispatched',
  'agreement.integration.nr_training_term_dispatched',
  'agreement.integration.career_term_dispatched',
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

/**
 * Manually record an audit entry (for actions not triggered via domain events).
 * Use for: 'criado', 'revogado', or custom actions.
 */
export async function recordAgreementAudit(params: {
  tenant_id: string;
  agreement_id: string;
  employee_id: string;
  template_id?: string | null;
  versao?: number | null;
  acao: 'criado' | 'enviado' | 'assinado' | 'expirado' | 'revogado' | 'rejeitado' | 'renovado' | string;
  user_id?: string | null;
  ip_address?: string | null;
  company_id?: string | null;
  extra?: Record<string, unknown>;
}): Promise<void> {
  await persistAuditLog({
    tenant_id: params.tenant_id,
    entity_type: ENTITY_TYPE,
    entity_id: params.agreement_id,
    action: `agreement.${params.acao}`,
    user_id: params.user_id ?? null,
    new_value: params.extra ?? null,
    company_id: params.company_id ?? null,
    metadata: {
      employee_id: params.employee_id,
      agreement_template_id: params.template_id ?? null,
      versao: params.versao ?? null,
      user_id: params.user_id ?? null,
      ip_address: params.ip_address ?? null,
      acao: params.acao,
      timestamp: new Date().toISOString(),
    },
  });
}

export const agreementAuditService = {
  init: initAgreementAudit,

  /**
   * Query audit trail for a specific agreement.
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
    return (data || [])
      .map(toAuditLog)
      .filter(log => log.employee_id === employeeId);
  },

  /**
   * Query audit trail by template across all employees.
   */
  async getByTemplate(templateId: string, tenantId: string): Promise<AgreementAuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', ENTITY_TYPE)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;
    return (data || [])
      .map(toAuditLog)
      .filter(log => log.agreement_template_id === templateId);
  },
};
