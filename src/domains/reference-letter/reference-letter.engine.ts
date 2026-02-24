/**
 * ReferenceLetterEngine — Core business logic
 *
 * Flow:
 *   1. HR requests a reference letter for a terminated employee
 *   2. Engine evaluates eligibility (no just-cause termination, min tenure, etc.)
 *   3. Suggests a letter template based on role/tenure
 *   4. Dual-signature: manager → HR/Admin
 */

import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types ──

export type ReferenceLetterStatus =
  | 'requested'
  | 'eligibility_denied'
  | 'pending_manager_signature'
  | 'pending_hr_signature'
  | 'signed'
  | 'delivered'
  | 'cancelled';

export interface ReferenceLetter {
  id: string;
  tenant_id: string;
  employee_id: string;
  requested_by: string;
  requested_at: string;
  purpose: string | null;
  is_eligible: boolean;
  eligibility_reason: string | null;
  eligibility_checked_at: string | null;
  template_key: string;
  content_html: string | null;
  status: ReferenceLetterStatus;
  manager_signer_id: string | null;
  manager_signed_at: string | null;
  manager_signature_note: string | null;
  hr_signer_id: string | null;
  hr_signed_at: string | null;
  hr_signature_note: string | null;
  delivered_at: string | null;
  delivered_to_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
  suggested_template: string;
}

export interface RequestLetterInput {
  tenant_id: string;
  employee_id: string;
  requested_by: string;
  purpose?: string;
}

// ── Eligibility Rules ──

const INELIGIBLE_OFFBOARDING_TYPES = ['justa_causa', 'abandono'];
const MIN_TENURE_MONTHS = 3;

