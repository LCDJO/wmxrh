/**
 * ══════════════════════════════════════════════════════════
 * PLATFORM LAYER — Global Parametrization
 * ══════════════════════════════════════════════════════════
 *
 * Global parameters controlled exclusively by the Platform:
 *
 *  · Engine activation (which engines are running)
 *  · Legislative update pipeline config
 *  · Feature flags (global toggles)
 *
 * These settings are NOT tenant-specific. They control
 * infrastructure-level behavior across all tenants.
 */

// ══════════════════════════════════════════════════════════
// ENGINE ACTIVATION REGISTRY
// ══════════════════════════════════════════════════════════

export type PlatformEngineKey =
  | 'regulatory_intelligence'
  | 'legal_ai_interpretation'
  | 'esocial_processor'
  | 'traccar_ingest'
  | 'behavioral_score'
  | 'accident_prediction'
  | 'workforce_intelligence'
  | 'safety_automation'
  | 'payroll_simulation'
  | 'governance_ai'
  | 'detran_integration'
  | 'fine_attribution';

export interface PlatformEngineConfig {
  key: PlatformEngineKey;
  name: string;
  description: string;
  enabled: boolean;
  /** Version currently deployed */
  version: string;
  /** Requires specific plan tier? */
  min_plan_tier: string | null;
  /** Whether this engine processes tenant data (as passthrough) */
  processes_tenant_data: boolean;
  /** Maintenance mode — engine paused but not disabled */
  maintenance: boolean;
  updated_at: string;
}

const DEFAULT_ENGINES: PlatformEngineConfig[] = [
  {
    key: 'regulatory_intelligence',
    name: 'Regulatory Intelligence Engine',
    description: 'Monitora NRs, CLT e CCTs com diff estrutural e hash FNV-1a',
    enabled: true,
    version: '1.0.0',
    min_plan_tier: null,
    processes_tenant_data: false,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'legal_ai_interpretation',
    name: 'Legal AI Interpretation Engine',
    description: 'Transforma mudanças legislativas em resumos executivos dual-layer',
    enabled: true,
    version: '1.0.0',
    min_plan_tier: 'pro',
    processes_tenant_data: false,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'esocial_processor',
    name: 'eSocial Processor',
    description: 'Gateway para envio e recepção de eventos eSocial',
    enabled: true,
    version: '1.0.0',
    min_plan_tier: null,
    processes_tenant_data: true,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'traccar_ingest',
    name: 'Traccar Ingest Engine',
    description: 'Recebe, normaliza e hasheia eventos GPS do Traccar',
    enabled: true,
    version: '1.0.0',
    min_plan_tier: null,
    processes_tenant_data: true,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'behavioral_score',
    name: 'Behavioral Score Engine',
    description: 'Calcula score comportamental 0-100 para motoristas',
    enabled: true,
    version: '1.0.0',
    min_plan_tier: null,
    processes_tenant_data: true,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'accident_prediction',
    name: 'Accident Prediction Layer',
    description: 'Predição heurística de risco de acidente',
    enabled: false,
    version: '0.1.0',
    min_plan_tier: 'enterprise',
    processes_tenant_data: true,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'workforce_intelligence',
    name: 'Workforce Intelligence',
    description: 'Analytics de workforce — headcount, turnover, risco',
    enabled: true,
    version: '1.0.0',
    min_plan_tier: 'pro',
    processes_tenant_data: true,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'safety_automation',
    name: 'Safety Automation Engine',
    description: 'Workflows automáticos de segurança — EPI, treinamentos, NR',
    enabled: true,
    version: '1.0.0',
    min_plan_tier: null,
    processes_tenant_data: true,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'payroll_simulation',
    name: 'Payroll Simulation Engine',
    description: 'Simulação de folha com suporte a CCT e encargos',
    enabled: true,
    version: '1.0.0',
    min_plan_tier: 'pro',
    processes_tenant_data: true,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'governance_ai',
    name: 'Governance AI',
    description: 'IA de governança — recomendações de compliance',
    enabled: true,
    version: '1.0.0',
    min_plan_tier: 'enterprise',
    processes_tenant_data: true,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'detran_integration',
    name: 'DETRAN Integration',
    description: 'Integração com DETRAN para consulta de CNH e veículos',
    enabled: false,
    version: '0.1.0',
    min_plan_tier: 'enterprise',
    processes_tenant_data: true,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'fine_attribution',
    name: 'Fine Attribution Engine',
    description: 'Atribuição automática de multas reais via dados de rastreamento',
    enabled: false,
    version: '0.1.0',
    min_plan_tier: 'enterprise',
    processes_tenant_data: true,
    maintenance: false,
    updated_at: new Date().toISOString(),
  },
];

