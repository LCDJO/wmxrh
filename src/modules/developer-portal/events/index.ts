/**
 * Developer Portal & API Marketplace — Event Handlers
 *
 * Cross-module event integration with PAMS, BillingCore, and Security Kernel.
 */

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';
import { DEVPORTAL_EVENTS } from '../manifest';

export function registerDeveloperPortalEventHandlers(sandbox: SandboxContext): () => void {
  const unsubscribers: Array<() => void> = [];

  const unsubKeyRevoked = sandbox.on('module:api_management:key_revoked', (payload: unknown) => {
    const data = payload as { clientId: string; reason: string };
    console.warn(`[DevPortal] API key revoked for client ${data.clientId}: ${data.reason}. Notifying developer.`);
    sandbox.emit(DEVPORTAL_EVENTS.OAUTH_CLIENT_ROTATED, { clientId: data.clientId, trigger: 'key_revoked' });
  });
  unsubscribers.push(unsubKeyRevoked);

  const unsubPlanChanged = sandbox.on('module:billing:plan_changed', (payload: unknown) => {
    const data = payload as { tenantId: string; newPlan: string };
    console.info(`[DevPortal] Billing plan changed for tenant ${data.tenantId} → ${data.newPlan}. Updating developer tier limits.`);
  });
  unsubscribers.push(unsubPlanChanged);

  const unsubRateLimit = sandbox.on('module:api_management:rate_limit_hit', (payload: unknown) => {
    const data = payload as { clientId: string; tenantId: string };
    console.warn(`[DevPortal] Rate limit hit for client ${data.clientId}. Checking developer subscription.`);
  });
  unsubscribers.push(unsubRateLimit);

  const unsubAccessDenied = sandbox.on('module:security:access_denied', (payload: unknown) => {
    const data = payload as { resource: string; userId: string };
    console.warn(`[DevPortal] Security: access denied for ${data.userId} on ${data.resource}`);
  });
  unsubscribers.push(unsubAccessDenied);

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

// ══════════════════════════════════════
// Domain Event Catalog (autodiscovery)
// ══════════════════════════════════════

export const __DOMAIN_CATALOG = {
  domain: 'Developer Portal & API Marketplace',
  color: 'hsl(270 60% 55%)',
  events: [
    { name: 'DeveloperRegistered', description: 'Novo developer/parceiro registrado na plataforma' },
    { name: 'AppSubmitted', description: 'App submetido para revisão no marketplace' },
    { name: 'AppApproved', description: 'App aprovado após review automatizada + manual + segurança' },
    { name: 'AppRejected', description: 'App rejeitado durante processo de review' },
    { name: 'AppPublished', description: 'App publicado e disponível no marketplace' },
    { name: 'AppSuspended', description: 'App suspenso por violação de políticas ou solicitação' },
    { name: 'AppInstalled', description: 'Tenant instalou um app — permissões concedidas via ApiGatewayController' },
    { name: 'AppRevoked', description: 'Acesso de app revogado pelo tenant — scopes e tokens invalidados' },
    { name: 'OAuthClientCreated', description: 'Credenciais OAuth criadas para app (client_id + secret)' },
    { name: 'OAuthClientRotated', description: 'Credenciais OAuth rotacionadas com período de carência de 24h' },
    { name: 'ApiSubscriptionCreated', description: 'Desenvolvedor subscreveu a um produto de API' },
    { name: 'ApiSubscriptionCancelled', description: 'Subscrição de API cancelada' },
    { name: 'SandboxSessionStarted', description: 'Ambiente sandbox provisionado para testes de integração' },
    { name: 'MarketplaceInstall', description: 'Tenant instalou app do marketplace' },
    { name: 'MarketplaceUninstall', description: 'Tenant desinstalou app do marketplace' },
  ],
};
