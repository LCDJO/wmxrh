/**
 * eSocial Governance & Monitoring Center — Types
 */

// ── Layout & Version Tracking ──

export type EsocialLayoutVersion = 'S-1.0' | 'S-1.1' | 'S-1.2' | 'S-1.3' | 'S-2.0' | string;

export type EsocialEventGroup =
  | 'tabelas'        // S-1000 a S-1080
  | 'nao_periodicos' // S-2190 a S-2420
  | 'periodicos'     // S-1200 a S-1299
  | 'sst';           // S-2210 a S-2240

export interface EsocialLayoutInfo {
  versao: EsocialLayoutVersion;
  data_inicio_obrigatoriedade: string;
  data_fim_obrigatoriedade: string | null;
  status: 'vigente' | 'futuro' | 'obsoleto';
  changelog_url: string | null;
  eventos_alterados: string[];
}

// ── Tenant / Company Monitoring ──

export type EsocialTenantStatus =
  | 'em_dia'
  | 'pendencias_menores'
  | 'pendencias_criticas'
  | 'bloqueado'
  | 'nao_configurado';

export type EsocialEventStatus =
  | 'enviado'
  | 'aceito'
  | 'rejeitado'
  | 'pendente'
  | 'retificado'
  | 'expirado';

export interface EsocialTenantOverview {
  tenant_id: string;
  tenant_name: string;
  status: EsocialTenantStatus;
  layout_version: EsocialLayoutVersion;
  empresas_total: number;
  empresas_em_dia: number;
  empresas_pendentes: number;
  empresas_bloqueadas: number;
  eventos_pendentes: number;
  eventos_rejeitados: number;
  ultimo_envio: string | null;
  proximo_prazo: string | null;
}

export interface TenantESocialStatus {
  tenant_id: string;
  empresas_integradas: number;
  empresas_com_erro: number;
  eventos_pendentes: number;
  eventos_rejeitados: number;
  certificado_valido: boolean;
  validade_certificado: string | null;
}

export type CertificadoStatus = 'valido' | 'expirando' | 'expirado' | 'nao_configurado';
export type CertificadoTipo = 'A1' | 'A3';

export interface CertificateInfo {
  company_id: string;
  company_name: string;
  tipo: CertificadoTipo;
  status: CertificadoStatus;
  validade: string | null;
  dias_restantes: number | null;
  serial_number: string | null;
  emitido_por: string | null;
}

export interface CertificateMonitorResult {
  total_certificados: number;
  validos: number;
  expirando: number;
  expirados: number;
  nao_configurados: number;
  certificados: CertificateInfo[];
  alertas_gerados: number;
}

export interface CompanyESocialStatus {
  company_id: string;
  eventos_enviados: number;
  eventos_pendentes: number;
  eventos_rejeitados: number;
  ultimo_protocolo: string | null;
  certificado_status: CertificadoStatus;
  layout_utilizado: EsocialLayoutVersion;
}

export interface EsocialCompanyStatus {
  company_id: string;
  company_name: string;
  cnpj: string;
  status: EsocialTenantStatus;
  layout_version: EsocialLayoutVersion;
  eventos: EsocialEventSummary[];
  pendencias: EsocialPendency[];
  ultimo_envio: string | null;
}

export interface EsocialEventSummary {
  codigo_evento: string;
  descricao: string;
  grupo: EsocialEventGroup;
  status: EsocialEventStatus;
  quantidade: number;
  ultimo_envio: string | null;
  erros: number;
}

export interface EsocialPendency {
  id: string;
  tipo: 'evento_pendente' | 'retificacao' | 'prazo_vencido' | 'layout_desatualizado' | 'erro_validacao';
  descricao: string;
  evento_codigo: string | null;
  prazo: string | null;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  created_at: string;
}

// ── Alerts ──

export type EsocialAlertType =
  | 'LAYOUT_CHANGE'
  | 'DEADLINE_APPROACHING'
  | 'EVENT_REJECTED'
  | 'BATCH_FAILURE'
  | 'COMPLIANCE_GAP'
  | 'VERSION_DEPRECATED';

export interface EsocialAlert {
  id: string;
  type: EsocialAlertType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  tenant_id: string | null;   // null = platform-wide
  company_id: string | null;
  metadata: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

// ── SuperAdmin KPIs ──

export interface EsocialPlatformKPIs {
  tenants_total: number;
  tenants_em_dia: number;
  tenants_com_pendencias: number;
  tenants_bloqueados: number;
  eventos_enviados_mes: number;
  eventos_rejeitados_mes: number;
  taxa_sucesso: number;           // 0-100
  layout_vigente: EsocialLayoutVersion;
  proxima_mudanca_layout: EsocialLayoutInfo | null;
  alertas_ativos: number;
  alertas_criticos: number;
}

// ── Global System Status ──

export type EsocialWebserviceStatus = 'online' | 'offline' | 'degradado' | 'manutencao';

export interface EsocialSystemStatus {
  layout_atual_suportado: EsocialLayoutVersion;
  layout_vigente_oficial: EsocialLayoutVersion;
  data_ultima_verificacao: string;
  status_webservice: EsocialWebserviceStatus;
  compatibilidade: boolean;
}

// ── Layout Mismatch ──

export interface LayoutMismatchInfo {
  versao_suportada: EsocialLayoutVersion;
  versao_oficial: EsocialLayoutVersion;
  empresas_nao_migradas: Array<{ company_id: string; company_name: string; layout_atual: EsocialLayoutVersion }>;
  total_nao_migradas: number;
  detectado_em: string;
}

// ── Governance Config ──

export interface EsocialGovernanceConfig {
  layout_auto_update: boolean;
  alert_on_layout_change: boolean;
  alert_days_before_deadline: number;
  auto_retry_rejected_events: boolean;
  max_retry_attempts: number;
  notification_channels: ('in_app' | 'email' | 'webhook')[];
}

// ── Error Analytics ──

export interface ESocialErrorCode {
  codigo: string;
  descricao: string;
  ocorrencias: number;
  ultimo_registro: string;
}

export interface ESocialRejeicaoPorEvento {
  evento_tipo: string;
  total_rejeitados: number;
  codigos_erro: string[];
}

export interface ESocialEmpresaFalha {
  company_id: string;
  company_name: string;
  total_erros: number;
  taxa_falha: number; // 0-100
  erros_principais: string[];
}

export interface ESocialErrorInsight {
  periodo: string;
  erros_recorrentes: ESocialErrorCode[];
  rejeicoes_por_evento: ESocialRejeicaoPorEvento[];
  empresas_alta_falha: ESocialEmpresaFalha[];
  total_erros_periodo: number;
  erro_mais_frequente: string;
  recomendacoes: string[];
}

// ── Client Communication Engine ──

export type ClientCommTrigger = 'layout_change' | 'critical_error' | 'new_obligation';

export interface ClientCommAction {
  tipo: 'notificacao_sistema' | 'alerta_dashboard' | 'recomendacao_legal_ai';
  titulo: string;
  mensagem: string;
  destinatario_tenant_id: string | null;
  destinatario_company_id: string | null;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  metadata: Record<string, unknown>;
  gerado_em: string;
}

export interface ClientCommResult {
  trigger: ClientCommTrigger;
  trigger_description: string;
  acoes_geradas: ClientCommAction[];
  total_notificacoes: number;
  total_alertas_dashboard: number;
  total_recomendacoes_legal_ai: number;
}