// In-memory registry (Platform state)
let engineRegistry = [...DEFAULT_ENGINES];

export function getEngineRegistry(): ReadonlyArray<PlatformEngineConfig> {
  return engineRegistry;
}

export function isEngineEnabled(key: PlatformEngineKey): boolean {
  const engine = engineRegistry.find(e => e.key === key);
  return engine?.enabled === true && !engine.maintenance;
}

export function setEngineState(key: PlatformEngineKey, patch: Partial<Pick<PlatformEngineConfig, 'enabled' | 'maintenance' | 'version'>>): void {
  engineRegistry = engineRegistry.map(e =>
    e.key === key ? { ...e, ...patch, updated_at: new Date().toISOString() } : e
  );
}

// ══════════════════════════════════════════════════════════
// LEGISLATIVE UPDATE PIPELINE CONFIG
// ══════════════════════════════════════════════════════════

export type LegislativeAlertType =
  | 'LEGISLATION_UPDATED'
  | 'NR_UPDATED'
  | 'CCT_UPDATED'
  | 'ESOCIAL_LAYOUT_CHANGED';

export interface LegislativeUpdateConfig {
  /** Automatic monitoring enabled */
  auto_monitor: boolean;
  /** Check interval in hours */
  check_interval_hours: number;
  /** Sources to monitor */
  monitored_sources: LegislativeSource[];
  /** Alert routing by type */
  alert_routing: Record<LegislativeAlertType, LegislativeAlertRouting>;
  /** Generate AI interpretation automatically */
  auto_interpret: boolean;
  /** Minimum severity to trigger tenant notifications */
  min_severity_notify: 'info' | 'warning' | 'critical';
}

export interface LegislativeSource {
  key: string;
  name: string;
  url: string;
  enabled: boolean;
  parser: 'dou_parser' | 'esocial_layout' | 'nr_scraper' | 'cct_registry' | 'custom';
}

export interface LegislativeAlertRouting {
  notify_tenants: boolean;
  auto_update_rules: boolean;
  require_admin_review: boolean;
  channels: ('in_app' | 'email' | 'webhook')[];
}

const DEFAULT_LEGISLATIVE_CONFIG: LegislativeUpdateConfig = {
  auto_monitor: true,
  check_interval_hours: 6,
  monitored_sources: [
    { key: 'dou', name: 'Diário Oficial da União', url: 'https://www.in.gov.br', enabled: true, parser: 'dou_parser' },
    { key: 'esocial', name: 'Portal eSocial', url: 'https://www.gov.br/esocial', enabled: true, parser: 'esocial_layout' },
    { key: 'mtb_nr', name: 'NRs - MTE', url: 'https://www.gov.br/trabalho-e-emprego', enabled: true, parser: 'nr_scraper' },
  ],
  alert_routing: {
    LEGISLATION_UPDATED: { notify_tenants: true, auto_update_rules: false, require_admin_review: true, channels: ['in_app', 'email'] },
    NR_UPDATED: { notify_tenants: true, auto_update_rules: true, require_admin_review: false, channels: ['in_app', 'email', 'webhook'] },
    CCT_UPDATED: { notify_tenants: true, auto_update_rules: true, require_admin_review: false, channels: ['in_app'] },
    ESOCIAL_LAYOUT_CHANGED: { notify_tenants: true, auto_update_rules: true, require_admin_review: true, channels: ['in_app', 'email', 'webhook'] },
  },
  auto_interpret: true,
  min_severity_notify: 'warning',
};

