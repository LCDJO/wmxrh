/**
 * SignalBridge — Connects platform domain events to the PlatformSignalCollector.
 *
 * Bridges signals from:
 *  - Automation Engine (workflow failures, executions)
 *  - BillingCore (plan changes, invoices, usage overages)
 *  - Landing / Growth Engine (conversions, publish events, insights)
 *  - API Management (rate limits, scope violations, client events)
 *  - Observability / Versioning (version deprecations)
 *
 * ⚠ NEVER collects sensitive data (passwords, tokens, PII, financial values).
 *    Payloads are sanitized before ingestion.
 */

import { PlatformSignalCollector } from './platform-signal-collector';
import type { SignalSeverity, SignalSource } from './types';

import { onBillingEvent } from '@/domains/billing-core/billing-events';
import type { BillingDomainEvent } from '@/domains/billing-core/billing-events';

import { onGrowthEvent } from '@/domains/platform-growth/growth.events';
import type { GrowthDomainEvent } from '@/domains/platform-growth/growth.events';

// ══════════════════════════════════════════════
// Sanitization helpers — strip sensitive fields
// ══════════════════════════════════════════════

function sanitize(raw: Record<string, unknown>): Record<string, unknown> {
  const BLOCKED_KEYS = new Set([
    'password', 'token', 'secret', 'key_hash', 'api_key', 'cpf',
    'credit_card', 'card_number', 'cvv', 'ssn', 'bank_account',
    'salary', 'base_salary', 'net_salary', 'amount_brl', 'revenue',
  ]);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (BLOCKED_KEYS.has(k.toLowerCase())) continue;
    clean[k] = v;
  }
  return clean;
}

// ══════════════════════════════════════════════
// Bridge: BillingCore → Signal
// ══════════════════════════════════════════════

function mapBillingSeverity(type: BillingDomainEvent['type']): SignalSeverity {
  switch (type) {
    case 'UsageOverageCalculated': return 'warning';
    case 'TenantPlanUpgraded':
    case 'TenantPlanAssigned': return 'info';
    case 'InvoiceGenerated':
    case 'RevenueUpdated': return 'info';
    case 'CouponRedeemed':
    case 'CouponCreated': return 'info';
    case 'InvoiceDiscountApplied': return 'info';
    default: return 'info';
  }
}

function bridgeBillingEvents(): () => void {
  return onBillingEvent((event) => {
    PlatformSignalCollector.emit(
      'billing' as SignalSource,
      event.type,
      mapBillingSeverity(event.type),
      sanitize({ type: event.type, tenant_id: event.tenant_id }),
      event.tenant_id,
      'billing-core',
    );
  });
}

// ══════════════════════════════════════════════
// Bridge: Growth / Landing Engine → Signal
// ══════════════════════════════════════════════

function mapGrowthSeverity(type: GrowthDomainEvent['type']): SignalSeverity {
  switch (type) {
    case 'GrowthInsightGenerated': return 'warning';
    case 'ConversionTracked': return 'info';
    case 'LandingPagePublished':
    case 'WebsitePublished': return 'info';
    default: return 'info';
  }
}

function bridgeGrowthEvents(): () => void {
  return onGrowthEvent((event) => {
    const pageId = 'pageId' in event ? (event as any).pageId : undefined;
    PlatformSignalCollector.emit(
      'module' as SignalSource,
      `growth:${event.type}`,
      mapGrowthSeverity(event.type),
      sanitize({ type: event.type, pageId }),
      undefined,
      'landing-engine',
    );
  });
}

// ══════════════════════════════════════════════
// Bridge: Automation Engine → Signal (manual emit helper)
// ══════════════════════════════════════════════

