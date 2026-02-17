/**
 * Domain Event Catalog — AUTO-AGGREGATED from all domain event files.
 *
 * To add new events to the catalog, simply add entries to the
 * DOMAIN_REGISTRIES array below. Each registry declares:
 *   - domain: display name
 *   - color: HSL color for the domain
 *   - events: array of { name, description }
 *
 * The "Atualizar" button on PlatformEvents calls `buildCatalog()` to
 * re-read this registry, so new events appear without any extra code.
 */

// ── Types ──────────────────────────────────────────────────────

export interface EventCatalogEntry {
  domain: string;
  domainColor: string;
  eventName: string;
  description: string;
}

interface DomainRegistry {
  domain: string;
  color: string;
  events: { name: string; description: string }[];
}

// ── Domain Registries ──────────────────────────────────────────
// Each domain declares its own events here.
// When you create new events in a domain file, add them to its registry.

const DOMAIN_REGISTRIES: DomainRegistry[] = [
  // ─── IAM ───
  {
    domain: 'IAM',
    color: 'hsl(200 70% 50%)',
    events: [
      { name: 'UserInvited', description: 'Novo membro convidado para o tenant' },
      { name: 'UserRoleAssigned', description: 'Role vinculada a um usuário + escopo' },
      { name: 'UserRoleRemoved', description: 'Role desvinculada do usuário' },
      { name: 'RolePermissionsUpdated', description: 'Conjunto de permissões alterado' },
      { name: 'AccessGraphRebuilt', description: 'Cache do grafo de acesso invalidado' },
    ],
  },

  // ─── Billing Core ───
  {
    domain: 'Billing',
    color: 'hsl(145 60% 42%)',
    events: [
      { name: 'TenantPlanAssigned', description: 'Plano atribuído ao tenant' },
      { name: 'TenantPlanUpgraded', description: 'Upgrade de plano realizado' },
      { name: 'InvoiceGenerated', description: 'Fatura gerada para o tenant' },
      { name: 'RevenueUpdated', description: 'Receita atualizada (MRR/ARR)' },
      { name: 'UsageRecorded', description: 'Uso registrado (métrica + quantidade)' },
      { name: 'CouponCreated', description: 'Cupom criado na plataforma' },
      { name: 'CouponRedeemed', description: 'Cupom resgatado por um tenant' },
      { name: 'InvoiceDiscountApplied', description: 'Desconto aplicado em fatura' },
      { name: 'UsageOverageCalculated', description: 'Excedente de uso calculado' },
    ],
  },

  // ─── Billing Future (Marketplace / Subscriptions) ───
  {
    domain: 'Billing Marketplace',
    color: 'hsl(150 55% 40%)',
    events: [
      { name: 'SubscriptionCreated', description: 'Assinatura criada' },
      { name: 'SubscriptionUpdated', description: 'Assinatura atualizada' },
      { name: 'SubscriptionCancelled', description: 'Assinatura cancelada' },
      { name: 'SubscriptionPastDue', description: 'Assinatura em atraso' },
      { name: 'PaymentSucceeded', description: 'Pagamento bem-sucedido' },
      { name: 'PaymentFailed', description: 'Falha no pagamento' },
      { name: 'RefundIssued', description: 'Reembolso emitido' },
      { name: 'ModuleInstalled', description: 'Módulo instalado via marketplace' },
      { name: 'ModuleUninstalled', description: 'Módulo desinstalado' },
      { name: 'ModuleLicenseExpired', description: 'Licença de módulo expirada' },
      { name: 'AddonSubscribed', description: 'Add-on contratado' },
      { name: 'AddonCancelled', description: 'Add-on cancelado' },
      { name: 'AddonExpired', description: 'Add-on expirado' },
      { name: 'UsageThresholdReached', description: 'Limite de uso atingido' },
      { name: 'UsageOverageDetected', description: 'Excedente de uso detectado' },
      { name: 'UsageReportGenerated', description: 'Relatório de uso gerado' },
    ],
  },

  // ─── Observability ───
  {
    domain: 'Observability',
    color: 'hsl(35 90% 55%)',
    events: [
      { name: 'ModuleHealthChanged', description: 'Status de saúde do módulo alterado' },
      { name: 'ApplicationErrorDetected', description: 'Erro de aplicação capturado' },
      { name: 'LatencyThresholdExceeded', description: 'Latência p95 acima do threshold' },
      { name: 'ErrorRateSpike', description: 'Pico na taxa de erros' },
    ],
  },

  // ─── Security ───
  {
    domain: 'Security',
    color: 'hsl(0 70% 55%)',
    events: [
      { name: 'UnauthorizedAccessAttempt', description: 'Tentativa de acesso não autorizado' },
      { name: 'ScopeViolationDetected', description: 'Violação de escopo detectada' },
      { name: 'RateLimitTriggered', description: 'Rate limit acionado' },
      { name: 'PermissionDenied', description: 'Permissão negada' },
      { name: 'SuspiciousActivityFlagged', description: 'Atividade suspeita sinalizada' },
    ],
  },

  // ─── Security — IBL (Identity Boundary Layer) ───
  {
    domain: 'Identity Boundary',
    color: 'hsl(350 65% 50%)',
    events: [
      { name: 'ContextSwitched', description: 'Contexto de identidade alterado' },
      { name: 'IdentitySessionStarted', description: 'Sessão de identidade iniciada' },
      { name: 'IdentitySessionRefreshed', description: 'Sessão de identidade renovada' },
      { name: 'UnauthorizedContextSwitch', description: 'Troca de contexto não autorizada' },
      { name: 'ImpersonationStarted', description: 'Impersonação iniciada' },
      { name: 'ImpersonationExpired', description: 'Impersonação expirada' },
      { name: 'ImpersonationEnded', description: 'Impersonação encerrada' },
      { name: 'ImpersonationDenied', description: 'Impersonação negada' },
    ],
  },

  // ─── Security — Access Graph ───
  {
    domain: 'Access Graph',
    color: 'hsl(340 60% 52%)',
    events: [
      { name: 'UserRoleChanged', description: 'Role do usuário alterada no grafo' },
      { name: 'ScopeAssigned', description: 'Escopo atribuído' },
      { name: 'ScopeRevoked', description: 'Escopo revogado' },
      { name: 'CompanyCreated', description: 'Empresa criada no grafo' },
      { name: 'CompanyRemoved', description: 'Empresa removida do grafo' },
      { name: 'GroupCreated', description: 'Grupo criado no grafo' },
      { name: 'GroupUpdated', description: 'Grupo atualizado no grafo' },
      { name: 'GroupRemoved', description: 'Grupo removido do grafo' },
    ],
  },

  // ─── Security — Unified Graph Engine ───
  {
    domain: 'Unified Graph',
    color: 'hsl(330 55% 48%)',
    events: [
      { name: 'GraphComposed', description: 'Grafo unificado composto' },
      { name: 'RiskScoreUpdated', description: 'Score de risco atualizado (UGE)' },
      { name: 'AccessAnomalyDetected', description: 'Anomalia de acesso detectada' },
    ],
  },

  // ─── Self-Healing ───
  {
    domain: 'Self-Healing',
    color: 'hsl(280 60% 55%)',
    events: [
      { name: 'IncidentDetected', description: 'Incidente detectado automaticamente' },
      { name: 'SelfHealingTriggered', description: 'Auto-recuperação acionada' },
      { name: 'CircuitOpened', description: 'Circuit breaker aberto' },
      { name: 'CircuitClosed', description: 'Circuit breaker fechado' },
      { name: 'ModuleRecovered', description: 'Módulo recuperado com sucesso' },
    ],
  },

  // ─── Governance AI ───
  {
    domain: 'Governance AI',
    color: 'hsl(320 60% 50%)',
    events: [
      { name: 'GovernanceRiskDetected', description: 'Risco de governança detectado por IA' },
      { name: 'RoleOptimizationSuggested', description: 'Sugestão de otimização de role' },
      { name: 'PermissionConflictDetected', description: 'Conflito de permissão detectado' },
      { name: 'ComplianceViolation', description: 'Violação de compliance detectada' },
      { name: 'PolicyRecommendation', description: 'Recomendação de política gerada' },
    ],
  },

  // ─── Onboarding ───
  {
    domain: 'Onboarding',
    color: 'hsl(175 60% 45%)',
    events: [
      { name: 'TenantOnboardingStarted', description: 'Onboarding do tenant iniciado' },
      { name: 'OnboardingStepCompleted', description: 'Etapa de onboarding concluída' },
      { name: 'OnboardingStepSkipped', description: 'Etapa de onboarding ignorada' },
      { name: 'OnboardingFinished', description: 'Onboarding finalizado' },
      { name: 'RoleBootstrapCompleted', description: 'Bootstrap de roles concluído' },
    ],
  },

  // ─── Payroll Simulation ───
  {
    domain: 'Payroll',
    color: 'hsl(55 70% 45%)',
    events: [
      { name: 'PayrollSimulationCreated', description: 'Simulação de folha criada' },
      { name: 'EncargoEstimateUpdated', description: 'Estimativa de encargos atualizada' },
      { name: 'SimulationRiskDetected', description: 'Risco detectado na simulação' },
      { name: 'SimulationApproved', description: 'Simulação aprovada' },
    ],
  },

  // ─── Workforce Intelligence ───
  {
    domain: 'Workforce',
    color: 'hsl(220 60% 55%)',
    events: [
      { name: 'WorkforceInsightCreated', description: 'Insight de workforce criado' },
      { name: 'RiskScoreUpdated', description: 'Score de risco atualizado' },
    ],
  },

  // ─── NR Training Lifecycle ───
  {
    domain: 'NR Training',
    color: 'hsl(15 70% 50%)',
    events: [
      { name: 'TrainingAssigned', description: 'Treinamento atribuído ao colaborador' },
      { name: 'TrainingCompleted', description: 'Treinamento concluído' },
      { name: 'TrainingExpired', description: 'Treinamento expirado' },
      { name: 'TrainingBlocked', description: 'Treinamento bloqueado (blocking level)' },
      { name: 'TrainingRenewalDue', description: 'Renovação de treinamento próxima' },
      { name: 'TrainingStatusChanged', description: 'Status do treinamento alterado' },
    ],
  },

  // ─── Employee Agreement ───
  {
    domain: 'Agreements',
    color: 'hsl(40 65% 48%)',
    events: [
      { name: 'agreement.template.created', description: 'Template de acordo criado' },
      { name: 'agreement.template.updated', description: 'Template de acordo atualizado' },
      { name: 'agreement.template.version_published', description: 'Versão de template publicada' },
      { name: 'agreement.sent_for_signature', description: 'Acordo enviado para assinatura' },
      { name: 'agreement.signed', description: 'Acordo assinado' },
      { name: 'agreement.rejected', description: 'Acordo rejeitado' },
      { name: 'agreement.expired', description: 'Acordo expirado' },
      { name: 'agreement.auto_dispatch_triggered', description: 'Envio automático de acordo acionado' },
    ],
  },

  // ─── Platform OS ───
  {
    domain: 'Platform OS',
    color: 'hsl(265 60% 55%)',
    events: [
      { name: 'PlatformBootstrapped', description: 'Runtime da plataforma inicializado' },
      { name: 'ModuleRegistered', description: 'Módulo registrado na plataforma' },
      { name: 'IdentitySnapshotUpdated', description: 'Snapshot de identidade atualizado' },
      { name: 'NavigationTreeUpdated', description: 'Árvore de navegação recomputada' },
      { name: 'FeatureLifecycleChanged', description: 'Feature flag alterada' },
      { name: 'ModuleInstalled', description: 'Módulo instalado (primeiro registro)' },
      { name: 'ModuleEnabled', description: 'Módulo habilitado para tenant' },
      { name: 'ModuleDisabled', description: 'Módulo desabilitado para tenant' },
      { name: 'ModuleUpgraded', description: 'Módulo atualizado para nova versão' },
      { name: 'TenantCreated', description: 'Tenant criado na plataforma' },
      { name: 'TenantSuspended', description: 'Tenant suspenso' },
    ],
  },

  // ─── Platform IAM ───
  {
    domain: 'Platform IAM',
    color: 'hsl(260 55% 52%)',
    events: [
      { name: 'PlatformRoleCreated', description: 'Role de plataforma criada' },
      { name: 'PlatformRoleUpdated', description: 'Role de plataforma atualizada' },
      { name: 'PlatformPermissionAssigned', description: 'Permissão de plataforma atribuída' },
      { name: 'PlatformPermissionRevoked', description: 'Permissão de plataforma revogada' },
      { name: 'PlatformAccessGraphRebuilt', description: 'Grafo de acesso da plataforma reconstruído' },
    ],
  },

  // ─── Platform Cognitive Layer ───
  {
    domain: 'Platform Cognitive',
    color: 'hsl(270 50% 50%)',
    events: [
      { name: 'PlatformUserLoggedIn', description: 'Login de usuário na plataforma' },
      { name: 'TenantReactivated', description: 'Tenant reativado' },
      { name: 'PlatformPermissionChanged', description: 'Permissão de plataforma alterada' },
      { name: 'UserBehaviorTracked', description: 'Comportamento do usuário rastreado' },
      { name: 'RoleSuggestionGenerated', description: 'Sugestão de role gerada por IA' },
      { name: 'PermissionRiskDetected', description: 'Risco de permissão detectado' },
      { name: 'NavigationHintCreated', description: 'Dica de navegação criada' },
      { name: 'PlanAssignedToTenant', description: 'Plano atribuído ao tenant' },
      { name: 'PlanUpgraded', description: 'Plano atualizado (upgrade)' },
      { name: 'PlanDowngraded', description: 'Plano rebaixado (downgrade)' },
      { name: 'PaymentMethodRestricted', description: 'Método de pagamento restrito' },
    ],
  },

  // ─── Revenue Intelligence ───
  {
    domain: 'Revenue Intelligence',
    color: 'hsl(160 60% 45%)',
    events: [
      { name: 'ReferralLinkCreated', description: 'Link de referral criado' },
      { name: 'ReferralSignup', description: 'Signup via referral registrado' },
      { name: 'ReferralConverted', description: 'Referral convertido em pagante' },
      { name: 'RewardGranted', description: 'Recompensa concedida (crédito, cupom ou pontos)' },
      { name: 'RewardAwarded', description: '[legacy] Recompensa concedida ao referrer' },
      { name: 'GamificationLevelUp', description: 'Usuário subiu de tier na gamificação' },
      { name: 'TierUpgraded', description: '[legacy] Tier de gamificação elevado' },
      { name: 'RevenueForecastUpdated', description: 'Projeção de receita (MRR) recalculada' },
      { name: 'ChurnRiskDetected', description: 'Risco de churn detectado' },
      { name: 'UpgradeRecommended', description: 'Upgrade recomendado para tenant' },
    ],
  },

  // ─── Growth AI ───
  {
    domain: 'Growth AI',
    color: 'hsl(340 75% 55%)',
    events: [
      { name: 'LandingPageCreated', description: 'Nova landing page criada no builder' },
      { name: 'LandingPagePublished', description: 'Landing page publicada (permission-gated)' },
      { name: 'FABContentUpdated', description: 'Conteúdo FAB de um bloco atualizado' },
      { name: 'ConversionTracked', description: 'Evento de conversão registrado no funil' },
      { name: 'GrowthInsightGenerated', description: 'Insight de crescimento gerado por IA' },
      { name: 'TemplateApplied', description: 'Template de landing page aplicado' },
      { name: 'GTMContainerInjected', description: 'Container GTM injetado na página' },
      { name: 'GTMPageView', description: 'Evento page_view enviado ao GTM dataLayer' },
      { name: 'GTMCTAClick', description: 'Evento cta_click enviado ao GTM dataLayer' },
      { name: 'GTMTrialStart', description: 'Evento trial_start enviado ao GTM dataLayer' },
      { name: 'GTMPlanSelected', description: 'Evento plan_selected enviado ao GTM dataLayer' },
      { name: 'GTMReferralSignup', description: 'Evento referral_signup enviado ao GTM dataLayer' },
      { name: 'AIHeadlineSuggested', description: 'Headline sugerida pelo AI Conversion Designer' },
      { name: 'AIFABGenerated', description: 'Conteúdo FAB gerado pelo AI Content Generator' },
      { name: 'AICTAOptimized', description: 'CTA otimizado pelo AI Conversion Designer' },
      { name: 'AILayoutSuggested', description: 'Layout sugerido pelo AI Conversion Designer' },
    ],
  },
];

// ── Builder ────────────────────────────────────────────────────

let _cache: EventCatalogEntry[] | null = null;
let _domains: string[] | null = null;

/**
 * Build (or rebuild) the flat event catalog from all domain registries.
 * Called on first access and whenever the user clicks "Atualizar".
 */
export function buildCatalog(): EventCatalogEntry[] {
  const entries: EventCatalogEntry[] = [];
  for (const reg of DOMAIN_REGISTRIES) {
    for (const ev of reg.events) {
      entries.push({
        domain: reg.domain,
        domainColor: reg.color,
        eventName: ev.name,
        description: ev.description,
      });
    }
  }
  _cache = entries;
  _domains = [...new Set(entries.map(e => e.domain))];
  return entries;
}

/** Get the current catalog (builds on first call). */
export function getEventCatalog(): EventCatalogEntry[] {
  if (!_cache) buildCatalog();
  return _cache!;
}

/** Get unique domain names. */
export function getAllDomains(): string[] {
  if (!_domains) buildCatalog();
  return _domains!;
}

// Legacy exports for backward compat
export const EVENT_CATALOG = getEventCatalog();
export const ALL_DOMAINS = getAllDomains();