let legislativeConfig = { ...DEFAULT_LEGISLATIVE_CONFIG };

export function getLegislativeConfig(): Readonly<LegislativeUpdateConfig> {
  return legislativeConfig;
}

export function updateLegislativeConfig(patch: Partial<LegislativeUpdateConfig>): void {
  legislativeConfig = { ...legislativeConfig, ...patch };
}

// ══════════════════════════════════════════════════════════
// GLOBAL FEATURE FLAGS
// ══════════════════════════════════════════════════════════

export interface PlatformFeatureFlag {
  key: string;
  name: string;
  enabled: boolean;
  /** Percentage rollout (0-100) */
  rollout_pct: number;
  /** Restrict to specific plan tiers */
  plan_tiers: string[] | null;
  /** Restrict to specific tenant IDs (for beta testing) */
  tenant_allowlist: string[] | null;
  description: string;
  updated_at: string;
}

const DEFAULT_FLAGS: PlatformFeatureFlag[] = [
  { key: 'fleet_module', name: 'Fleet Compliance Module', enabled: true, rollout_pct: 100, plan_tiers: null, tenant_allowlist: null, description: 'Módulo de compliance de frota', updated_at: new Date().toISOString() },
  { key: 'ai_interpretation', name: 'AI Legal Interpretation', enabled: true, rollout_pct: 100, plan_tiers: ['pro', 'enterprise'], tenant_allowlist: null, description: 'Interpretação AI de legislação', updated_at: new Date().toISOString() },
  { key: 'accident_prediction', name: 'Accident Prediction', enabled: false, rollout_pct: 0, plan_tiers: ['enterprise'], tenant_allowlist: null, description: 'Predição de acidentes por IA', updated_at: new Date().toISOString() },
  { key: 'detran_sync', name: 'DETRAN Sync', enabled: false, rollout_pct: 0, plan_tiers: ['enterprise'], tenant_allowlist: null, description: 'Sincronização com DETRAN', updated_at: new Date().toISOString() },
  { key: 'behavioral_score_v2', name: 'Behavioral Score v2', enabled: false, rollout_pct: 20, plan_tiers: null, tenant_allowlist: null, description: 'Score comportamental versão 2 com ML', updated_at: new Date().toISOString() },
  { key: 'pcmso_automation', name: 'PCMSO Automation', enabled: true, rollout_pct: 100, plan_tiers: null, tenant_allowlist: null, description: 'Automação de cronograma PCMSO', updated_at: new Date().toISOString() },
];

let featureFlags = [...DEFAULT_FLAGS];

export function getPlatformFlags(): ReadonlyArray<PlatformFeatureFlag> {
  return featureFlags;
}

export function isPlatformFlagEnabled(key: string, tenantId?: string, planTier?: string): boolean {
  const flag = featureFlags.find(f => f.key === key);
  if (!flag || !flag.enabled) return false;
  if (flag.plan_tiers && planTier && !flag.plan_tiers.includes(planTier)) return false;
  if (flag.tenant_allowlist && tenantId && !flag.tenant_allowlist.includes(tenantId)) return false;
  if (flag.rollout_pct < 100 && tenantId) {
    // Deterministic rollout based on tenant ID hash
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash = ((hash << 5) - hash + tenantId.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % 100) < flag.rollout_pct;
  }
  return true;
}

export function setPlatformFlag(key: string, patch: Partial<Pick<PlatformFeatureFlag, 'enabled' | 'rollout_pct' | 'plan_tiers' | 'tenant_allowlist'>>): void {
  featureFlags = featureFlags.map(f =>
    f.key === key ? { ...f, ...patch, updated_at: new Date().toISOString() } : f
  );
}
