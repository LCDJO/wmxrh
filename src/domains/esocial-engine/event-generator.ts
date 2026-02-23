/**
 * eSocial Event Generator
 *
 * Listens to inbound domain events from HR Core, Compensation, Health
 * and automatically generates eSocial envelopes using layout mappers.
 *
 * This is the "bridge" between internal events and government obligations.
 * Pure function — returns envelopes without persisting.
 */

import type { InboundDomainEvent, ESocialEnvelope, ESocialCategory } from './types';
import { CURRENT_LAYOUT_VERSION } from './types';
import { getMapper } from './layout-mappers';
import type { S2200Input } from './layout-mappers/s2200-admissao.mapper';
import type { S2206Input } from './layout-mappers/s2206-alt-contratual.mapper';
import type { S2220Input } from './layout-mappers/s2220-aso.mapper';
import type { S1000Input } from './layout-mappers/s1000-empregador.mapper';
import type { S1010Input } from './layout-mappers/s1010-rubrica.mapper';
import type { S2240Input } from './layout-mappers/s2240-exp-risco.mapper';
import type { S2299Input } from './layout-mappers/s2299-desligamento.mapper';
import type { S2300Input } from './layout-mappers/s2300-tsv.mapper';
import type { S1200Input } from './layout-mappers/s1200-remuneracao.mapper';

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
    case 'employee.terminated':
      return generateDesligamento(event);
    case 'employee.tsv_started':
      return generateTSV(event);
    case 'salary.adjusted':
    case 'salary.contract_started':
      return generateAlteracaoContratual(event);
    case 'salary.remuneration_closed':
      return generateRemuneracao(event);
    case 'health_exam.created':
      return generateASO(event);
    case 'company.created':
      return generateInfoEmpregador(event);
    case 'rubric.created':
      return generateTabRubrica(event);
    case 'risk_exposure.created':
      return generateExpRisco(event);
    default:
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
  const input: S2200Input = {
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

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-2200',
    category: 'nao_periodicos',
    payload: mapper.map(input as any),
    source_entity_type: event.entity_type,
    source_entity_id: event.entity_id,
  });
}

function generateAlteracaoContratual(event: InboundDomainEvent): ESocialEnvelope | null {
  const mapper = getMapper('S-2206');
  if (!mapper) return null;

  const p = event.payload as Record<string, unknown>;
  const input: S2206Input = {
    employee_id: event.entity_id,
    cpf: (p.cpf as string) || '',
    company_document: (p.company_document as string) || '',
    effective_date: (p.effective_date as string) || event.occurred_at.slice(0, 10),
    new_salary: (p.new_salary as number) || 0,
    position_title: (p.position_title as string) || 'Não informado',
    cbo_code: p.cbo_code as string | undefined,
    reason: p.reason as string | undefined,
  };

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-2206',
    category: 'nao_periodicos',
    payload: mapper.map(input as any),
    source_entity_type: event.entity_type,
    source_entity_id: event.entity_id,
  });
}

function generateASO(event: InboundDomainEvent): ESocialEnvelope | null {
  const mapper = getMapper('S-2220');
  if (!mapper) return null;

  const p = event.payload as Record<string, unknown>;
  const input: S2220Input = {
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

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-2220',
    category: 'sst',
    payload: mapper.map(input as any),
    source_entity_type: event.entity_type,
    source_entity_id: event.entity_id,
  });
}

function generateInfoEmpregador(event: InboundDomainEvent): ESocialEnvelope | null {
  const mapper = getMapper('S-1000');
  if (!mapper) return null;

  const p = event.payload as Record<string, unknown>;
  const input: S1000Input = {
    company_id: event.entity_id,
    company_name: (p.name as string) || '',
    company_document: (p.document as string) || '',
    email: p.email as string | undefined,
    phone: p.phone as string | undefined,
    address: p.address as string | undefined,
  };

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-1000',
    category: 'tabelas',
    payload: mapper.map(input as any),
    source_entity_type: event.entity_type,
    source_entity_id: event.entity_id,
  });
}

