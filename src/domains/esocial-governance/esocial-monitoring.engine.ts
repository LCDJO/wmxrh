/**
 * eSocial Governance — Monitoring Engine
 *
 * Core logic for layout tracking, tenant status aggregation,
 * and alert generation. Integrates with:
 *  - Government Integration Gateway (layout versions)
 *  - eSocial Integration Engine (event status)
 *  - Regulatory Intelligence (norm changes)
 *  - Security Kernel (access control)
 */

import type {
  EsocialPlatformKPIs,
  EsocialTenantOverview,
  EsocialLayoutInfo,
  EsocialAlert,
  EsocialAlertType,
  EsocialGovernanceConfig,
  EsocialSystemStatus,
  TenantESocialStatus,
  CompanyESocialStatus,
  LayoutMismatchInfo,
  CertificateInfo,
  CertificateMonitorResult,
  ESocialErrorInsight,
} from './types';
import { emitEsocialGovEvent, esocialGovernanceEvents } from './esocial-governance.events';

// ── Default Config ──

const DEFAULT_CONFIG: EsocialGovernanceConfig = {
  layout_auto_update: true,
  alert_on_layout_change: true,
  alert_days_before_deadline: 15,
  auto_retry_rejected_events: true,
  max_retry_attempts: 3,
  notification_channels: ['in_app', 'email'],
};

// ── Demo Data (will be replaced by real queries) ──

const DEMO_LAYOUTS: EsocialLayoutInfo[] = [
  {
    versao: 'S-1.2',
    data_inicio_obrigatoriedade: '2025-01-01',
    data_fim_obrigatoriedade: '2026-05-31',
    status: 'vigente',
    changelog_url: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica',
    eventos_alterados: ['S-2240', 'S-1200', 'S-1210'],
  },
  {
    versao: 'S-1.3',
    data_inicio_obrigatoriedade: '2026-06-01',
    data_fim_obrigatoriedade: null,
    status: 'futuro',
    changelog_url: null,
    eventos_alterados: ['S-2210', 'S-2220', 'S-2240', 'S-1000', 'S-1200'],
  },
];

const DEMO_TENANT_OVERVIEWS: EsocialTenantOverview[] = [
  {
    tenant_id: 't1', tenant_name: 'Grupo Alpha', status: 'em_dia',
    layout_version: 'S-1.2', empresas_total: 5, empresas_em_dia: 5,
    empresas_pendentes: 0, empresas_bloqueadas: 0,
    eventos_pendentes: 0, eventos_rejeitados: 0,
    ultimo_envio: '2026-02-19T14:30:00Z', proximo_prazo: '2026-03-07',
  },
  {
    tenant_id: 't2', tenant_name: 'Construtora Beta', status: 'pendencias_criticas',
    layout_version: 'S-1.2', empresas_total: 3, empresas_em_dia: 1,
    empresas_pendentes: 1, empresas_bloqueadas: 1,
    eventos_pendentes: 24, eventos_rejeitados: 8,
    ultimo_envio: '2026-02-10T09:00:00Z', proximo_prazo: '2026-02-25',
  },
  {
    tenant_id: 't3', tenant_name: 'Tech Solutions', status: 'pendencias_menores',
    layout_version: 'S-1.2', empresas_total: 2, empresas_em_dia: 1,
    empresas_pendentes: 1, empresas_bloqueadas: 0,
    eventos_pendentes: 3, eventos_rejeitados: 1,
    ultimo_envio: '2026-02-18T16:45:00Z', proximo_prazo: '2026-03-07',
  },
  {
    tenant_id: 't4', tenant_name: 'Logística Delta', status: 'nao_configurado',
    layout_version: 'S-1.2', empresas_total: 4, empresas_em_dia: 0,
    empresas_pendentes: 0, empresas_bloqueadas: 0,
    eventos_pendentes: 0, eventos_rejeitados: 0,
    ultimo_envio: null, proximo_prazo: null,
  },
];

