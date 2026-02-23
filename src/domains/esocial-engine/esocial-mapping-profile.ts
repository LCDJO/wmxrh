/**
 * eSocial Mapping Profile
 *
 * Automatically determines which eSocial events should be generated
 * from an EmployeeMasterRecord based on contract type, status, and category.
 *
 * Bridge between Employee Master Record bounded context and eSocial Engine.
 */

import type { EmployeeMasterRecord, EmployeeContract, ContractType } from '../employee-master-record/types';
import type { InboundDomainEvent } from './types';

// ── Mapping rules ──

export type ESocialEventMapping = {
  event_type: string;
  event_name: string;
  applicable: boolean;
  reason: string;
};

/** Contract types that use S-2200 (vínculo empregatício) */
const CLT_TYPES: ContractType[] = [
  'clt_indeterminado',
  'clt_determinado',
  'clt_intermitente',
  'clt_temporario',
  'clt_aprendiz',
];

/** Contract types that use S-2300 (trabalhador sem vínculo) */
const TSV_TYPES: ContractType[] = ['estagio', 'autonomo'];

export interface ESocialMappingProfileResult {
  employee_id: string;
  admission_event: ESocialEventMapping;
  termination_event: ESocialEventMapping;
  remuneration_event: ESocialEventMapping;
  all_mappings: ESocialEventMapping[];
}

export const esocialMappingProfile = {
  /**
   * Analyze an EmployeeMasterRecord and determine which eSocial events apply.
   */
  analyze(record: EmployeeMasterRecord): ESocialMappingProfileResult {
    const currentContract = record.contracts
      .filter((c) => !c.deleted_at && c.is_current)
      .sort((a, b) => b.admission_date.localeCompare(a.admission_date))[0] ?? null;

    const contractType = currentContract?.contract_type;
    const isCLT = contractType ? CLT_TYPES.includes(contractType) : false;
    const isTSV = contractType ? TSV_TYPES.includes(contractType) : false;
    const isTerminated = record.record?.status === 'desligado';

    // Admission event
    const admission_event: ESocialEventMapping = isCLT
      ? { event_type: 'S-2200', event_name: 'Admissão', applicable: true, reason: `Contrato CLT (${contractType})` }
      : isTSV
        ? { event_type: 'S-2300', event_name: 'Trabalhador Sem Vínculo', applicable: true, reason: `Tipo ${contractType}` }
        : { event_type: 'S-2200', event_name: 'Admissão', applicable: false, reason: 'Tipo de contrato não identificado' };

    // Termination event
    const termination_event: ESocialEventMapping = isTerminated
      ? { event_type: 'S-2299', event_name: 'Desligamento', applicable: true, reason: 'Colaborador desligado' }
      : { event_type: 'S-2299', event_name: 'Desligamento', applicable: false, reason: 'Colaborador ativo' };

    // Remuneration
    const remuneration_event: ESocialEventMapping = isCLT || isTSV
      ? { event_type: 'S-1200', event_name: 'Remuneração', applicable: true, reason: 'Evento periódico mensal' }
      : { event_type: 'S-1200', event_name: 'Remuneração', applicable: false, reason: 'Sem contrato ativo' };

    const all_mappings = [admission_event, termination_event, remuneration_event];

    return {
      employee_id: record.employee_id,
      admission_event,
      termination_event,
      remuneration_event,
      all_mappings,
    };
  },

  /**
   * Generate inbound domain events from an EmployeeMasterRecord.
   * Used to trigger eSocial envelope generation.
   */
  toDomainEvents(
    record: EmployeeMasterRecord,
    tenantId: string,
    companyId: string | null,
  ): InboundDomainEvent[] {
    const profile = this.analyze(record);
    const events: InboundDomainEvent[] = [];

    const currentContract = record.contracts
      .filter((c) => !c.deleted_at && c.is_current)[0] ?? null;
    const personalData = record.personalData;

    if (!personalData || !currentContract) return events;

    // Admission
    if (profile.admission_event.applicable) {
      const isCLT = profile.admission_event.event_type === 'S-2200';
      events.push({
        event_name: isCLT ? 'employee.hired' : 'employee.tsv_started',
        tenant_id: tenantId,
        company_id: companyId,
        entity_type: 'employee',
        entity_id: record.employee_id,
        payload: {
          name: personalData.nome_completo,
          cpf: personalData.cpf,
          hire_date: currentContract.admission_date,
          start_date: currentContract.admission_date,
          base_salary: currentContract.salario_base || 0,
          position_title: currentContract.job_function || 'Não informado',
          company_document: '', // filled by caller
          company_name: '',
          cbo_code: currentContract.cbo_code,
          esocial_category: currentContract.esocial_category,
          contract_end_date: currentContract.contract_end_date,
        },
        occurred_at: new Date().toISOString(),
      });
    }

    // Termination
    if (profile.termination_event.applicable && record.record?.data_desligamento) {
      events.push({
        event_name: 'employee.terminated',
        tenant_id: tenantId,
        company_id: companyId,
        entity_type: 'employee',
        entity_id: record.employee_id,
        payload: {
          cpf: personalData.cpf,
          company_document: '',
          matricula: record.record?.matricula_interna || record.employee_id,
          termination_date: record.record.data_desligamento,
          last_effective_date: record.record.data_desligamento,
          termination_reason_code: '02',
        },
        occurred_at: new Date().toISOString(),
      });
    }

    return events;
  },
};
