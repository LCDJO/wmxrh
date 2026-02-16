/**
 * eSocial Event Generator
 *
 * Listens to inbound domain events from HR Core, Compensation, Health
 * and automatically generates eSocial envelopes using layout mappers.
 *
 * This is the "bridge" between internal events and government obligations.
 * Pure function — returns envelopes without persisting.
 */

// No external UUID dependency — uses crypto.randomUUID()
import type { InboundDomainEvent, ESocialEnvelope, ESocialCategory } from './types';
import { CURRENT_LAYOUT_VERSION, EVENT_TYPE_REGISTRY } from './types';
import { getMapper, hasMapper } from './layout-mappers';
import type { S2200Input } from './layout-mappers/s2200-admissao.mapper';
import type { S2206Input } from './layout-mappers/s2206-alt-contratual.mapper';
import type { S2220Input } from './layout-mappers/s2220-aso.mapper';

function generateId(): string {
  return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Route an inbound domain event to the correct eSocial event type
 * and generate the envelope.
 */
export function generateFromDomainEvent(event: InboundDomainEvent): ESocialEnvelope | null {
  switch (event.event_name) {
    case 'employee.hired':
      return generateAdmissao(event);
    case 'salary.adjusted':
    case 'salary.contract_started':
      return generateAlteracaoContratual(event);
    case 'health_exam.created':
      return generateASO(event);
    default:
      // Event type not mapped yet — no envelope generated
      return null;
  }
}

/**
 * Generate multiple envelopes for batch processing.
 */
export function generateBatch(events: InboundDomainEvent[]): ESocialEnvelope[] {
  return events
    .map(e => generateFromDomainEvent(e))
    .filter((e): e is ESocialEnvelope => e !== null);
}

// ── Private generators ──

function generateAdmissao(event: InboundDomainEvent): ESocialEnvelope | null {
  const mapper = getMapper('S-2200');
  if (!mapper) return null;

  const p = event.payload as Record<string, unknown>;
  const input = {
    employee_id: event.entity_id,
    name: (p.name as string) || '',
    cpf: (p.cpf as string) || '',
    hire_date: (p.hire_date as string) || '',
    base_salary: (p.base_salary as number) || 0,
    position_title: (p.position_title as string) || 'Não informado',
    company_document: (p.company_document as string) || '',
    company_name: (p.company_name as string) || '',
    department_name: p.department_name as string | undefined,
    cbo_code: p.cbo_code as string | undefined,
  };

  const payload = mapper.map(input as any);

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-2200',
    category: 'nao_periodicos',
    payload,
    source_entity_type: event.entity_type,
    source_entity_id: event.entity_id,
  });
}

function generateAlteracaoContratual(event: InboundDomainEvent): ESocialEnvelope | null {
  const mapper = getMapper('S-2206');
  if (!mapper) return null;

  const p = event.payload as Record<string, unknown>;
  const input = {
    employee_id: event.entity_id,
    cpf: (p.cpf as string) || '',
    company_document: (p.company_document as string) || '',
    effective_date: (p.effective_date as string) || event.occurred_at.slice(0, 10),
    new_salary: (p.new_salary as number) || 0,
    position_title: (p.position_title as string) || 'Não informado',
    cbo_code: p.cbo_code as string | undefined,
    reason: p.reason as string | undefined,
  };

  const payload = mapper.map(input as any);

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-2206',
    category: 'nao_periodicos',
    payload,
    source_entity_type: event.entity_type,
    source_entity_id: event.entity_id,
  });
}

function generateASO(event: InboundDomainEvent): ESocialEnvelope | null {
  const mapper = getMapper('S-2220');
  if (!mapper) return null;

  const p = event.payload as Record<string, unknown>;
  const input = {
    employee_id: (p.employee_id as string) || event.entity_id,
    cpf: (p.cpf as string) || '',
    company_document: (p.company_document as string) || '',
    exam_date: (p.exam_date as string) || '',
    exam_type: (p.exam_type as S2220Input['exam_type']) || 'periodico',
    result: (p.result as S2220Input['result']) || 'apto',
    physician_name: (p.physician_name as string) || '',
    physician_crm: (p.physician_crm as string) || '',
    next_exam_date: p.next_exam_date as string | undefined,
    cbo_code: p.cbo_code as string | undefined,
  };

  const payload = mapper.map(input as any);

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-2220',
    category: 'sst',
    payload,
    source_entity_type: event.entity_type,
    source_entity_id: event.entity_id,
  });
}

function createEnvelope(params: {
  tenant_id: string;
  company_id: string | null;
  event_type: string;
  category: ESocialCategory;
  payload: Record<string, unknown>;
  source_entity_type: string;
  source_entity_id: string;
}): ESocialEnvelope {
  return {
    id: generateId(),
    tenant_id: params.tenant_id,
    company_id: params.company_id,
    event_type: params.event_type,
    category: params.category,
    layout_version: CURRENT_LAYOUT_VERSION,
    payload: params.payload,
    source_entity_type: params.source_entity_type,
    source_entity_id: params.source_entity_id,
    status: 'draft',
    receipt_number: null,
    error_message: null,
    error_code: null,
    retry_count: 0,
    response_payload: null,
    validated_at: null,
    queued_at: null,
    transmitted_at: null,
    accepted_at: null,
    created_at: new Date().toISOString(),
  };
}
