/**
 * Future Preparation — Types
 *
 * Interfaces and contracts for upcoming integrations:
 *  1. External Legal API (jurídica)
 *  2. AI Impact Summarization
 *  3. Automatic Email Notifications
 *  4. Real-time DOU Monitoring
 */

// ═══════════════════════════════════════════════════════════
// 1. EXTERNAL LEGAL API
// ═══════════════════════════════════════════════════════════

export type LegalApiProvider = 'lexml' | 'planalto' | 'mte_api' | 'esocial_api' | 'custom';

export interface LegalApiConfig {
  provider: LegalApiProvider;
  base_url: string;
  api_key_ref: string;         // secret vault reference, never plaintext
  rate_limit_rpm: number;
  timeout_ms: number;
  retry_attempts: number;
  is_active: boolean;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
}

export interface LegalApiQueryParams {
  tipo_norma?: string;
  orgao_emissor?: string;
  data_inicio?: string;
  data_fim?: string;
  texto_busca?: string;
  pagina?: number;
  limite?: number;
}

export interface LegalApiNormResult {
  codigo: string;
  titulo: string;
  ementa: string | null;
  orgao_emissor: string;
  data_publicacao: string;
  data_vigencia: string;
  url_fonte: string;
  texto_integral: string | null;
  status: 'vigente' | 'revogada' | 'alterada';
  metadados: Record<string, unknown>;
}

export interface LegalApiResponse {
  success: boolean;
  data: LegalApiNormResult[];
  total: number;
  pagina: number;
  total_paginas: number;
  error?: string;
  api_latency_ms: number;
}

export interface LegalApiSyncResult {
  provider: LegalApiProvider;
  normas_encontradas: number;
  normas_novas: number;
  normas_atualizadas: number;
  erros: string[];
  synced_at: string;
}

// ═══════════════════════════════════════════════════════════
// 2. AI IMPACT SUMMARIZATION
// ═══════════════════════════════════════════════════════════

export type AiSummaryModel = 'gemini-flash' | 'gemini-pro' | 'gpt-5-mini';
export type SummaryLanguage = 'pt-BR' | 'en';
export type SummaryFormat = 'executivo' | 'tecnico' | 'compliance' | 'rh';

export interface AiSummarizationRequest {
  tenant_id: string;
  norm_codigo: string;
  norm_titulo: string;
  texto_alteracao: string;
  areas_impactadas: string[];
  entidades_afetadas: { type: string; name: string }[];
  formato: SummaryFormat;
  idioma: SummaryLanguage;
  modelo?: AiSummaryModel;
  max_tokens?: number;
}

export interface AiSummarizationResult {
  resumo_executivo: string;
  pontos_chave: string[];
  acoes_recomendadas: string[];
  prazo_estimado: string | null;
  risco_nao_conformidade: 'baixo' | 'medio' | 'alto' | 'critico';
  impacto_financeiro_estimado: string | null;
  areas_departamento_afetadas: string[];
  modelo_utilizado: AiSummaryModel;
  tokens_consumidos: number;
  generated_at: string;
}

// ═══════════════════════════════════════════════════════════
// 3. EMAIL NOTIFICATION
// ═══════════════════════════════════════════════════════════

export type EmailNotificationType =
  | 'REGULATORY_ALERT'
  | 'IMPACT_REPORT'
  | 'ACTION_REQUIRED'
  | 'COMPLIANCE_DEADLINE'
  | 'DOU_DIGEST';

export type EmailPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface EmailNotificationTemplate {
  type: EmailNotificationType;
  subject_template: string;    // supports {{variables}}
  body_html_template: string;
  body_text_template: string;
  default_priority: EmailPriority;
}

export interface EmailNotificationRequest {
  tenant_id: string;
  type: EmailNotificationType;
  priority: EmailPriority;
  recipients: EmailRecipient[];
  variables: Record<string, string>;
  attachments?: EmailAttachment[];
  schedule_at?: string;        // for scheduled delivery
  norm_codigo?: string;
  alert_id?: string;
}

export interface EmailRecipient {
  email: string;
  name: string;
  role?: string;
}

export interface EmailAttachment {
  filename: string;
  content_type: string;
  content_base64: string;
}

export interface EmailNotificationResult {
  sent: boolean;
  message_id: string | null;
  recipients_count: number;
  failed_recipients: string[];
  error?: string;
  sent_at: string;
}

// ═══════════════════════════════════════════════════════════
// 4. DOU REAL-TIME MONITORING
// ═══════════════════════════════════════════════════════════

export type DouSecao = 'secao1' | 'secao2' | 'secao3' | 'extra';
export type DouMonitorStatus = 'ativo' | 'pausado' | 'erro' | 'desativado';

export interface DouMonitorConfig {
  tenant_id: string;
  secoes_monitoradas: DouSecao[];
  palavras_chave: string[];
  orgaos_filtro: string[];      // e.g. ["MTE", "Ministério da Saúde"]
  tipos_ato_filtro: string[];   // e.g. ["Portaria", "Instrução Normativa"]
  frequencia_verificacao_minutos: number;
  webhook_url: string | null;
  notificar_imediato: boolean;
  status: DouMonitorStatus;
  ultimo_item_processado_id: string | null;
  ultima_verificacao: string | null;
}

export interface DouPublicacao {
  id: string;
  secao: DouSecao;
  data_publicacao: string;
  orgao: string;
  tipo_ato: string;
  titulo: string;
  ementa: string;
  texto_completo: string | null;
  url_dou: string;
  pagina: string | null;
  assinante: string | null;
  relevancia_score: number;     // 0-100, calculated by keyword matching
}

export interface DouDigestResult {
  data_referencia: string;
  total_publicacoes: number;
  publicacoes_relevantes: number;
  publicacoes: DouPublicacao[];
  palavras_chave_match: Record<string, number>;  // keyword -> count
  generated_at: string;
}

export interface DouCheckResult {
  success: boolean;
  novas_publicacoes: number;
  publicacoes: DouPublicacao[];
  alertas_gerados: number;
  error?: string;
  checked_at: string;
  next_check_at: string;
}
