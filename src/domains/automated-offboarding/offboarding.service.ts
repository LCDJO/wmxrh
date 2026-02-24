/**
 * Automated Offboarding — Workflow Service
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  OffboardingWorkflow,
  OffboardingChecklistItem,
  OffboardingReferenceLetter,
  CreateOffboardingDTO,
  OffboardingStatus,
  ChecklistItemStatus,
} from './types';
import { getChecklistTemplatesByType } from './checklist-templates';
import { validateOffboardingPendencies, pendenciesToChecklistItems } from './pendency-validation.engine';
import {
  calculateRescission,
  calculateAvisoPrevioDays,
  calculateProportionalMonths,
  type RescissionInput,
  type RescissionResult,
} from './rescission-calculator.engine';
import { generateTermoRescisaoHtml, type TermoRescisaoData } from './rescission-document.generator';
import {
  generateAllOffboardingDocuments,
  generateTrctHtml,
  generateTermoQuitacaoHtml,
  generateCartaDemissaoHtml,
  generateReciboDevolucaoBensHtml,
  type OffboardingDocumentContext,
  type GenerateAllDocumentsInput,
  type GeneratedDocument,
  type IntegrityProof,
  type AssetItem,
} from './offboarding-documents.engine';
import { generateDocumentHash } from '@/domains/employee-agreement/document-hash';
import { executeBlockchainRegistration } from '@/domains/blockchain-registry';

export const offboardingService = {
  // ── Workflows ──

  async list(tenantId: string) {
    const { data, error } = await supabase
      .from('offboarding_workflows')
      .select(`
        *,
        employee:employees!offboarding_workflows_employee_id_fkey(name, email, cpf, position_id)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r: any) => ({
      ...r,
      employee: Array.isArray(r.employee) ? r.employee[0] : r.employee,
    })) as OffboardingWorkflow[];
  },

  async getById(id: string, tenantId: string) {
    const { data, error } = await supabase
      .from('offboarding_workflows')
      .select(`
        *,
        employee:employees!offboarding_workflows_employee_id_fkey(name, email, cpf, position_id)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error) throw error;
    const row = data as any;
    return {
      ...row,
      employee: Array.isArray(row.employee) ? row.employee[0] : row.employee,
    } as OffboardingWorkflow;
  },

  async create(dto: CreateOffboardingDTO) {
    const { data: wf, error: wfErr } = await supabase
      .from('offboarding_workflows')
      .insert({
        tenant_id: dto.tenant_id,
        employee_id: dto.employee_id,
        company_id: dto.company_id || null,
        company_group_id: dto.company_group_id || null,
        offboarding_type: dto.offboarding_type,
        motivo: dto.motivo || null,
        data_desligamento: dto.data_desligamento,
        last_working_day: dto.last_working_day || null,
        aviso_previo_type: dto.aviso_previo_type || 'nao_aplicavel',
        aviso_previo_days: dto.aviso_previo_days || 0,
        justa_causa_motivo: dto.justa_causa_motivo || null,
        justa_causa_artigo: dto.justa_causa_artigo || null,
        notes: dto.notes || null,
        initiated_by: dto.initiated_by || null,
        status: 'draft',
      } as any)
      .select()
      .single();
    if (wfErr) throw wfErr;

    // Generate checklist items
    const templates = getChecklistTemplatesByType(dto.offboarding_type);
    const checklistRows = templates.map((t, idx) => ({
      tenant_id: dto.tenant_id,
      workflow_id: (wf as any).id,
      category: t.category,
      title: t.title,
      description: t.description,
      ordem: (t as any).ordem ?? idx + 1,
      is_mandatory: t.is_mandatory,
      is_automated: t.is_automated,
      automation_action: t.automation_action || null,
      status: 'pending',
    }));
    if (checklistRows.length > 0) {
      const { error: clErr } = await supabase
        .from('offboarding_checklist_items')
        .insert(checklistRows as any);
      if (clErr) throw clErr;
    }

    // 3. Run pendency validation and inject dynamic checklist items
    const validation = await validateOffboardingPendencies(dto.tenant_id, dto.employee_id, (wf as any).id);
    if (validation.pendencies.length > 0) {
      const startOrdem = checklistRows.length + 1;
      const pendencyItems = pendenciesToChecklistItems(validation.pendencies, dto.tenant_id, (wf as any).id, startOrdem);
      const { error: piErr } = await supabase
        .from('offboarding_checklist_items')
        .insert(pendencyItems as any);
      if (piErr) console.warn('[offboarding] Failed to insert pendency items:', piErr);
    }

    // 4. Audit log
    await supabase.from('offboarding_audit_log').insert({
      tenant_id: dto.tenant_id,
      workflow_id: (wf as any).id,
      action: 'workflow.created',
      etapa: 'bloqueio_operacional',
      decisao: 'automatico',
      justificativa: `Workflow de desligamento criado — tipo: ${dto.offboarding_type}`,
      new_value: { ...dto, pendency_validation: { total: validation.pendencies.length, blocking: validation.total_blocking, can_proceed: validation.can_proceed } } as any,
    } as any);

    return wf as unknown as OffboardingWorkflow;
  },

  async updateStatus(id: string, tenantId: string, status: OffboardingStatus, extra?: Record<string, unknown>) {
    const payload: Record<string, unknown> = { status, ...extra };
    if (status === 'completed') payload.approved_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('offboarding_workflows')
      .update(payload as any)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;

    await supabase.from('offboarding_audit_log').insert({
      tenant_id: tenantId,
      workflow_id: id,
      action: 'workflow.status_changed',
      etapa: 'finalizacao',
      decisao: status === 'completed' ? 'concluido' : status === 'archived' ? 'cancelado' : 'pendente',
      justificativa: `Status alterado para: ${status}`,
      new_value: payload as any,
    } as any);

    return data as unknown as OffboardingWorkflow;
  },

  async cancel(id: string, tenantId: string, reason: string) {
    // Cancel sets archived status with cancellation reason
    return this.updateStatus(id, tenantId, 'archived', { cancellation_reason: reason });
  },

  // ── Checklist ──

  async getChecklist(workflowId: string, tenantId: string) {
    const { data, error } = await supabase
      .from('offboarding_checklist_items')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('tenant_id', tenantId)
      .order('ordem');
    if (error) throw error;
    return (data || []) as unknown as OffboardingChecklistItem[];
  },

  async updateChecklistItem(itemId: string, tenantId: string, status: ChecklistItemStatus, extra?: Record<string, unknown>) {
    const payload: Record<string, unknown> = { status, ...extra };
    if (status === 'completed') payload.completed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('offboarding_checklist_items')
      .update(payload as any)
      .eq('id', itemId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as OffboardingChecklistItem;
  },

  // ── Reference Letter ──

  async getReferenceLetter(workflowId: string, tenantId: string) {
    const { data, error } = await supabase
      .from('offboarding_reference_letters')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as OffboardingReferenceLetter | null;
  },

  async createReferenceLetter(workflowId: string, tenantId: string, employeeId: string, contentHtml: string, eligibility: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('offboarding_reference_letters')
      .insert({
        tenant_id: tenantId,
        workflow_id: workflowId,
        employee_id: employeeId,
        content_html: contentHtml,
        eligibility_criteria: eligibility,
      } as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as OffboardingReferenceLetter;
  },

  async approveReferenceLetter(letterId: string, tenantId: string, approvedBy: string) {
    const { data, error } = await supabase
      .from('offboarding_reference_letters')
      .update({
        approved: true,
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      } as any)
      .eq('id', letterId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as OffboardingReferenceLetter;
  },

  async rejectReferenceLetter(letterId: string, tenantId: string, reason: string) {
    const { data, error } = await supabase
      .from('offboarding_reference_letters')
      .update({
        approved: false,
        rejection_reason: reason,
      } as any)
      .eq('id', letterId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as OffboardingReferenceLetter;
  },

  // ── Eligibility Assessment ──

  assessReferenceLetterEligibility(workflow: OffboardingWorkflow): { eligible: boolean; score: number; criteria: Record<string, boolean> } {
    const criteria: Record<string, boolean> = {
      not_justa_causa: workflow.offboarding_type !== 'justa_causa',
      has_employee_data: !!workflow.employee,
      workflow_active: workflow.status !== 'archived',
    };

    const passed = Object.values(criteria).filter(Boolean).length;
    const total = Object.keys(criteria).length;
    const score = Math.round((passed / total) * 100);

    return {
      eligible: criteria.not_justa_causa && score >= 66,
      score,
      criteria,
    };
  },

  // ── Etapa 3: Cálculo Rescisão ──

  /**
   * Run rescission calculation for a workflow.
   * Stores the simulation snapshot on the workflow.
   */
  async calculateRescission(
    workflowId: string,
    tenantId: string,
    input: RescissionInput,
  ): Promise<RescissionResult> {
    const result = calculateRescission(input);

    // Persist snapshot on workflow
    await supabase
      .from('offboarding_workflows')
      .update({
        rescisao_bruta: result.total_proventos,
        rescisao_descontos: result.total_descontos,
        rescisao_liquida: result.valor_liquido,
        simulation_snapshot: result as any,
      } as any)
      .eq('id', workflowId)
      .eq('tenant_id', tenantId);

    // Audit
    await supabase.from('offboarding_audit_log').insert({
      tenant_id: tenantId,
      workflow_id: workflowId,
      action: 'rescission_calculated',
      new_value: {
        total_proventos: result.total_proventos,
        total_descontos: result.total_descontos,
        valor_liquido: result.valor_liquido,
        multa_fgts: result.multa_fgts,
      } as any,
    } as any);

    return result;
  },

  /**
   * Generate Termo de Rescisão HTML document (legacy — prefer generateDocuments).
   */
  generateTermoRescisao(data: TermoRescisaoData): string {
    return generateTermoRescisaoHtml(data);
  },

  /**
   * Etapa 4 — Generate all offboarding documents with integrity proof.
   *
   * Flow:
   *   1. Generate HTML for each applicable document
   *   2. Compute SHA-256 hash per document
   *   3. Enqueue blockchain registration per document
   *   4. Embed QR + hash + blockchain proof in final HTML
   */
  async generateDocuments(
    input: GenerateAllDocumentsInput & { verificationBaseUrl?: string; signedDocumentIds?: Record<string, string> },
  ): Promise<GeneratedDocument[]> {
    const { context: ctx, rescission, assets, verificationBaseUrl } = input;
    const baseUrl = verificationBaseUrl || `${window.location.origin}/verify`;

    // 1. Generate initial HTML (without proofs) to compute hashes
    const initialDocs = generateAllOffboardingDocuments({ context: ctx, rescission, assets });

    // 2. Compute hashes and build proofs
    const proofs: Partial<Record<string, IntegrityProof>> = {};

    for (const doc of initialDocs) {
      const hash = await generateDocumentHash(doc.html);
      const token = `${ctx.workflow_id}-${doc.type}`;
      const verificationUrl = `${baseUrl}?token=${encodeURIComponent(token)}`;

      const proof: IntegrityProof = {
        hash_sha256: hash,
        verification_url: verificationUrl,
        document_token: token,
      };

      // 3. Enqueue blockchain registration (fire-and-forget)
      const signedDocId = input.signedDocumentIds?.[doc.type] || `${ctx.workflow_id}_${doc.type}`;
      try {
        const regResult = await executeBlockchainRegistration({
          tenant_id: ctx.tenant_id,
          signed_document_id: signedDocId,
          document_content: doc.html,
          created_by: undefined,
        });
        if (regResult.success && regResult.hash_sha256) {
          proof.hash_sha256 = regResult.hash_sha256;
          if (regResult.transaction_hash) {
            proof.blockchain_tx = regResult.transaction_hash;
          }
        }
      } catch {
        // Blockchain registration is async — failure doesn't block document generation
      }

      proofs[doc.type] = proof;
    }

    // 4. Re-generate with proofs embedded
    const finalDocs = generateAllOffboardingDocuments({
      context: ctx,
      rescission,
      assets,
      proofs: proofs as any,
    });

    // 5. Audit log
    await supabase.from('offboarding_audit_log').insert({
      tenant_id: ctx.tenant_id,
      workflow_id: ctx.workflow_id,
      action: 'documents_generated',
      new_value: {
        document_types: finalDocs.map(d => d.type),
        hashes: Object.fromEntries(
          finalDocs.map(d => [d.type, d.integrity?.hash_sha256 || null])
        ),
      } as any,
    } as any);

    return finalDocs;
  },

  /** Helper: calculate aviso prévio days based on tenure */
  calculateAvisoPrevioDays,

  /** Helper: calculate proportional months for férias/13º */
  calculateProportionalMonths,
};