const DEMO_ALERTS: EsocialAlert[] = [
  {
    id: 'a1', type: 'LAYOUT_CHANGE', severity: 'warning',
    title: 'Layout S-1.3 publicado', description: 'Nova versão do layout eSocial será obrigatória a partir de 01/06/2026.',
    tenant_id: null, company_id: null, metadata: { versao: 'S-1.3' },
    resolved: false, created_at: '2026-02-15T10:00:00Z', resolved_at: null,
  },
  {
    id: 'a2', type: 'EVENT_REJECTED', severity: 'critical',
    title: '8 eventos rejeitados — Construtora Beta', description: 'Eventos S-2240 rejeitados por inconsistência cadastral.',
    tenant_id: 't2', company_id: 'c3', metadata: { evento: 'S-2240', qtd: 8 },
    resolved: false, created_at: '2026-02-18T08:30:00Z', resolved_at: null,
  },
  {
    id: 'a3', type: 'DEADLINE_APPROACHING', severity: 'warning',
    title: 'Prazo SST em 5 dias — Construtora Beta', description: 'Eventos S-2210/S-2220 devem ser enviados até 25/02.',
    tenant_id: 't2', company_id: null, metadata: { prazo: '2026-02-25' },
    resolved: false, created_at: '2026-02-20T07:00:00Z', resolved_at: null,
  },
];

// ── Engine Functions ──

/** Get global eSocial system status. */
export function getSystemStatus(): EsocialSystemStatus {
  const current = getCurrentLayout();
  return {
    layout_atual_suportado: current.versao,
    layout_vigente_oficial: 'S-1.2',
    data_ultima_verificacao: new Date().toISOString(),
    status_webservice: 'online',
    compatibilidade: current.versao === 'S-1.2',
  };
}

/** Get current governance config. */
export function getGovernanceConfig(): EsocialGovernanceConfig {
  return { ...DEFAULT_CONFIG };
}

/** Get all tracked layout versions. */
export function getLayoutVersions(): EsocialLayoutInfo[] {
  return DEMO_LAYOUTS;
}

/** Get current (vigente) layout. */
export function getCurrentLayout(): EsocialLayoutInfo {
  return DEMO_LAYOUTS.find(l => l.status === 'vigente') ?? DEMO_LAYOUTS[0];
}

/** Get upcoming layout change (if any). */
export function getUpcomingLayoutChange(): EsocialLayoutInfo | null {
  return DEMO_LAYOUTS.find(l => l.status === 'futuro') ?? null;
}

/** Get platform-wide KPIs for SuperAdmin. */
export function getPlatformKPIs(): EsocialPlatformKPIs {
  const overviews = DEMO_TENANT_OVERVIEWS;
  const current = getCurrentLayout();
  const upcoming = getUpcomingLayoutChange();
  const activeAlerts = DEMO_ALERTS.filter(a => !a.resolved);

  const totalEventos = overviews.reduce((s, t) => s + (t.eventos_pendentes + 50), 0); // simulated sent
  const totalRejected = overviews.reduce((s, t) => s + t.eventos_rejeitados, 0);

  return {
    tenants_total: overviews.length,
    tenants_em_dia: overviews.filter(t => t.status === 'em_dia').length,
    tenants_com_pendencias: overviews.filter(t => ['pendencias_menores', 'pendencias_criticas'].includes(t.status)).length,
    tenants_bloqueados: overviews.filter(t => t.status === 'bloqueado').length,
    eventos_enviados_mes: totalEventos,
    eventos_rejeitados_mes: totalRejected,
    taxa_sucesso: totalEventos > 0 ? Math.round(((totalEventos - totalRejected) / totalEventos) * 100) : 100,
    layout_vigente: current.versao,
    proxima_mudanca_layout: upcoming,
    alertas_ativos: activeAlerts.length,
    alertas_criticos: activeAlerts.filter(a => a.severity === 'critical').length,
  };
}

/** Get tenant overviews for the monitoring table. */
export function getTenantOverviews(): EsocialTenantOverview[] {
  return DEMO_TENANT_OVERVIEWS;
}

