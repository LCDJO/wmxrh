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

// ── Governance Config ──

export interface EsocialGovernanceConfig {
  layout_auto_update: boolean;
  alert_on_layout_change: boolean;
  alert_days_before_deadline: number;
  auto_retry_rejected_events: boolean;
  max_retry_attempts: number;
  notification_channels: ('in_app' | 'email' | 'webhook')[];
}
