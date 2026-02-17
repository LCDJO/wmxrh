/**
 * Domain Event Catalog — Static registry of all platform domain events.
 */

export interface EventCatalogEntry {
  domain: string;
  domainColor: string;
  eventName: string;
  description: string;
}

export const EVENT_CATALOG: EventCatalogEntry[] = [
  // IAM
  { domain: 'IAM', domainColor: 'hsl(200 70% 50%)', eventName: 'UserInvited', description: 'Novo membro convidado para o tenant' },
  { domain: 'IAM', domainColor: 'hsl(200 70% 50%)', eventName: 'UserRoleAssigned', description: 'Role vinculada a um usuário + escopo' },
  { domain: 'IAM', domainColor: 'hsl(200 70% 50%)', eventName: 'UserRoleRemoved', description: 'Role desvinculada do usuário' },
  { domain: 'IAM', domainColor: 'hsl(200 70% 50%)', eventName: 'RolePermissionsUpdated', description: 'Conjunto de permissões alterado' },
  { domain: 'IAM', domainColor: 'hsl(200 70% 50%)', eventName: 'AccessGraphRebuilt', description: 'Cache do grafo de acesso invalidado' },

  // Billing
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'TenantPlanAssigned', description: 'Plano atribuído ao tenant' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'TenantPlanUpgraded', description: 'Upgrade de plano realizado' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'InvoiceGenerated', description: 'Fatura gerada para o tenant' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'RevenueUpdated', description: 'Receita atualizada (MRR/ARR)' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'UsageRecorded', description: 'Uso registrado (métrica + quantidade)' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'CouponCreated', description: 'Cupom criado na plataforma' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'CouponRedeemed', description: 'Cupom resgatado por um tenant' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'InvoiceDiscountApplied', description: 'Desconto aplicado em fatura' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'UsageOverageCalculated', description: 'Excedente de uso calculado' },

  // Observability
  { domain: 'Observability', domainColor: 'hsl(35 90% 55%)', eventName: 'ModuleHealthChanged', description: 'Status de saúde do módulo alterado' },
  { domain: 'Observability', domainColor: 'hsl(35 90% 55%)', eventName: 'ApplicationErrorDetected', description: 'Erro de aplicação capturado' },
  { domain: 'Observability', domainColor: 'hsl(35 90% 55%)', eventName: 'LatencyThresholdExceeded', description: 'Latência p95 acima do threshold' },
  { domain: 'Observability', domainColor: 'hsl(35 90% 55%)', eventName: 'ErrorRateSpike', description: 'Pico na taxa de erros' },

  // Security
  { domain: 'Security', domainColor: 'hsl(0 70% 55%)', eventName: 'UnauthorizedAccessAttempt', description: 'Tentativa de acesso não autorizado' },
  { domain: 'Security', domainColor: 'hsl(0 70% 55%)', eventName: 'ScopeViolationDetected', description: 'Violação de escopo detectada' },
  { domain: 'Security', domainColor: 'hsl(0 70% 55%)', eventName: 'PermissionDenied', description: 'Permissão negada' },
  { domain: 'Security', domainColor: 'hsl(0 70% 55%)', eventName: 'SuspiciousActivityFlagged', description: 'Atividade suspeita sinalizada' },

  // Self-Healing
  { domain: 'Self-Healing', domainColor: 'hsl(280 60% 55%)', eventName: 'IncidentDetected', description: 'Incidente detectado automaticamente' },
  { domain: 'Self-Healing', domainColor: 'hsl(280 60% 55%)', eventName: 'SelfHealingTriggered', description: 'Auto-recuperação acionada' },
  { domain: 'Self-Healing', domainColor: 'hsl(280 60% 55%)', eventName: 'CircuitBreakerOpened', description: 'Circuit breaker aberto' },
  { domain: 'Self-Healing', domainColor: 'hsl(280 60% 55%)', eventName: 'CircuitBreakerClosed', description: 'Circuit breaker fechado' },
  { domain: 'Self-Healing', domainColor: 'hsl(280 60% 55%)', eventName: 'ModuleRecovered', description: 'Módulo recuperado com sucesso' },

  // Governance AI
  { domain: 'Governance AI', domainColor: 'hsl(320 60% 50%)', eventName: 'GovernanceRiskDetected', description: 'Risco de governança detectado por IA' },
  { domain: 'Governance AI', domainColor: 'hsl(320 60% 50%)', eventName: 'RoleOptimizationSuggested', description: 'Sugestão de otimização de role' },
  { domain: 'Governance AI', domainColor: 'hsl(320 60% 50%)', eventName: 'ComplianceViolation', description: 'Violação de compliance detectada' },
  { domain: 'Governance AI', domainColor: 'hsl(320 60% 50%)', eventName: 'PolicyRecommendation', description: 'Recomendação de política gerada' },

  // Onboarding
  { domain: 'Onboarding', domainColor: 'hsl(175 60% 45%)', eventName: 'TenantOnboardingStarted', description: 'Onboarding do tenant iniciado' },
  { domain: 'Onboarding', domainColor: 'hsl(175 60% 45%)', eventName: 'OnboardingStepCompleted', description: 'Etapa de onboarding concluída' },
  { domain: 'Onboarding', domainColor: 'hsl(175 60% 45%)', eventName: 'OnboardingCompleted', description: 'Onboarding finalizado' },
  { domain: 'Onboarding', domainColor: 'hsl(175 60% 45%)', eventName: 'OnboardingAbandoned', description: 'Onboarding abandonado' },

  // Payroll Simulation
  { domain: 'Payroll', domainColor: 'hsl(55 70% 45%)', eventName: 'PayrollSimulationCreated', description: 'Simulação de folha criada' },
  { domain: 'Payroll', domainColor: 'hsl(55 70% 45%)', eventName: 'EncargoEstimateUpdated', description: 'Estimativa de encargos atualizada' },
  { domain: 'Payroll', domainColor: 'hsl(55 70% 45%)', eventName: 'SimulationApproved', description: 'Simulação aprovada' },

  // Workforce Intelligence
  { domain: 'Workforce', domainColor: 'hsl(220 60% 55%)', eventName: 'WorkforceInsightCreated', description: 'Insight de workforce criado' },
  { domain: 'Workforce', domainColor: 'hsl(220 60% 55%)', eventName: 'RiskScoreUpdated', description: 'Score de risco atualizado' },

  // NR Training Lifecycle
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingAssigned', description: 'Treinamento atribuído ao colaborador' },
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingCompleted', description: 'Treinamento concluído' },
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingExpired', description: 'Treinamento expirado' },
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingBlocked', description: 'Treinamento bloqueado (blocking level)' },
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingRenewalDue', description: 'Renovação de treinamento próxima' },
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingStatusChanged', description: 'Status do treinamento alterado' },

  // Platform OS
  { domain: 'Platform OS', domainColor: 'hsl(265 60% 55%)', eventName: 'ModuleRegistered', description: 'Módulo registrado na plataforma' },
  { domain: 'Platform OS', domainColor: 'hsl(265 60% 55%)', eventName: 'ModuleEnabled', description: 'Módulo habilitado para tenant' },
  { domain: 'Platform OS', domainColor: 'hsl(265 60% 55%)', eventName: 'ModuleDisabled', description: 'Módulo desabilitado para tenant' },
  { domain: 'Platform OS', domainColor: 'hsl(265 60% 55%)', eventName: 'TenantCreated', description: 'Tenant criado na plataforma' },
  { domain: 'Platform OS', domainColor: 'hsl(265 60% 55%)', eventName: 'TenantSuspended', description: 'Tenant suspenso' },

  // Revenue Intelligence
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'ReferralLinkCreated', description: 'Link de referral criado' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'ReferralSignup', description: 'Signup via referral registrado' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'ReferralConverted', description: 'Referral convertido em pagante' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'RewardAwarded', description: 'Recompensa concedida ao referrer' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'TierUpgraded', description: 'Tier de gamificação elevado' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'ChurnRiskDetected', description: 'Risco de churn detectado' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'UpgradeRecommended', description: 'Upgrade recomendado para tenant' },
];

export const ALL_DOMAINS = [...new Set(EVENT_CATALOG.map(e => e.domain))];