/** Get eSocial status for a specific tenant. */
export function getTenantESocialStatus(tenantId: string): TenantESocialStatus {
  const tenant = DEMO_TENANT_OVERVIEWS.find(t => t.tenant_id === tenantId);
  if (!tenant) {
    return {
      tenant_id: tenantId,
      empresas_integradas: 0,
      empresas_com_erro: 0,
      eventos_pendentes: 0,
      eventos_rejeitados: 0,
      certificado_valido: false,
      validade_certificado: null,
    };
  }
  return {
    tenant_id: tenant.tenant_id,
    empresas_integradas: tenant.empresas_em_dia,
    empresas_com_erro: tenant.empresas_pendentes + tenant.empresas_bloqueadas,
    eventos_pendentes: tenant.eventos_pendentes,
    eventos_rejeitados: tenant.eventos_rejeitados,
    certificado_valido: tenant.status !== 'nao_configurado',
    validade_certificado: tenant.status !== 'nao_configurado' ? '2027-06-15T00:00:00Z' : null,
  };
}

/** Get active alerts. */
export function getActiveAlerts(): EsocialAlert[] {
  return DEMO_ALERTS.filter(a => !a.resolved);
}

/** Get eSocial status for a specific company (stub). */
export function getCompanyESocialStatus(companyId: string): CompanyESocialStatus {
  return {
    company_id: companyId,
    eventos_enviados: 42,
    eventos_pendentes: 3,
    eventos_rejeitados: 1,
    ultimo_protocolo: '1.2.2026.0000012345',
    certificado_status: 'valido',
    layout_utilizado: 'S-1.2',
  };
}

/** Generate alert (stub — will emit events for notification system). */
export function generateAlert(
  type: EsocialAlertType,
  severity: EsocialAlert['severity'],
  title: string,
  description: string,
  tenantId?: string,
  companyId?: string,
): EsocialAlert {
  const alert: EsocialAlert = {
    id: crypto.randomUUID(),
    type, severity, title, description,
    tenant_id: tenantId ?? null,
    company_id: companyId ?? null,
    metadata: {},
    resolved: false,
    created_at: new Date().toISOString(),
    resolved_at: null,
  };

  emitEsocialGovEvent(esocialGovernanceEvents.ALERT_GENERATED, alert);
  return alert;
}

/** Detect layout mismatch — compares supported vs official and lists non-migrated companies. */
export function detectLayoutMismatch(): LayoutMismatchInfo | null {
  const system = getSystemStatus();
  if (system.compatibilidade) return null;

  const empresasNaoMigradas = [
    { company_id: 'c1', company_name: 'Filial Norte', layout_atual: 'S-1.1' as string },
    { company_id: 'c2', company_name: 'Filial Sul', layout_atual: 'S-1.1' as string },
  ];

  const mismatch: LayoutMismatchInfo = {
    versao_suportada: system.layout_atual_suportado,
    versao_oficial: system.layout_vigente_oficial,
    empresas_nao_migradas: empresasNaoMigradas,
    total_nao_migradas: empresasNaoMigradas.length,
    detectado_em: new Date().toISOString(),
  };

  emitEsocialGovEvent(esocialGovernanceEvents.LAYOUT_MISMATCH_DETECTED, mismatch);
  return mismatch;
}

// ── Certificate Monitor ──

const DEMO_CERTIFICATES: CertificateInfo[] = [
  { company_id: 'c1', company_name: 'Alpha Matriz', tipo: 'A1', status: 'valido', validade: '2027-06-15T00:00:00Z', dias_restantes: 480, serial_number: 'A1-00123', emitido_por: 'AC Certisign' },
  { company_id: 'c2', company_name: 'Beta Filial SP', tipo: 'A1', status: 'expirando', validade: '2026-03-18T00:00:00Z', dias_restantes: 26, serial_number: 'A1-00456', emitido_por: 'AC Serasa' },
  { company_id: 'c3', company_name: 'Beta Filial RJ', tipo: 'A3', status: 'expirado', validade: '2026-01-10T00:00:00Z', dias_restantes: -41, serial_number: 'A3-00789', emitido_por: 'AC Valid' },
  { company_id: 'c4', company_name: 'Delta Logística', tipo: 'A1', status: 'nao_configurado', validade: null, dias_restantes: null, serial_number: null, emitido_por: null },
];

