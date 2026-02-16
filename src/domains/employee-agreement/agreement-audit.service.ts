/**
 * AgreementAuditService
 *
 * Maintains a legal audit trail for all agreement lifecycle events.
 * Persists to the existing audit_logs table for unified compliance.
 *
 * Listens to domain events and automatically logs them.
 */

import { supabase } from '@/integrations/supabase/client';
import { onAgreementEvent, type AgreementDomainEvent } from './events';

const ENTITY_TYPE = 'employee_agreement';

interface AuditEntry {
  tenant_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  new_value: Record<string, unknown> | null;
  company_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

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
      timestamp: event.timestamp,
    },
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
   */
  async getAuditTrail(agreementId: string, tenantId: string) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', ENTITY_TYPE)
      .eq('entity_id', agreementId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Query all agreement audit events for a tenant.
   */
  async getRecentActivity(tenantId: string, limit = 50) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', ENTITY_TYPE)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};
