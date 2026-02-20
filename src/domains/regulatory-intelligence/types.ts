/**
 * Regulatory Intelligence Engine — Types
 *
 * Bounded Context: monitors, versions, and auto-updates
 * the legal base of the system (NRs, CLT, CCTs, Portarias).
 */

// ── Enums / Literals ──

export type NormaTipo = 'NR' | 'CLT' | 'CCT' | 'Portaria' | 'Lei' | 'Decreto' | 'IN' | 'Resolucao';
export type NormaStatus = 'vigente' | 'revogada' | 'em_revisao' | 'publicada';
export type MonitorFrequency = 'diaria' | 'semanal' | 'quinzenal' | 'mensal';
export type ImpactSeverity = 'informativo' | 'atencao' | 'acao_requerida' | 'urgente' | 'critico';
export type ImpactArea =
  | 'career_positions'
  | 'salary_floor'
  | 'training_requirements'
  | 'medical_exams'
  | 'epi_requirements'
  | 'risk_mapping'
  | 'working_hours'
  | 'additionals'
  | 'esocial';
export type AlertStatus = 'pendente' | 'visualizado' | 'em_andamento' | 'resolvido' | 'ignorado';
export type UpdateSourceType = 'dou' | 'mte' | 'ibge' | 'manual' | 'ai_detected';

// ── Core Entities ──

/** A legal norm tracked by the system */
export interface RegulatoryNorm {
  id: string;
  tenant_id: string;
  tipo: NormaTipo;
  codigo: string;                  // e.g. "NR-7", "CLT Art. 168", "Portaria 3214"
  titulo: string;
  ementa: string | null;
  orgao_emissor: string;           // e.g. "MTE", "Presidência da República"
  data_publicacao: string;
  data_vigencia_inicio: string;
  data_vigencia_fim: string | null;
  status: NormaStatus;
  versao: number;
  url_fonte: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/** A specific version/revision of a norm */
export interface NormVersion {
  id: string;
  tenant_id: string;
  norm_id: string;
  versao: number;
  titulo: string;
  resumo_alteracoes: string;
  data_publicacao: string;
  data_vigencia: string;
  conteudo_resumido: string | null;
  fonte_url: string | null;
  detectado_por: UpdateSourceType;
  created_at: string;
}

/** Monitor configuration per tenant */
export interface RegulatoryMonitorConfig {
  id: string;
  tenant_id: string;
  tipos_monitorados: NormaTipo[];
  nrs_especificas: number[];
  monitorar_clt: boolean;
  monitorar_ccts: boolean;
  monitorar_portarias: boolean;
  frequencia: MonitorFrequency;
  notificar_email: boolean;
  notificar_in_app: boolean;
  webhook_url: string | null;
  is_active: boolean;
  ultima_verificacao: string | null;
  created_at: string;
  updated_at: string;
}

/** Impact analysis result when a norm changes */
export interface RegulatoryImpact {
  id: string;
  tenant_id: string;
  norm_version_id: string;
  norm_codigo: string;
  area_impactada: ImpactArea;
  severidade: ImpactSeverity;
  descricao: string;
  detalhes: string | null;
  entidades_afetadas: AffectedEntity[];
  acao_recomendada: string | null;
  resolvido: boolean;
  resolvido_em: string | null;
  resolvido_por: string | null;
  created_at: string;
}

export interface AffectedEntity {
  type: 'career_position' | 'company' | 'department' | 'employee' | 'training' | 'agreement';
  id: string;
  name: string;
}

/** Regulatory alert dispatched to users */
export interface RegulatoryAlert {
  id: string;
  tenant_id: string;
  impact_id: string | null;
  norm_codigo: string;
  titulo: string;
  mensagem: string;
  severidade: ImpactSeverity;
  status: AlertStatus;
  area: ImpactArea;
  acao_requerida: boolean;
  prazo_acao: string | null;
  destinatario_user_id: string | null;
  visualizado_em: string | null;
  resolvido_em: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Legal base update record (audit trail) */
export interface LegalBaseUpdate {
  id: string;
  tenant_id: string;
  norm_id: string;
  norm_version_id: string;
  tipo_atualizacao: 'criacao' | 'alteracao' | 'revogacao' | 'correcao';
  campo_alterado: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  aplicado_automaticamente: boolean;
  aplicado_por: string | null;
  created_at: string;
}

// ── DTOs ──

export interface CreateRegulatoryNormDTO {
  tenant_id: string;
  tipo: NormaTipo;
  codigo: string;
  titulo: string;
  ementa?: string | null;
  orgao_emissor: string;
  data_publicacao: string;
  data_vigencia_inicio: string;
  data_vigencia_fim?: string | null;
  url_fonte?: string | null;
  tags?: string[];
}

export interface CreateNormVersionDTO {
  tenant_id: string;
  norm_id: string;
  resumo_alteracoes: string;
  data_publicacao: string;
  data_vigencia: string;
  conteudo_resumido?: string | null;
  fonte_url?: string | null;
  detectado_por?: UpdateSourceType;
}

export interface CreateRegulatoryAlertDTO {
  tenant_id: string;
  impact_id?: string | null;
  norm_codigo: string;
  titulo: string;
  mensagem: string;
  severidade?: ImpactSeverity;
  area: ImpactArea;
  acao_requerida?: boolean;
  prazo_acao?: string | null;
  destinatario_user_id?: string | null;
  metadata?: Record<string, unknown>;
}

// ── Engine Inputs ──

export interface MonitorCheckInput {
  tenant_id: string;
  config: RegulatoryMonitorConfig;
  current_norms: RegulatoryNorm[];
}

export interface ImpactAnalysisInput {
  tenant_id: string;
  norm: RegulatoryNorm;
  version: NormVersion;
  positions: { id: string; nome: string; cbo_codigo: string | null; nrs_aplicaveis: number[] }[];
  companies: { id: string; name: string; cnae_principal: string | null; grau_risco: number }[];
  active_agreements: { id: string; union_name: string; valid_until: string }[];
}

export interface LegalBaseRefreshInput {
  tenant_id: string;
  norm: RegulatoryNorm;
  new_version: NormVersion;
  impacts: RegulatoryImpact[];
}
