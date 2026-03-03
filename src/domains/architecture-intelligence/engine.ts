/**
 * Architecture Intelligence Engine
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ArchitectureIntelligenceEngine                              ║
 * ║   ├── ModuleRegistry            ← unified module inventory   ║
 * ║   ├── DependencyGraphVisualizer ← dependency edges           ║
 * ║   ├── ModuleHealthMonitor       ← ObservabilityCore bridge   ║
 * ║   ├── EventMappingService       ← all kernel events map      ║
 * ║   ├── DocumentationManager      ← living docs per module     ║
 * ║   ├── DeliverableTracker        ← expected deliverables      ║
 * ║   └── ArchitectureVersionTracker← structural change log      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { PLATFORM_MODULES } from '@/domains/platform/platform-modules';
import { MODULE_CATALOG } from '@/domains/platform-versioning/module-catalog';
import { getHealthMonitor } from '@/domains/observability/health-monitor';
import { OBSERVABILITY_KERNEL_EVENTS } from '@/domains/observability/observability-events';
import { INCIDENT_KERNEL_EVENTS } from '@/domains/incident-management/incident-events';
import { GOVERNANCE_KERNEL_EVENTS } from '@/domains/platform-policy-governance/governance-events';
import { BCDR_KERNEL_EVENTS } from '@/domains/bcdr/bcdr-events';
import { WHITELABEL_KERNEL_EVENTS } from '@/domains/whitelabel/whitelabel-events';
import { CHAOS_KERNEL_EVENTS } from '@/domains/chaos-engineering/chaos-events';
import { FEDERATION_KERNEL_EVENTS } from '@/domains/security/federation/federation-events';
import { AUTOMATION_KERNEL_EVENTS } from '@/domains/integration-automation/automation-events';

import type {
  ArchitectureIntelligenceEngineAPI,
  ArchModuleInfo,
  ArchEventMapping,
  ArchDeliverable,
  ArchDocEntry,
  ArchVersionEntry,
  DependencyEdge,
  ModuleMonitoringMetric,
  ModuleSLA,
} from './types';

// ── Default SLA ──

const DEFAULT_SLA: ModuleSLA = { uptime_target: '99.9%', response_time_p95_ms: 500, tier: 'standard' };

const MODULE_SLA: Record<string, ModuleSLA> = {
  iam:            { uptime_target: '99.99%', response_time_p95_ms: 100, rto_minutes: 5,  rpo_minutes: 0,  tier: 'critical' },
  billing:        { uptime_target: '99.95%', response_time_p95_ms: 300, rto_minutes: 15, rpo_minutes: 5,  tier: 'critical' },
  observability:  { uptime_target: '99.95%', response_time_p95_ms: 200, rto_minutes: 10, rpo_minutes: 1,  tier: 'critical' },
  core_hr:        { uptime_target: '99.9%',  response_time_p95_ms: 400, rto_minutes: 30, rpo_minutes: 15, tier: 'high' },
  esocial:        { uptime_target: '99.9%',  response_time_p95_ms: 500, rto_minutes: 60, rpo_minutes: 30, tier: 'high' },
  compliance:     { uptime_target: '99.9%',  response_time_p95_ms: 400, rto_minutes: 30, rpo_minutes: 15, tier: 'high' },
  automation:     { uptime_target: '99.95%', response_time_p95_ms: 250, rto_minutes: 15, rpo_minutes: 5,  tier: 'critical' },
  tenant_admin:   { uptime_target: '99.9%',  response_time_p95_ms: 300, rto_minutes: 30, rpo_minutes: 15, tier: 'high' },
  support_module: { uptime_target: '99.9%',  response_time_p95_ms: 400, rto_minutes: 30, rpo_minutes: 15, tier: 'high' },
};

// ── Architecture Descriptions ──

const MODULE_ARCHITECTURE: Record<string, string> = {
  iam: 'Security Kernel com pipeline de 7 camadas (RequestID → Identity → Auth → ScopeGuard → RateLimit → Audit → Validation). RBAC + ABAC híbrido com O(1) Access Graph, federation SAML/OIDC e rotação automática de chaves.',
  billing: 'Engine de faturamento com subscription lifecycle, usage-based metering, invoice generation, coupon engine e integração fiscal. Suporta planos compostos com módulos ativáveis por feature flag.',
  observability: 'ObservabilityCore com MetricsCollector (Prometheus), HealthMonitor, ErrorTracker, PerformanceProfiler, LogStreamAdapter e GrafanaIntegrationAdapter (Prometheus + Loki + Tempo). Inclui BCDR, Incident Management e Chaos Engineering.',
  core_hr: 'Gestão hierárquica de colaboradores, cargos, departamentos e organograma. Integração com admissão, movimentação e desligamento. Dados isolados por tenant com RLS.',
  esocial: 'Motor de geração e transmissão de eventos eSocial (S-2200, S-2206, S-2299, etc.) com validação de layout, certificado digital e governança de conformidade por tenant.',
  compliance: 'Framework de compliance trabalhista com governança de termos (event sourcing), WorkTime engine (clock entries, geolocalização, biometria, fraude) e auditoria contínua.',
  automation: 'Integration Automation Engine com workflow DAG, triggers baseados em eventos, connectors modulares e execução assíncrona com retry e dead-letter queue.',
  tenant_admin: 'Administração multi-tenant com convites, papéis, configurações e toggles de módulos. Inclui WhiteLabel Branding Engine com versionamento, fallback e controle por plano.',
  support_module: 'Módulo versionado v2 com duas camadas: Tenant App (chat, wiki, FAQ) e Platform Console (analytics, SLA, routing). LiveSupportEngine com WebSocket e ConversationAnalytics.',
  growth: 'Growth Engine com A/B testing, conversion tracking, FAB Builder, Landing Page Builder com versionamento e AI Designer para geração de templates.',
  fleet_traccar: 'Integração Traccar para rastreamento GPS, geofencing, compliance de frota e políticas disciplinares. Camada Platform fornece catálogo regulatório; Tenant armazena dados operacionais.',
  analytics: 'Pipeline de analytics com dashboards, relatórios, detecção de anomalias e exportação. Métricas agregadas por tenant com projeções de workforce intelligence.',
};


// ── Module Owners ──

const MODULE_OWNERS: Record<string, string> = {
  iam: 'security-team',
  billing: 'finance-team',
  observability: 'sre-team',
  automation: 'platform-team',
  core_hr: 'hr-product-team',
  esocial: 'compliance-team',
  compliance: 'compliance-team',
  support_module: 'cx-team',
  growth: 'growth-team',
  landing_engine: 'growth-team',
  website_engine: 'growth-team',
  fleet_traccar: 'ops-team',
  tenant_admin: 'platform-team',
  analytics: 'data-team',
  ads: 'marketing-team',
};

// ── Module Monitoring Metrics ──

const MODULE_METRICS: Record<string, ModuleMonitoringMetric[]> = {
  iam: [
    { metric_name: 'iam_auth_requests_total', type: 'counter', description: 'Total de requisições de autenticação' },
    { metric_name: 'iam_active_sessions', type: 'gauge', description: 'Sessões ativas no momento' },
  ],
  billing: [
    { metric_name: 'billing_invoices_generated_total', type: 'counter', description: 'Faturas geradas' },
    { metric_name: 'billing_mrr_brl', type: 'gauge', description: 'MRR atual em BRL' },
  ],
  observability: [
    { metric_name: 'obs_health_checks_total', type: 'counter', description: 'Health checks executados' },
    { metric_name: 'obs_error_rate', type: 'gauge', description: 'Taxa de erros atual' },
  ],
  core_hr: [
    { metric_name: 'corehr_employees_active', type: 'gauge', description: 'Colaboradores ativos' },
    { metric_name: 'corehr_admissions_total', type: 'counter', description: 'Admissões processadas' },
  ],
};

// ── Event Registry (all kernel events flattened) ──

function buildEventMap(): ArchEventMapping[] {
  const maps: ArchEventMapping[] = [];

  const register = (domain: string, events: Record<string, string>) => {
    for (const [name, value] of Object.entries(events)) {
      maps.push({ event_name: value, domain, description: name, payload_type: `${name}Payload` });
    }
  };

  register('observability', OBSERVABILITY_KERNEL_EVENTS as unknown as Record<string, string>);
  register('incident', INCIDENT_KERNEL_EVENTS as unknown as Record<string, string>);
  register('governance', GOVERNANCE_KERNEL_EVENTS as unknown as Record<string, string>);
  register('bcdr', BCDR_KERNEL_EVENTS as unknown as Record<string, string>);
  register('whitelabel', WHITELABEL_KERNEL_EVENTS as unknown as Record<string, string>);
  register('chaos', CHAOS_KERNEL_EVENTS as unknown as Record<string, string>);
  register('federation', FEDERATION_KERNEL_EVENTS as unknown as Record<string, string>);
  register('automation', AUTOMATION_KERNEL_EVENTS as unknown as Record<string, string>);

  return maps;
}

// ── Deliverables (canonical list) ──

const PLATFORM_DELIVERABLES: ArchDeliverable[] = [
  { id: 'd-iam', title: 'IAM + RBAC + SoD', status: 'done', module_key: 'iam', description: 'Gestão de identidade, papéis e segregação de funções' },
  { id: 'd-billing', title: 'Billing & Subscription', status: 'done', module_key: 'billing', description: 'Planos SaaS, faturas, cupons, cobrança baseada em uso' },
  { id: 'd-observability', title: 'Observability + Grafana', status: 'done', module_key: 'observability', description: 'Métricas Prometheus, health monitoring, log streaming' },
  { id: 'd-federation', title: 'Identity Federation (SAML/OIDC)', status: 'done', module_key: 'iam', description: 'SAML 2.0, OIDC, OAuth2, key rotation' },
  { id: 'd-whitelabel', title: 'WhiteLabel Branding Engine', status: 'done', module_key: 'tenant_admin', description: 'Branding por tenant, fallback, controle por plano' },
  { id: 'd-governance', title: 'Policy & Terms Governance', status: 'done', module_key: 'compliance', description: 'Versionamento jurídico imutável, event sourcing' },
  { id: 'd-bcdr', title: 'BCDR & Disaster Recovery', status: 'done', module_key: 'observability', description: 'Backup, failover, DR tests, region health' },
  { id: 'd-incidents', title: 'Incident Management', status: 'done', module_key: 'observability', description: 'SLA, MTTR, status page, runbooks' },
  { id: 'd-chaos', title: 'Chaos Engineering', status: 'done', module_key: 'observability', description: 'Cenários, execuções, blast radius, relatórios' },
  { id: 'd-automation', title: 'Integration Automation Engine', status: 'done', module_key: 'automation', description: 'Workflows, triggers, connectors' },
  { id: 'd-corehr', title: 'Core HR', status: 'done', module_key: 'core_hr', description: 'Colaboradores, cargos, departamentos, organograma' },
  { id: 'd-esocial', title: 'eSocial Compliance', status: 'done', module_key: 'esocial', description: 'Geração e transmissão de eventos eSocial' },
  { id: 'd-support', title: 'Support Module v2', status: 'done', module_key: 'support_module', description: 'Chat ao vivo, wiki, analytics, platform console' },
  { id: 'd-api', title: 'API Gateway & Developer Portal', status: 'done', module_key: 'iam', description: 'Rate limiting, scopes, versioning, marketplace' },
  { id: 'd-growth', title: 'Growth & Landing Engine', status: 'done', module_key: 'growth', description: 'A/B testing, conversões, FAB builder' },
  { id: 'd-fleet', title: 'Fleet Tracking (Traccar)', status: 'done', module_key: 'fleet_traccar', description: 'GPS, geofencing, compliance de frota' },
  { id: 'd-worktime', title: 'WorkTime Compliance Engine', status: 'done', module_key: 'compliance', description: 'Clock entries, geolocalização, fraude, biometria' },
  { id: 'd-archint', title: 'Architecture Intelligence Center', status: 'done', module_key: 'observability', description: 'Visão arquitetural, dependências, eventos, documentação viva' },
];

// ── Architecture Versions ──

const ARCHITECTURE_VERSIONS: ArchVersionEntry[] = [
  {
    version_tag: 'v1.0.0',
    date: '2026-01-15',
    structural_changes: ['Platform Bootstrap', 'Core HR', 'IAM + RBAC', 'Billing SaaS', 'eSocial'],
    impacted_modules: ['core_hr', 'iam', 'billing', 'esocial', 'compliance'],
  },
  {
    version_tag: 'v2.0.0',
    date: '2026-02-01',
    structural_changes: ['Observability Core', 'Control Plane', 'BCDR', 'Incident Management', 'Chaos Engineering'],
    impacted_modules: ['observability', 'automation'],
  },
  {
    version_tag: 'v3.0.0',
    date: '2026-02-15',
    structural_changes: ['Growth Engine', 'Landing Builder', 'A/B Testing', 'FAB Builder', 'Website Engine'],
    impacted_modules: ['growth', 'landing_engine', 'website_engine', 'ads'],
  },
  {
    version_tag: 'v4.0.0',
    date: '2026-03-01',
    structural_changes: ['Identity Federation (SAML/OIDC)', 'API Gateway', 'Developer Portal', 'Marketplace', 'Integration Automation'],
    impacted_modules: ['iam', 'automation'],
  },
  {
    version_tag: 'v5.0.0',
    date: '2026-03-03',
    structural_changes: ['WhiteLabel Branding Engine', 'Architecture Intelligence Center', 'WorkTime Compliance', 'Biometric AI'],
    impacted_modules: ['tenant_admin', 'observability', 'compliance'],
  },
];

// ── Living Docs ──

const LIVING_DOCS: ArchDocEntry[] = [
  {
    id: 'doc-arch-overview',
    title: 'Visão Geral da Arquitetura',
    module_key: '__platform__',
    content_md: `# Arquitetura da Plataforma\n\nA plataforma é dividida em duas camadas:\n\n- **Platform (SaaS Core)**: Serviços globais — IAM, Billing, Observability, Control Plane\n- **Tenant (Isolado)**: Dados e regras por cliente — RH, Compliance, Frota\n\nComunicação: Platform → Tenant via eventos; Tenant → Platform via consultas read-only.`,
    updated_at: '2026-03-03',
  },
  {
    id: 'doc-security',
    title: 'Security Framework',
    module_key: 'iam',
    content_md: `# Security Kernel\n\n7-layer middleware pipeline:\n1. RequestID\n2. Identity\n3. Auth\n4. ScopeGuard\n5. RateLimit\n6. Audit\n7. Validation\n\nO(1) Access Graph com RBAC + ABAC híbrido.`,
    updated_at: '2026-03-03',
  },
  {
    id: 'doc-observability',
    title: 'Observability Core',
    module_key: 'observability',
    content_md: `# ObservabilityCore\n\n- MetricsCollector (Prometheus)\n- HealthMonitor\n- ErrorTracker\n- PerformanceProfiler\n- LogStreamAdapter\n- GrafanaIntegrationAdapter (Prometheus + Loki + Tempo)`,
    updated_at: '2026-03-03',
  },
  {
    id: 'doc-whitelabel',
    title: 'WhiteLabel Engine',
    module_key: 'tenant_admin',
    content_md: `# TenantBrandingEngine\n\n- BrandingProfileManager (CRUD + cache)\n- ThemeGenerator (HSL + dark mode)\n- ReportTemplateCustomizer\n- WhiteLabelValidator (XSS protection)\n- BrandingVersionManager\n- DefaultFallbackResolver\n- PlanGate (controle por plano)`,
    updated_at: '2026-03-03',
  },
];

// ── Engine Factory ──

export function createArchitectureIntelligenceEngine(): ArchitectureIntelligenceEngineAPI {
  const eventMap = buildEventMap();

  const getModules = (): ArchModuleInfo[] => {
    const healthMonitor = getHealthMonitor();
    const healthSummary = healthMonitor.getSummary();

    return PLATFORM_MODULES.map((mod) => {
      const catalogEntry = MODULE_CATALOG.find(c => c.module_id === mod.key);
      const healthStatus = healthSummary.modules?.find((m: any) => m.id === mod.key);
      const modEvents = eventMap.filter(e => e.domain === mod.key || e.event_name.startsWith(mod.key));
      const modDeliverables = PLATFORM_DELIVERABLES.filter(d => d.module_key === mod.key);
      const modDocs = LIVING_DOCS.filter(d => d.module_key === mod.key);
      const domainMapped: 'saas' | 'tenant' = mod.category === 'platform' ? 'saas' : 'tenant';

      return {
        // ── Canonical PlatformModule fields ──
        key: mod.key,
        label: mod.label,
        domain: domainMapped,
        description: mod.description,
        lifecycle_status: 'stable' as const,
        version: catalogEntry?.initial_version ?? { major: 1, minor: 0, patch: 0 },
        version_tag: catalogEntry
          ? `v${catalogEntry.initial_version.major}.${catalogEntry.initial_version.minor}.${catalogEntry.initial_version.patch}`
          : 'v1.0.0',
        dependencies: catalogEntry?.dependencies ?? [],
        emits_events: modEvents,
        consumes_events: [] as ArchEventMapping[],
        monitoring_metrics: MODULE_METRICS[mod.key] ?? [],
        expected_deliverables: modDeliverables,
        docs: modDocs,
        owner: MODULE_OWNERS[mod.key] ?? 'platform-team',
        last_updated: '2026-03-03',
        changelog_summary: catalogEntry?.changelog_summary ?? '',
        sla: MODULE_SLA[mod.key] ?? DEFAULT_SLA,
        architecture_description: MODULE_ARCHITECTURE[mod.key] ?? `Módulo ${mod.label} — implementação padrão com isolamento por tenant e RLS.`,

        // ── Compat aliases ──
        category: mod.category,
        status: healthStatus?.status ?? 'unknown',
        events: modEvents,
        deliverables: modDeliverables,
      };
    });
  };

  return {
    getModules,
    getModule: (key) => getModules().find(m => m.key === key) ?? null,
    getDependencyEdges: () => {
      const edges: DependencyEdge[] = [];
      for (const entry of MODULE_CATALOG) {
        for (const dep of entry.dependencies) {
          edges.push({
            from: entry.module_id,
            to: dep.required_module_id,
            is_mandatory: dep.is_mandatory ?? true,
            note: dep.compatibility_note,
          });
        }
      }
      return edges;
    },
    getEventMap: () => eventMap,
    getDeliverables: () => PLATFORM_DELIVERABLES,
    getDocs: () => LIVING_DOCS,
    getVersionHistory: () => ARCHITECTURE_VERSIONS,
  };
}