export async function evaluateEligibility(
  tenantId: string,
  employeeId: string,
): Promise<EligibilityResult> {
  // Check archived profile for termination type
  const { data: archive } = await supabase
    .from('archived_employee_profiles')
    .select('offboarding_type, data_desligamento, employee_snapshot')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  // Also check active employee
  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, hire_date, status, position_id')
    .eq('id', employeeId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const isTerminated = !!archive;
  const empName = employee?.name || (archive?.employee_snapshot as any)?.personalData?.nome_completo || 'Colaborador';

  // Rule 1: Just-cause termination → ineligible
  if (isTerminated && INELIGIBLE_OFFBOARDING_TYPES.includes(archive.offboarding_type)) {
    return {
      eligible: false,
      reason: `Desligamento por ${archive.offboarding_type === 'justa_causa' ? 'justa causa' : 'abandono de emprego'} — inelegível para carta de referência.`,
      suggested_template: 'none',
    };
  }

  // Rule 2: Minimum tenure
  const admissionDate = employee?.hire_date || (archive?.employee_snapshot as any)?.record?.data_admissao;
  const endDate = archive?.data_desligamento || new Date().toISOString();
  if (admissionDate) {
    const months = differenceInMonths(parseISO(endDate), parseISO(admissionDate));
    if (months < MIN_TENURE_MONTHS) {
      return {
        eligible: false,
        reason: `Tempo de empresa insuficiente (${months} meses). Mínimo: ${MIN_TENURE_MONTHS} meses.`,
        suggested_template: 'none',
      };
    }
  }

  // Suggest template based on tenure
  const tenure = admissionDate
    ? differenceInMonths(parseISO(endDate), parseISO(admissionDate))
    : 12;

  let suggestedTemplate = 'standard';
  if (tenure >= 60) suggestedTemplate = 'senior';
  else if (tenure >= 24) suggestedTemplate = 'experienced';

  return {
    eligible: true,
    reason: `${empName} — elegível. Tempo: ${tenure} meses.`,
    suggested_template: suggestedTemplate,
  };
}

// ── Letter Templates ──

export const LETTER_TEMPLATES: Record<string, { label: string; description: string }> = {
  standard: { label: 'Carta Padrão', description: 'Para colaboradores com até 2 anos de empresa' },
  experienced: { label: 'Carta Detalhada', description: 'Para colaboradores com 2-5 anos, inclui competências' },
  senior: { label: 'Carta Executiva', description: 'Para colaboradores com 5+ anos, formato institucional completo' },
};

export function generateLetterHtml(
  templateKey: string,
  employeeName: string,
  cargo: string,
  admissionDate: string,
  terminationDate: string,
  companyName: string,
): string {
  const admFormatted = format(parseISO(admissionDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const termFormatted = format(parseISO(terminationDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  if (templateKey === 'senior') {
    return `
<div style="font-family: 'Georgia', serif; max-width: 700px; margin: 0 auto; padding: 40px;">
  <h2 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px;">CARTA DE REFERÊNCIA PROFISSIONAL</h2>
  <p style="text-align: right; color: #666; font-size: 14px;">${today}</p>
  <p><strong>A quem possa interessar,</strong></p>
  <p>Declaramos que <strong>${employeeName}</strong> exerceu o cargo de <strong>${cargo}</strong> nesta empresa no período de <strong>${admFormatted}</strong> a <strong>${termFormatted}</strong>.</p>
  <p>Durante sua trajetória, demonstrou excelência profissional, comprometimento e capacidade de liderança consistentes com a posição ocupada. Sua contribuição foi determinante para o alcance dos objetivos organizacionais.</p>
  <p>Recomendamos sem reservas o(a) profissional para qualquer oportunidade compatível com sua experiência e competências demonstradas ao longo de sua carreira conosco.</p>
  <br/>
  <div style="margin-top: 60px;">
    <div style="display: flex; justify-content: space-between;">
      <div style="text-align: center; width: 45%;"><div style="border-top: 1px solid #333; padding-top: 8px;">Gestor Direto</div></div>
      <div style="text-align: center; width: 45%;"><div style="border-top: 1px solid #333; padding-top: 8px;">Recursos Humanos</div></div>
    </div>
  </div>
  <p style="text-align: center; margin-top: 40px; font-size: 12px; color: #999;">${companyName}</p>
</div>`;
  }

  if (templateKey === 'experienced') {
    return `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px;">
  <h2 style="text-align: center;">CARTA DE REFERÊNCIA</h2>
  <p style="text-align: right; color: #666;">${today}</p>
  <p>A quem possa interessar,</p>
  <p>Atestamos que <strong>${employeeName}</strong> trabalhou nesta empresa como <strong>${cargo}</strong>, no período de ${admFormatted} a ${termFormatted}.</p>
  <p>O(A) profissional apresentou bom desempenho em suas atribuições, demonstrando competência técnica, proatividade e bom relacionamento interpessoal.</p>
  <p>Recomendamos o(a) profissional para oportunidades compatíveis com sua qualificação.</p>
  <br/>
  <div style="margin-top: 60px; display: flex; justify-content: space-between;">
    <div style="text-align: center; width: 45%;"><div style="border-top: 1px solid #333; padding-top: 8px;">Gestor Direto</div></div>
    <div style="text-align: center; width: 45%;"><div style="border-top: 1px solid #333; padding-top: 8px;">Recursos Humanos</div></div>
  </div>
</div>`;
  }

  // Standard template
  return `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px;">
  <h2 style="text-align: center;">CARTA DE REFERÊNCIA</h2>
  <p style="text-align: right; color: #666;">${today}</p>
  <p>A quem possa interessar,</p>
  <p>Declaramos para os devidos fins que <strong>${employeeName}</strong> prestou serviços nesta empresa no cargo de <strong>${cargo}</strong>, no período de ${admFormatted} a ${termFormatted}, nada constando que o(a) desabone.</p>
  <br/>
  <div style="margin-top: 60px; display: flex; justify-content: space-between;">
    <div style="text-align: center; width: 45%;"><div style="border-top: 1px solid #333; padding-top: 8px;">Gestor Direto</div></div>
    <div style="text-align: center; width: 45%;"><div style="border-top: 1px solid #333; padding-top: 8px;">Recursos Humanos</div></div>
  </div>
</div>`;
}

// ── Core Operations ──

export async function requestReferenceLetter(input: RequestLetterInput): Promise<ReferenceLetter> {
  const eligibility = await evaluateEligibility(input.tenant_id, input.employee_id);

  const status: ReferenceLetterStatus = eligibility.eligible ? 'pending_manager_signature' : 'eligibility_denied';

  let contentHtml: string | null = null;
  if (eligibility.eligible) {
    const { data: emp } = await supabase
      .from('employees')
      .select('name, position_id, hire_date, company_id')
      .eq('id', input.employee_id)
      .maybeSingle();

    const { data: archive } = await supabase
      .from('archived_employee_profiles')
      .select('employee_snapshot, data_desligamento')
      .eq('employee_id', input.employee_id)
      .eq('tenant_id', input.tenant_id)
      .maybeSingle();

    const empSnap = archive?.employee_snapshot as any;
    const empName = emp?.name || empSnap?.personalData?.nome_completo || 'Colaborador';
    const admDate = emp?.hire_date || empSnap?.record?.data_admissao || new Date().toISOString();
    const termDate = archive?.data_desligamento || new Date().toISOString();

    // Get position name
    let cargo = 'Não informado';
    if (emp?.position_id) {
      const { data: pos } = await supabase
        .from('positions')
        .select('title')
        .eq('id', emp.position_id)
        .maybeSingle();
      if (pos?.title) cargo = pos.title;
    }

    // Get company name
    let companyName = 'Empresa';
    const companyId = emp?.company_id || empSnap?.record?.company_id;
    if (companyId) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .maybeSingle();
      companyName = company?.name || 'Empresa';
    }

    contentHtml = generateLetterHtml(eligibility.suggested_template, empName, cargo, admDate, termDate, companyName);
  }

  const { data, error } = await supabase
    .from('reference_letters')
    .insert({
      tenant_id: input.tenant_id,
      employee_id: input.employee_id,
      requested_by: input.requested_by,
      purpose: input.purpose || null,
      is_eligible: eligibility.eligible,
      eligibility_reason: eligibility.reason,
      eligibility_checked_at: new Date().toISOString(),
      template_key: eligibility.suggested_template,
      content_html: contentHtml,
      status,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao criar carta de referência: ${error.message}`);
  return data as unknown as ReferenceLetter;
}

export async function signAsManager(
  letterId: string,
  signerId: string,
  note?: string,
): Promise<ReferenceLetter> {
  const { data, error } = await supabase
    .from('reference_letters')
    .update({
      manager_signer_id: signerId,
      manager_signed_at: new Date().toISOString(),
      manager_signature_note: note || null,
      status: 'pending_hr_signature' as ReferenceLetterStatus,
    })
    .eq('id', letterId)
    .eq('status', 'pending_manager_signature')
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao assinar como gestor: ${error.message}`);
  return data as unknown as ReferenceLetter;
}

export async function signAsHR(
  letterId: string,
  signerId: string,
  note?: string,
): Promise<ReferenceLetter> {
  const { data, error } = await supabase
    .from('reference_letters')
    .update({
      hr_signer_id: signerId,
      hr_signed_at: new Date().toISOString(),
      hr_signature_note: note || null,
      status: 'signed' as ReferenceLetterStatus,
    })
    .eq('id', letterId)
    .eq('status', 'pending_hr_signature')
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao assinar como RH: ${error.message}`);
  return data as unknown as ReferenceLetter;
}

export async function cancelLetter(letterId: string): Promise<void> {
  const { error } = await supabase
    .from('reference_letters')
    .update({ status: 'cancelled' as ReferenceLetterStatus })
    .eq('id', letterId);

  if (error) throw new Error(`Erro ao cancelar carta: ${error.message}`);
}

export async function listReferenceLetters(tenantId: string): Promise<ReferenceLetter[]> {
  const { data, error } = await supabase
    .from('reference_letters')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Erro ao listar cartas: ${error.message}`);
  return (data || []) as unknown as ReferenceLetter[];
}

// Status labels
export const STATUS_LABELS: Record<ReferenceLetterStatus, string> = {
  requested: 'Solicitada',
  eligibility_denied: 'Inelegível',
  pending_manager_signature: 'Aguardando Gestor',
  pending_hr_signature: 'Aguardando RH',
  signed: 'Assinada',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

export const STATUS_COLORS: Record<ReferenceLetterStatus, string> = {
  requested: 'bg-muted text-muted-foreground',
  eligibility_denied: 'bg-destructive/10 text-destructive',
  pending_manager_signature: 'bg-chart-4/10 text-chart-4',
  pending_hr_signature: 'bg-chart-3/10 text-chart-3',
  signed: 'bg-chart-2/10 text-chart-2',
  delivered: 'bg-primary/10 text-primary',
  cancelled: 'bg-muted text-muted-foreground',
};
