/**
 * PAMS Event Handlers — Cross-module event integration.
 */

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';
import { PAMS_EVENTS } from '../manifest';

export function registerApiManagementEventHandlers(sandbox: SandboxContext): () => void {
  // ... keep existing code
  const unsubscribers: Array<() => void> = [];

  const unsubPlanChange = sandbox.on('module:billing:plan_changed', (payload: unknown) => {
    const data = payload as { tenantId: string; newPlan: string };
    console.info(`[PAMS] Plan changed for tenant ${data.tenantId} → ${data.newPlan}. Rate limits will be recalculated.`);
    sandbox.emit(PAMS_EVENTS.USAGE_THRESHOLD, {
      type: 'plan_change',
      tenantId: data.tenantId,
      newPlan: data.newPlan,
    });
  });
  unsubscribers.push(unsubPlanChange);

  const unsubSecurity = sandbox.on('module:security:access_denied', (payload: unknown) => {
    const data = payload as { resource: string; userId: string };
    console.warn(`[PAMS] Security event — access denied for ${data.userId} on ${data.resource}`);
    sandbox.emit(PAMS_EVENTS.SCOPE_VIOLATION, data);
  });
  unsubscribers.push(unsubSecurity);

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

// ══════════════════════════════════════
// Domain Event Catalog (autodiscovery)
// ══════════════════════════════════════

export const __DOMAIN_CATALOG = {
  domain: 'API Management',
  color: 'hsl(190 60% 48%)',
  events: [
    { name: 'ApiClientCreated', description: 'Novo API client registrado na plataforma' },
    { name: 'ApiClientSuspended', description: 'API client suspenso por violação ou solicitação' },
    { name: 'ApiKeyGenerated', description: 'Nova API key gerada para um client (hash armazenado, valor exibido uma única vez)' },
    { name: 'ApiKeyRevoked', description: 'API key revogada permanentemente' },
    { name: 'ApiKeyRotated', description: 'API key rotacionada — nova gerada, antiga revogada' },
    { name: 'ApiRateLimitExceeded', description: 'Rate limit excedido para um client/tenant (HTTP 429)' },
    { name: 'ApiUsageThreshold', description: 'Tenant atingiu threshold de uso (soft/hard cap via UsageBillingRules)' },
    { name: 'ApiScopeViolation', description: 'Tentativa de acesso a scope não autorizado' },
    { name: 'ApiVersionDeprecated', description: 'Versão da API marcada como deprecated no ModuleVersionRegistry' },
  ],
};