/** Run certificate monitoring and generate alerts for expiring/expired/invalid certs. */
export function runCertificateMonitor(): CertificateMonitorResult {
  let alertasGerados = 0;

  for (const cert of DEMO_CERTIFICATES) {
    if (cert.status === 'expirando') {
      emitEsocialGovEvent(esocialGovernanceEvents.CERTIFICATE_EXPIRING, cert);
      generateAlert('COMPLIANCE_GAP', 'warning',
        `Certificado ${cert.tipo} expirando — ${cert.company_name}`,
        `Certificado expira em ${cert.dias_restantes} dias (${cert.validade}). Renove antes do vencimento.`,
        undefined, cert.company_id);
      alertasGerados++;
    } else if (cert.status === 'expirado') {
      emitEsocialGovEvent(esocialGovernanceEvents.CERTIFICATE_EXPIRED, cert);
      generateAlert('COMPLIANCE_GAP', 'critical',
        `Certificado ${cert.tipo} expirado — ${cert.company_name}`,
        `Certificado expirou em ${cert.validade}. Transmissão eSocial bloqueada.`,
        undefined, cert.company_id);
      alertasGerados++;
    } else if (cert.status === 'nao_configurado') {
      emitEsocialGovEvent(esocialGovernanceEvents.CERTIFICATE_INVALID, cert);
      alertasGerados++;
    }
  }

  const validos = DEMO_CERTIFICATES.filter(c => c.status === 'valido').length;
  const expirando = DEMO_CERTIFICATES.filter(c => c.status === 'expirando').length;
  const expirados = DEMO_CERTIFICATES.filter(c => c.status === 'expirado').length;
  const naoConfig = DEMO_CERTIFICATES.filter(c => c.status === 'nao_configurado').length;

  return {
    total_certificados: DEMO_CERTIFICATES.length,
    validos, expirando, expirados, nao_configurados: naoConfig,
    certificados: DEMO_CERTIFICATES,
    alertas_gerados: alertasGerados,
  };
}

// ── Error Analytics ──

/** Analyze error patterns across events and companies. */
export function getErrorInsights(): ESocialErrorInsight {
  return {
    periodo: '2026-02',
    erros_recorrentes: [
      { codigo: '1001', descricao: 'CPF do trabalhador não encontrado na base CNIS', ocorrencias: 14, ultimo_registro: '2026-02-19T11:00:00Z' },
      { codigo: '2050', descricao: 'Código CBO incompatível com atividade CNAE', ocorrencias: 8, ultimo_registro: '2026-02-18T15:30:00Z' },
      { codigo: '3100', descricao: 'Data de admissão anterior ao início da obrigatoriedade', ocorrencias: 5, ultimo_registro: '2026-02-17T09:00:00Z' },
    ],
    rejeicoes_por_evento: [
      { evento_tipo: 'S-2240', total_rejeitados: 8, codigos_erro: ['1001', '2050'] },
      { evento_tipo: 'S-2200', total_rejeitados: 5, codigos_erro: ['1001', '3100'] },
      { evento_tipo: 'S-1200', total_rejeitados: 3, codigos_erro: ['2050'] },
    ],
    empresas_alta_falha: [
      { company_id: 'c3', company_name: 'Beta Filial RJ', total_erros: 12, taxa_falha: 45, erros_principais: ['1001', '2050'] },
      { company_id: 'c5', company_name: 'Gamma Matriz', total_erros: 6, taxa_falha: 30, erros_principais: ['3100'] },
    ],
    total_erros_periodo: 27,
    erro_mais_frequente: '1001',
    recomendacoes: [
      'Atualizar cadastro CPF/CNIS dos trabalhadores da Beta Filial RJ',
      'Revisar mapeamento CBO↔CNAE nas empresas com erro 2050',
      'Validar datas de admissão antes do envio do S-2200',
    ],
  };
}
