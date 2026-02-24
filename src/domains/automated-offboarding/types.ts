/**
 * Automated Offboarding Workflow Engine — Types
 */

export type OffboardingType = 'sem_justa_causa' | 'justa_causa' | 'pedido_demissao' | 'acordo_mutuo';
export type OffboardingStatus = 'draft' | 'in_progress' | 'pending_approval' | 'approved' | 'completed' | 'cancelled';
export type ChecklistItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
export type AvisoPrevioType = 'trabalhado' | 'indenizado' | 'nao_aplicavel';

export const OFFBOARDING_TYPE_LABELS: Record<OffboardingType, string> = {
  sem_justa_causa: 'Sem Justa Causa',
  justa_causa: 'Por Justa Causa',
  pedido_demissao: 'Pedido de Demissão',
  acordo_mutuo: 'Acordo Mútuo',
};

export const OFFBOARDING_STATUS_LABELS: Record<OffboardingStatus, string> = {
  draft: 'Rascunho',
  in_progress: 'Em Andamento',
  pending_approval: 'Aguardando Aprovação',
  approved: 'Aprovado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const CHECKLIST_CATEGORY_LABELS: Record<string, string> = {
  documentacao: 'Documentação',
  financeiro: 'Financeiro',
  esocial: 'eSocial',
  patrimonio: 'Patrimônio',
  acessos: 'Acessos',
  beneficios: 'Benefícios',
  exame_demissional: 'Exame Demissional',
  arquivamento: 'Arquivamento',
  comunicacao: 'Comunicação',
};

export const AVISO_PREVIO_LABELS: Record<AvisoPrevioType, string> = {
  trabalhado: 'Trabalhado',
  indenizado: 'Indenizado',
  nao_aplicavel: 'Não Aplicável',
};

export interface OffboardingWorkflow {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id: string | null;
  company_group_id: string | null;
  offboarding_type: OffboardingType;
  status: OffboardingStatus;
  notification_date: string;
  effective_date: string;
  last_working_day: string | null;
  aviso_previo_type: AvisoPrevioType;
  aviso_previo_days: number;
  justa_causa_motivo: string | null;
  justa_causa_artigo: string | null;
  acordo_multa_fgts_pct: number;
  rescisao_bruta: number;
  rescisao_descontos: number;
  rescisao_liquida: number;
  simulation_snapshot: Record<string, unknown> | null;
  esocial_event_id: string | null;
  esocial_status: string;
  esocial_protocol: string | null;
  esocial_sent_at: string | null;
  reference_letter_eligible: boolean;
  reference_letter_approved: boolean | null;
  reference_letter_approved_by: string | null;
  reference_letter_generated_at: string | null;
  reference_letter_document_id: string | null;
  archived_at: string | null;
  archived_by: string | null;
  archive_snapshot: Record<string, unknown> | null;
  initiated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined
  employee?: { name: string; email: string | null; cpf: string | null; position_id: string | null } | null;
}

export interface OffboardingChecklistItem {
  id: string;
  tenant_id: string;
  workflow_id: string;
  category: string;
  title: string;
  description: string | null;
  ordem: number;
  status: ChecklistItemStatus;
  is_mandatory: boolean;
  is_automated: boolean;
  completed_at: string | null;
  completed_by: string | null;
  skipped_reason: string | null;
  automation_action: string | null;
  automation_result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface OffboardingReferenceLetter {
  id: string;
  tenant_id: string;
  workflow_id: string;
  employee_id: string;
  content_html: string;
  content_plain: string | null;
  eligibility_score: number;
  eligibility_criteria: Record<string, unknown>;
  approved: boolean | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  employee_signed: boolean;
  employee_signed_at: string | null;
  employer_signed: boolean;
  employer_signed_at: string | null;
  employer_signer_name: string | null;
  document_url: string | null;
  document_hash: string | null;
  blockchain_proof_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOffboardingDTO {
  tenant_id: string;
  employee_id: string;
  company_id?: string | null;
  company_group_id?: string | null;
  offboarding_type: OffboardingType;
  effective_date: string;
  last_working_day?: string;
  aviso_previo_type?: AvisoPrevioType;
  aviso_previo_days?: number;
  justa_causa_motivo?: string;
  justa_causa_artigo?: string;
  notes?: string;
  initiated_by?: string;
}