export function emitAutomationSignal(
  eventType: 'workflow_executed' | 'workflow_failed' | 'workflow_created' | 'workflow_activated',
  payload: { workflow_id: string; tenant_id?: string; duration_ms?: number; error?: string; retry_count?: number },
): void {
  const severity: SignalSeverity = eventType === 'workflow_failed' ? 'critical' : 'info';
  PlatformSignalCollector.emit(
    'automation' as SignalSource,
    `automation:${eventType}`,
    severity,
    sanitize({
      workflow_id: payload.workflow_id,
      duration_ms: payload.duration_ms,
      has_error: !!payload.error,
      retry_count: payload.retry_count,
    }),
    payload.tenant_id,
    'integration-automation',
  );
}

// ══════════════════════════════════════════════
// Bridge: API Management → Signal (manual emit helper)
// ══════════════════════════════════════════════

export function emitApiManagementSignal(
  eventType: 'rate_limit_exceeded' | 'scope_violation' | 'client_created' | 'client_suspended' | 'key_rotated' | 'version_deprecated',
  payload: { tenant_id?: string; client_id?: string; endpoint?: string },
): void {
  const severity: SignalSeverity =
    eventType === 'rate_limit_exceeded' || eventType === 'scope_violation' ? 'warning' :
    eventType === 'client_suspended' ? 'critical' : 'info';

  PlatformSignalCollector.emit(
    'api' as SignalSource,
    `pams:${eventType}`,
    severity,
    sanitize({ client_id: payload.client_id, endpoint: payload.endpoint }),
    payload.tenant_id,
    'api-management',
  );
}

// ══════════════════════════════════════════════
// Bridge: Developer Marketplace → Signal
// ══════════════════════════════════════════════

export function emitMarketplaceSignal(
  eventType: 'app_installed' | 'app_uninstalled' | 'app_review_submitted' | 'app_suspended',
  payload: { tenant_id?: string; app_id?: string },
): void {
  const severity: SignalSeverity = eventType === 'app_suspended' ? 'warning' : 'info';
  PlatformSignalCollector.emit(
    'module' as SignalSource,
    `marketplace:${eventType}`,
    severity,
    sanitize({ app_id: payload.app_id }),
    payload.tenant_id,
    'developer-marketplace',
  );
}

// ══════════════════════════════════════════════
// Bridge: Versioning Engine → Signal
// ══════════════════════════════════════════════

export function emitVersioningSignal(
  eventType: 'version_published' | 'version_rollback' | 'version_deprecated',
  payload: { module_key?: string; version_tag?: string; tenant_id?: string },
): void {
  const severity: SignalSeverity = eventType === 'version_rollback' ? 'warning' : 'info';
  PlatformSignalCollector.emit(
    'module' as SignalSource,
    `versioning:${eventType}`,
    severity,
    sanitize({ version_tag: payload.version_tag }),
    payload.tenant_id,
    payload.module_key ?? 'versioning',
  );
}

// ══════════════════════════════════════════════
// Bridge: Observability Metrics → Signal
// ══════════════════════════════════════════════

export function emitObservabilitySignal(
  eventType: 'latency_spike' | 'error_rate_high' | 'resource_saturation',
  payload: { module_key?: string; metric_name?: string; value?: number; threshold?: number },
): void {
  PlatformSignalCollector.emit(
    'module' as SignalSource,
    `observability:${eventType}`,
    'warning',
    sanitize({ metric_name: payload.metric_name, value: payload.value, threshold: payload.threshold }),
    undefined,
    payload.module_key ?? 'observability',
  );
}

// ══════════════════════════════════════════════
// Initializer — call once at app startup
// ══════════════════════════════════════════════

let _teardownFns: (() => void)[] = [];

export function initSignalBridge(): () => void {
  // Auto-subscribe to event buses
  _teardownFns.push(bridgeBillingEvents());
  _teardownFns.push(bridgeGrowthEvents());

  console.info('[SignalBridge] Initialized — listening to BillingCore, Growth Engine');

  return () => {
    _teardownFns.forEach(fn => fn());
    _teardownFns = [];
    console.info('[SignalBridge] Torn down');
  };
}
