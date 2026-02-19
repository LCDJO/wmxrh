/**
 * Event Trigger Registry — Maps domain events from GlobalEventKernel
 * to workflow trigger nodes in the Integration Automation Engine.
 *
 * Domains registered:
 *   1. Landing Engine (Growth AI)
 *   2. BillingCore
 *   3. Developer Portal
 *   4. API Management (PAMS)
 *   5. Versioning Engine
 */

export interface EventTriggerDef {
  eventType: string;
  domain: string;
  domainColor: string;
  label: string;
  description: string;
  payloadSchema: Record<string, string>;
}

// ════════════════════════════════════
// 1) LANDING ENGINE (Growth AI)
// ════════════════════════════════════

const LANDING_ENGINE_TRIGGERS: EventTriggerDef[] = [
  {
    eventType: 'growth:landing_page_created',
    domain: 'Landing Engine',
    domainColor: 'hsl(340 75% 55%)',
    label: 'LandingPageCreated',
    description: 'Nova landing page criada no builder',
    payloadSchema: { pageId: 'string', pageName: 'string', slug: 'string', blocksCount: 'number' },
  },
  {
    eventType: 'growth:landing_page_published',
    domain: 'Landing Engine',
    domainColor: 'hsl(340 75% 55%)',
    label: 'LandingPagePublished',
    description: 'Landing page publicada em produção',
    payloadSchema: { pageId: 'string', pageName: 'string', slug: 'string', publishedBy: 'string' },
  },
  {
    eventType: 'growth:conversion_tracked',
    domain: 'Landing Engine',
    domainColor: 'hsl(340 75% 55%)',
    label: 'ConversionTracked',
    description: 'Evento de conversão registrado no funil',
    payloadSchema: { pageId: 'string', conversionType: 'string', source: 'string' },
  },
  {
    eventType: 'growth:website_published',
    domain: 'Landing Engine',
    domainColor: 'hsl(340 75% 55%)',
    label: 'WebsitePublished',
    description: 'Website publicado em produção',
    payloadSchema: { pageId: 'string', pageSlug: 'string', version: 'number', url: 'string' },
  },
  {
    eventType: 'growth:fab_section_generated',
    domain: 'Landing Engine',
    domainColor: 'hsl(340 75% 55%)',
    label: 'FABSectionGenerated',
    description: 'Seção FAB gerada pelo Content Engine',
    payloadSchema: { pageId: 'string', blockId: 'string', generatedBy: 'string' },
  },
];

// ════════════════════════════════════
// 2) BILLING CORE
// ════════════════════════════════════

const BILLING_CORE_TRIGGERS: EventTriggerDef[] = [
  {
    eventType: 'billing:tenant_plan_assigned',
    domain: 'BillingCore',
    domainColor: 'hsl(145 60% 42%)',
    label: 'TenantPlanAssigned',
    description: 'Plano atribuído ao tenant',
    payloadSchema: { tenantId: 'string', planId: 'string', planName: 'string' },
  },
  {
    eventType: 'billing:tenant_plan_upgraded',
    domain: 'BillingCore',
    domainColor: 'hsl(145 60% 42%)',
    label: 'TenantPlanUpgraded',
    description: 'Upgrade de plano realizado',
    payloadSchema: { tenantId: 'string', oldPlan: 'string', newPlan: 'string' },
  },
  {
    eventType: 'billing:invoice_generated',
    domain: 'BillingCore',
    domainColor: 'hsl(145 60% 42%)',
    label: 'InvoiceGenerated',
    description: 'Fatura gerada para o tenant',
    payloadSchema: { tenantId: 'string', invoiceId: 'string', amount: 'number' },
  },
  {
    eventType: 'billing:payment_succeeded',
    domain: 'BillingCore',
    domainColor: 'hsl(145 60% 42%)',
    label: 'PaymentSucceeded',
    description: 'Pagamento bem-sucedido',
    payloadSchema: { tenantId: 'string', invoiceId: 'string', amount: 'number' },
  },
  {
    eventType: 'billing:payment_failed',
    domain: 'BillingCore',
    domainColor: 'hsl(145 60% 42%)',
    label: 'PaymentFailed',
    description: 'Falha no pagamento',
    payloadSchema: { tenantId: 'string', invoiceId: 'string', reason: 'string' },
  },
  {
    eventType: 'billing:coupon_redeemed',
    domain: 'BillingCore',
    domainColor: 'hsl(145 60% 42%)',
    label: 'CouponRedeemed',
    description: 'Cupom resgatado por um tenant',
    payloadSchema: { tenantId: 'string', couponCode: 'string', discountValue: 'number' },
  },
  {
    eventType: 'billing:usage_overage_detected',
    domain: 'BillingCore',
    domainColor: 'hsl(145 60% 42%)',
    label: 'UsageOverageDetected',
    description: 'Excedente de uso detectado',
    payloadSchema: { tenantId: 'string', metric: 'string', current: 'number', limit: 'number' },
  },
];

// ════════════════════════════════════
// 3) DEVELOPER PORTAL
// ════════════════════════════════════

