/**
 * Offboarding Archive Engine — Etapa 6
 *
 * Archives the complete employee profile upon offboarding completion.
 *
 * Flow:
 *   1. Load full EmployeeMasterRecord (ficha + satélites)
 *   2. Load domain-specific histories (disciplinary, agreements, SST, financial, benefits)
 *   3. Build ArchivedEmployeeProfile snapshot
 *   4. Compute SHA-256 integrity hash
 *   5. Persist to archived_employee_profiles
 *   6. Update employee_records.status → 'desligado'
 *   7. Update offboarding_workflows with archive metadata
 *   8. Audit log
 *
 * ╔════════════════════════════════════════════════════════════╗
 * ║  LGPD: Hard deletes are BLOCKED by DB trigger.           ║
 * ║  Only anonymization is allowed after retention expiry.    ║
 * ╚════════════════════════════════════════════════════════════╝
 */

import { supabase } from '@/integrations/supabase/client';
import { employeeMasterRecordService } from '@/domains/employee-master-record/employee-master-record.service';
import { generateDocumentHash } from '@/domains/employee-agreement/document-hash';
import type { OffboardingWorkflow } from './types';
import type { RescissionResult } from './rescission-calculator.engine';

// ── Types ──

export interface ArchivedEmployeeProfile {
  id: string;
  tenant_id: string;
  employee_id: string;
  workflow_id: string | null;
  employee_snapshot: Record<string, unknown>;
  contracts_snapshot: Record<string, unknown>[];
  documents_snapshot: Record<string, unknown>[];
  addresses_snapshot: Record<string, unknown>[];
  dependents_snapshot: Record<string, unknown>[];
  disciplinary_snapshot: Record<string, unknown>[];
  agreements_snapshot: Record<string, unknown>[];
  sst_snapshot: Record<string, unknown>[];
  financial_snapshot: Record<string, unknown>;
  benefits_snapshot: Record<string, unknown>[];
  rescission_result: RescissionResult | null;
  offboarding_type: string;
  data_desligamento: string;
  archived_at: string;
  archived_by: string | null;
  archive_reason: string;
  anonymized_at: string | null;
  is_anonymized: boolean;
  snapshot_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArchiveResult {
  success: boolean;
  archive_id?: string;
  snapshot_hash?: string;
  error?: string;
}

// ── Helpers: Load domain histories ──

async function loadDisciplinaryHistory(employeeId: string, tenantId: string): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from('fleet_disciplinary_history')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId);
  return (data || []) as Record<string, unknown>[];
}

async function loadAgreementsHistory(employeeId: string, tenantId: string): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from('employee_agreements')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId);
  return (data || []) as Record<string, unknown>[];
}

async function loadSSTHistory(_employeeId: string, _tenantId: string): Promise<Record<string, unknown>[]> {
  // SST data snapshot — extend with PCMSO, risk assessments, EPIs as tables evolve
  return [];
}

async function loadFinancialHistory(employeeId: string, tenantId: string): Promise<Record<string, unknown>> {
  const [salaryRes, benefitsRes] = await Promise.all([
    supabase
      .from('salary_history')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .order('effective_date', { ascending: false }),
    supabase
      .from('employee_benefits')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId),
  ]);

  return {
    salary_history: salaryRes.data || [],
    benefits: benefitsRes.data || [],
  };
}

async function loadBenefitsSnapshot(employeeId: string, tenantId: string): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from('employee_benefits')
    .select('*, benefit_plan:benefit_plans(name, benefit_type)')
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId);
  return (data || []) as Record<string, unknown>[];
}

// ── Main Archive Function ──

/**
 * Archive an employee's complete profile upon offboarding completion.
 *
 * This function:
 *   1. Snapshots ALL employee data (master record + domain histories)
 *   2. Computes SHA-256 hash for integrity verification
 *   3. Persists the immutable archive
 *   4. Updates employee status to 'desligado'
 *   5. Marks the workflow as archived
 */
