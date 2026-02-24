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
    // 1. Create workflow
    const { data: wf, error: wfErr } = await supabase
      .from('offboarding_workflows')
      .insert({
        tenant_id: dto.tenant_id,
        employee_id: dto.employee_id,
        company_id: dto.company_id || null,
        company_group_id: dto.company_group_id || null,
        offboarding_type: dto.offboarding_type,
        effective_date: dto.effective_date,
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

    // 2. Generate checklist items
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

    // 3. Audit log
    await supabase.from('offboarding_audit_log').insert({
      tenant_id: dto.tenant_id,
      workflow_id: (wf as any).id,
      action: 'workflow_created',
      new_value: dto as any,
    } as any);

    return wf as unknown as OffboardingWorkflow;
  },

  async updateStatus(id: string, tenantId: string, status: OffboardingStatus, extra?: Record<string, unknown>) {
    const payload: Record<string, unknown> = { status, ...extra };
    if (status === 'approved') payload.approved_at = new Date().toISOString();

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
      action: `status_changed_to_${status}`,
      new_value: payload as any,
    } as any);

    return data as unknown as OffboardingWorkflow;
  },

  async cancel(id: string, tenantId: string, reason: string) {
    return this.updateStatus(id, tenantId, 'cancelled', { cancellation_reason: reason });
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
      workflow_not_cancelled: workflow.status !== 'cancelled',
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
};