const DEVELOPER_PORTAL_TRIGGERS: EventTriggerDef[] = [
  {
    eventType: 'devportal:app_registered',
    domain: 'Developer Portal',
    domainColor: 'hsl(200 70% 50%)',
    label: 'AppRegistered',
    description: 'Novo app registrado no Developer Portal',
    payloadSchema: { appId: 'string', appName: 'string', developerId: 'string' },
  },
  {
    eventType: 'devportal:app_published',
    domain: 'Developer Portal',
    domainColor: 'hsl(200 70% 50%)',
    label: 'AppPublished',
    description: 'App publicado no Marketplace',
    payloadSchema: { appId: 'string', appName: 'string', version: 'string' },
  },
  {
    eventType: 'devportal:app_installed',
    domain: 'Developer Portal',
    domainColor: 'hsl(200 70% 50%)',
    label: 'AppInstalled',
    description: 'App instalado por um tenant',
    payloadSchema: { appId: 'string', tenantId: 'string', appName: 'string' },
  },
  {
    eventType: 'devportal:app_uninstalled',
    domain: 'Developer Portal',
    domainColor: 'hsl(200 70% 50%)',
    label: 'AppUninstalled',
    description: 'App desinstalado por um tenant',
    payloadSchema: { appId: 'string', tenantId: 'string' },
  },
  {
    eventType: 'devportal:webhook_registered',
    domain: 'Developer Portal',
    domainColor: 'hsl(200 70% 50%)',
    label: 'WebhookRegistered',
    description: 'Webhook registrado por app externo',
    payloadSchema: { appId: 'string', webhookUrl: 'string', events: 'string[]' },
  },
];

// ════════════════════════════════════
// 4) API MANAGEMENT (PAMS)
// ════════════════════════════════════

const API_MANAGEMENT_TRIGGERS: EventTriggerDef[] = [
  {
    eventType: 'pams:api_client_created',
    domain: 'API Management',
    domainColor: 'hsl(260 55% 52%)',
    label: 'ApiClientCreated',
    description: 'Novo cliente de API registrado',
    payloadSchema: { clientId: 'string', clientName: 'string', tenantId: 'string' },
  },
  {
    eventType: 'pams:api_key_generated',
    domain: 'API Management',
    domainColor: 'hsl(260 55% 52%)',
    label: 'ApiKeyGenerated',
    description: 'Nova chave de API gerada',
    payloadSchema: { clientId: 'string', keyId: 'string', scopes: 'string[]' },
  },
  {
    eventType: 'pams:api_rate_limit_exceeded',
    domain: 'API Management',
    domainColor: 'hsl(260 55% 52%)',
    label: 'ApiRateLimitExceeded',
    description: 'Limite de taxa de API excedido',
    payloadSchema: { clientId: 'string', endpoint: 'string', limit: 'number' },
  },
  {
    eventType: 'pams:api_version_deprecated',
    domain: 'API Management',
    domainColor: 'hsl(260 55% 52%)',
    label: 'ApiVersionDeprecated',
    description: 'Versão de API marcada como deprecada',
    payloadSchema: { version: 'string', sunsetDate: 'string' },
  },
  {
    eventType: 'pams:api_request_received',
    domain: 'API Management',
    domainColor: 'hsl(260 55% 52%)',
    label: 'ApiRequestReceived',
    description: 'Requisição de API processada pelo gateway',
    payloadSchema: { clientId: 'string', endpoint: 'string', method: 'string', statusCode: 'number' },
  },
];

// ════════════════════════════════════
// 5) VERSIONING ENGINE
// ════════════════════════════════════

const VERSIONING_ENGINE_TRIGGERS: EventTriggerDef[] = [
  {
    eventType: 'versioning:module_version_released',
    domain: 'Versioning Engine',
    domainColor: 'hsl(270 50% 50%)',
    label: 'ModuleVersionReleased',
    description: 'Nova versão de módulo publicada',
    payloadSchema: { moduleId: 'string', version: 'string', changelog: 'string' },
  },
  {
    eventType: 'versioning:rollback_executed',
    domain: 'Versioning Engine',
    domainColor: 'hsl(270 50% 50%)',
    label: 'RollbackExecuted',
    description: 'Rollback de versão executado',
    payloadSchema: { moduleId: 'string', fromVersion: 'string', toVersion: 'string' },
  },
  {
    eventType: 'versioning:deprecation_scheduled',
    domain: 'Versioning Engine',
    domainColor: 'hsl(270 50% 50%)',
    label: 'DeprecationScheduled',
    description: 'Depreciação de módulo agendada',
    payloadSchema: { moduleId: 'string', version: 'string', sunsetDate: 'string' },
  },
  {
    eventType: 'versioning:breaking_change_detected',
    domain: 'Versioning Engine',
    domainColor: 'hsl(270 50% 50%)',
    label: 'BreakingChangeDetected',
    description: 'Breaking change detectada em dependência',
    payloadSchema: { moduleId: 'string', dependency: 'string', severity: 'string' },
  },
];

// ════════════════════════════════════
// UNIFIED REGISTRY
// ════════════════════════════════════

export const EVENT_TRIGGER_REGISTRY: EventTriggerDef[] = [
  ...LANDING_ENGINE_TRIGGERS,
  ...BILLING_CORE_TRIGGERS,
  ...DEVELOPER_PORTAL_TRIGGERS,
  ...API_MANAGEMENT_TRIGGERS,
  ...VERSIONING_ENGINE_TRIGGERS,
];

/** Get all unique domains. */
export function getRegistryDomains(): string[] {
  return [...new Set(EVENT_TRIGGER_REGISTRY.map(t => t.domain))];
}

/** Get triggers for a specific domain. */
export function getTriggersByDomain(domain: string): EventTriggerDef[] {
  return EVENT_TRIGGER_REGISTRY.filter(t => t.domain === domain);
}

/** Find a trigger by its kernel event type. */
export function getTriggerByEventType(eventType: string): EventTriggerDef | undefined {
  return EVENT_TRIGGER_REGISTRY.find(t => t.eventType === eventType);
}

/** Get trigger count by domain (for dashboard). */
export function getTriggerCountByDomain(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of EVENT_TRIGGER_REGISTRY) {
    counts[t.domain] = (counts[t.domain] ?? 0) + 1;
  }
  return counts;
}