export async function archiveEmployeeProfile(
  workflow: OffboardingWorkflow,
  rescission: RescissionResult | null,
  archivedBy?: string,
): Promise<ArchiveResult> {
  const { tenant_id, employee_id } = workflow;

  try {
    // 1. Load full master record
    const masterRecord = await employeeMasterRecordService.loadFullRecord(employee_id, tenant_id);

    // 2. Load domain-specific histories in parallel
    const [disciplinary, agreements, sst, financial, benefits] = await Promise.all([
      loadDisciplinaryHistory(employee_id, tenant_id),
      loadAgreementsHistory(employee_id, tenant_id),
      loadSSTHistory(employee_id, tenant_id),
      loadFinancialHistory(employee_id, tenant_id),
      loadBenefitsSnapshot(employee_id, tenant_id),
    ]);

    // 3. Build the snapshot object
    const employeeSnapshot: Record<string, unknown> = {
      record: masterRecord.record,
      personalData: masterRecord.personalData,
      employee_id: masterRecord.employee_id,
      workflow_summary: {
        id: workflow.id,
        offboarding_type: workflow.offboarding_type,
        status: workflow.status,
        data_desligamento: workflow.data_desligamento,
        data_aviso_previo: workflow.data_aviso_previo,
        aviso_previo_type: workflow.aviso_previo_type,
        aviso_previo_days: workflow.aviso_previo_days,
        motivo: workflow.motivo,
        justa_causa_motivo: workflow.justa_causa_motivo,
        justa_causa_artigo: workflow.justa_causa_artigo,
        esocial_status: workflow.esocial_status,
        esocial_protocol: workflow.esocial_protocol,
      },
    };

    // 4. Compute integrity hash
    const fullPayload = JSON.stringify({
      employee: employeeSnapshot,
      contracts: masterRecord.contracts,
      documents: masterRecord.documents,
      addresses: masterRecord.addresses,
      dependents: masterRecord.dependents,
      disciplinary,
      agreements,
      sst,
      financial,
      benefits,
      rescission,
    });
    const snapshotHash = await generateDocumentHash(fullPayload);

    // 5. Persist archive
    const { data: archive, error: archiveErr } = await supabase
      .from('archived_employee_profiles')
      .insert({
        tenant_id,
        employee_id,
        workflow_id: workflow.id,
        employee_snapshot: employeeSnapshot,
        contracts_snapshot: masterRecord.contracts as any,
        documents_snapshot: masterRecord.documents as any,
        addresses_snapshot: masterRecord.addresses as any,
        dependents_snapshot: masterRecord.dependents as any,
        disciplinary_snapshot: disciplinary as any,
        agreements_snapshot: agreements as any,
        sst_snapshot: sst as any,
        financial_snapshot: financial as any,
        benefits_snapshot: benefits as any,
        rescission_result: rescission as any,
        offboarding_type: workflow.offboarding_type,
        data_desligamento: workflow.data_desligamento,
        archived_by: archivedBy || null,
        snapshot_hash: snapshotHash,
      } as any)
      .select('id')
      .single();

    if (archiveErr) {
      return { success: false, error: `Falha ao persistir arquivo: ${archiveErr.message}` };
    }

    const archiveId = (archive as any).id;

    // 6. Update employee_records.status → 'desligado'
    if (masterRecord.record?.id) {
      await supabase
        .from('employee_records')
        .update({
          status: 'desligado',
          data_desligamento: workflow.data_desligamento,
        } as any)
        .eq('id', masterRecord.record.id)
        .eq('tenant_id', tenant_id);
    }

    // Also update employees table status
    await supabase
      .from('employees')
      .update({ status: 'inactive' } as any)
      .eq('id', employee_id)
      .eq('tenant_id', tenant_id);

    // 7. Update workflow with archive metadata
    await supabase
      .from('offboarding_workflows')
      .update({
        status: 'completed',
        archived_at: new Date().toISOString(),
        archived_by: archivedBy || null,
        archive_snapshot: { archive_id: archiveId, snapshot_hash: snapshotHash } as any,
      } as any)
      .eq('id', workflow.id)
      .eq('tenant_id', tenant_id);

    // 8. Close current contract
    const currentContract = masterRecord.contracts.find(c => c.is_current);
    if (currentContract) {
      await supabase
        .from('employee_contracts')
        .update({
          is_current: false,
          ended_at: workflow.data_desligamento,
          end_reason: workflow.offboarding_type,
        } as any)
        .eq('id', currentContract.id)
        .eq('tenant_id', tenant_id);
    }

    // 9. Audit log
    await supabase.from('offboarding_audit_log').insert({
      tenant_id,
      workflow_id: workflow.id,
      action: 'employee_archived',
      new_value: {
        archive_id: archiveId,
        snapshot_hash: snapshotHash,
        employee_status: 'desligado',
        contract_closed: !!currentContract,
      } as any,
    } as any);

    return {
      success: true,
      archive_id: archiveId,
      snapshot_hash: snapshotHash,
    };
  } catch (err) {
    return {
      success: false,
      error: `Erro ao arquivar perfil: ${String(err)}`,
    };
  }
}

/**
 * Retrieve an archived employee profile.
 */
export async function getArchivedProfile(
  employeeId: string,
  tenantId: string,
): Promise<ArchivedEmployeeProfile | null> {
  const { data, error } = await supabase
    .from('archived_employee_profiles')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId)
    .order('archived_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as ArchivedEmployeeProfile | null;
}

/**
 * Verify the integrity of an archived profile by recomputing its hash.
 */
export async function verifyArchiveIntegrity(
  archiveId: string,
  tenantId: string,
): Promise<{ valid: boolean; stored_hash: string | null; computed_hash: string }> {
  const { data, error } = await supabase
    .from('archived_employee_profiles')
    .select('*')
    .eq('id', archiveId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) throw error || new Error('Archive not found');

  const row = data as any;
  const payload = JSON.stringify({
    employee: row.employee_snapshot,
    contracts: row.contracts_snapshot,
    documents: row.documents_snapshot,
    addresses: row.addresses_snapshot,
    dependents: row.dependents_snapshot,
    disciplinary: row.disciplinary_snapshot,
    agreements: row.agreements_snapshot,
    sst: row.sst_snapshot,
    financial: row.financial_snapshot,
    benefits: row.benefits_snapshot,
    rescission: row.rescission_result,
  });

  const computedHash = await generateDocumentHash(payload);

  return {
    valid: computedHash === row.snapshot_hash,
    stored_hash: row.snapshot_hash,
    computed_hash: computedHash,
  };
}