function generateTabRubrica(event: InboundDomainEvent): ESocialEnvelope | null {
  const mapper = getMapper('S-1010');
  if (!mapper) return null;

  const p = event.payload as Record<string, unknown>;
  const input: S1010Input = {
    rubric_id: event.entity_id,
    company_document: (p.company_document as string) || '',
    code: (p.code as string) || '',
    name: (p.name as string) || '',
    nature_code: (p.nature_code as string) || '1000',
    type: (p.type as 1 | 2 | 3) || 1,
    irrf_incidence: p.irrf_incidence as number | undefined,
    cp_incidence: p.cp_incidence as number | undefined,
    fgts_incidence: p.fgts_incidence as number | undefined,
    description: p.description as string | undefined,
  };

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-1010',
    category: 'tabelas',
    payload: mapper.map(input as any),
    source_entity_type: event.entity_type,
    source_entity_id: event.entity_id,
  });
}

function generateExpRisco(event: InboundDomainEvent): ESocialEnvelope | null {
  const mapper = getMapper('S-2240');
  if (!mapper) return null;

  const p = event.payload as Record<string, unknown>;
  const input: S2240Input = {
    employee_id: (p.employee_id as string) || event.entity_id,
    cpf: (p.cpf as string) || '',
    company_document: (p.company_document as string) || '',
    start_date: (p.start_date as string) || event.occurred_at.slice(0, 10),
    risk_agent_code: (p.risk_agent_code as string) || '',
    risk_agent_description: p.risk_agent_description as string | undefined,
    intensity: p.intensity as string | undefined,
    epi_efficacy: p.epi_efficacy as 0 | 1 | 2 | undefined,
    epi_description: p.epi_description as string | undefined,
    epi_ca_number: p.epi_ca_number as string | undefined,
    activity_description: p.activity_description as string | undefined,
    cbo_code: p.cbo_code as string | undefined,
  };

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-2240',
    category: 'sst',
    payload: mapper.map(input as any),
    source_entity_type: event.entity_type,
    source_entity_id: event.entity_id,
  });
}

function generateDesligamento(event: InboundDomainEvent): ESocialEnvelope | null {
  const mapper = getMapper('S-2299');
  if (!mapper) return null;

  const p = event.payload as Record<string, unknown>;
  const input: S2299Input = {
    employee_id: event.entity_id,
    cpf: (p.cpf as string) || '',
    company_document: (p.company_document as string) || '',
    matricula: (p.matricula as string) || event.entity_id.substring(0, 30),
    termination_date: (p.termination_date as string) || event.occurred_at.slice(0, 10),
    termination_reason_code: (p.termination_reason_code as string) || '02',
    last_effective_date: (p.last_effective_date as string) || (p.termination_date as string) || event.occurred_at.slice(0, 10),
    notice_type: p.notice_type as S2299Input['notice_type'],
    notice_start_date: p.notice_start_date as string | undefined,
  };

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-2299',
    category: 'nao_periodicos',
    payload: mapper.map(input as any),
    source_entity_type: event.entity_type,
    source_entity_id: event.entity_id,
  });
}

function generateTSV(event: InboundDomainEvent): ESocialEnvelope | null {
  const mapper = getMapper('S-2300');
  if (!mapper) return null;

  const p = event.payload as Record<string, unknown>;
  const input: S2300Input = {
    employee_id: event.entity_id,
    name: (p.name as string) || '',
    cpf: (p.cpf as string) || '',
    start_date: (p.start_date as string) || event.occurred_at.slice(0, 10),
    company_document: (p.company_document as string) || '',
    company_name: (p.company_name as string) || '',
    category: (p.esocial_category as string) || '301',
    position_title: p.position_title as string | undefined,
    cbo_code: p.cbo_code as string | undefined,
    remuneration: p.remuneration as number | undefined,
    internship_institution: p.internship_institution as string | undefined,
    contract_end_date: p.contract_end_date as string | undefined,
  };

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-2300',
    category: 'nao_periodicos',
    payload: mapper.map(input as any),
    source_entity_type: event.entity_type,
    source_entity_id: event.entity_id,
  });
}

function generateRemuneracao(event: InboundDomainEvent): ESocialEnvelope | null {
  const mapper = getMapper('S-1200');
  if (!mapper) return null;

  const p = event.payload as Record<string, unknown>;
  const input: S1200Input = {
    employee_id: event.entity_id,
    cpf: (p.cpf as string) || '',
    matricula: (p.matricula as string) || event.entity_id.substring(0, 30),
    company_document: (p.company_document as string) || '',
    competencia: (p.competencia as string) || '',
    items: (p.items as S1200Input['items']) || [],
    ind_apuracao: p.ind_apuracao as number | undefined,
  };

  return createEnvelope({
    tenant_id: event.tenant_id,
    company_id: event.company_id,
    event_type: 'S-1200',
    category: 'periodicos',
    payload: mapper.map(input as any),
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
