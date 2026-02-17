/**
 * Growth Domain Events
 *
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  Typed domain events emitted by the Growth / LP layer:         ║
 * ║                                                                ║
 * ║  1. LandingPageCreated        → new LP drafted                 ║
 * ║  2. LandingPagePublished      → LP goes live (permission-gated)║
 * ║  3. FABContentUpdated         → FAB block content changed      ║
 * ║  4. ConversionTracked         → conversion event recorded      ║
 * ║  5. GrowthInsightGenerated    → governance finding created     ║
 * ║                                                                ║
 * ║  Pure data — NO UI, NO side-effects inside this file.          ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

// ════════════════════════════════════
// EVENT TYPES
// ════════════════════════════════════

export type GrowthEventType =
  | 'LandingPageCreated'
  | 'LandingPagePublished'
  | 'FABContentUpdated'
  | 'ConversionTracked'
  | 'GrowthInsightGenerated'
  | 'WebsitePublished'
  | 'LandingVersionCreated'
  | 'AIConversionSuggested'
  | 'FABSectionGenerated'
  | 'GTMInjected';

// ── Payloads ──

export interface LandingPageCreatedPayload {
  type: 'LandingPageCreated';
  timestamp: number;
  pageId: string;
  pageName: string;
  slug: string;
  blocksCount: number;
  createdBy: string;
}

export interface LandingPagePublishedPayload {
  type: 'LandingPagePublished';
  timestamp: number;
  pageId: string;
  pageName: string;
  slug: string;
  publishedBy: string;
  /** Role that authorized publishing */
  publisherRole: string;
}

export interface FABContentUpdatedPayload {
  type: 'FABContentUpdated';
  timestamp: number;
  pageId: string;
  blockId: string;
  blockType: string;
  changedFields: ('feature' | 'advantage' | 'benefit')[];
  updatedBy: string;
}

export interface ConversionTrackedPayload {
  type: 'ConversionTracked';
  timestamp: number;
  pageId: string;
  conversionType: string;
  source: string;
  referralCode?: string;
  tenantId?: string;
  revenue?: number;
}

export interface GrowthInsightGeneratedPayload {
  type: 'GrowthInsightGenerated';
  timestamp: number;
  insightId: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  pageId: string;
  pageName: string;
  title: string;
}

// ── New Website / Growth Payloads ──

export interface WebsitePublishedEventPayload {
  type: 'WebsitePublished';
  timestamp: number;
  pageId: string;
  pageSlug: string;
  pageTitle: string;
  version: number;
  publishedBy: string;
  publisherRole: string;
  url: string;
}

export interface LandingVersionCreatedEventPayload {
  type: 'LandingVersionCreated';
  timestamp: number;
  pageId: string;
  pageTitle: string;
  versionNumber: number;
  changeSummary: string;
  createdBy: string;
}

export interface AIConversionSuggestedEventPayload {
  type: 'AIConversionSuggested';
  timestamp: number;
  pageId: string;
  pageTitle: string;
  suggestionId: string;
  category: string;
  predictedLiftPct: number;
  confidence: number;
}

export interface FABSectionGeneratedEventPayload {
  type: 'FABSectionGenerated';
  timestamp: number;
  pageId: string;
  blockId: string;
  blockType: string;
  fieldsGenerated: ('feature' | 'advantage' | 'benefit')[];
  generatedBy: 'ai' | 'manual';
}

export interface GTMInjectedEventPayload {
  type: 'GTMInjected';
  timestamp: number;
  pageId: string;
  pageSlug: string;
  containerId: string;
  eventsCount: number;
  injectedBy: string;
}

// ── Union ──

export type GrowthDomainEvent =
  | LandingPageCreatedPayload
  | LandingPagePublishedPayload
  | FABContentUpdatedPayload
  | ConversionTrackedPayload
  | GrowthInsightGeneratedPayload
  | WebsitePublishedEventPayload
  | LandingVersionCreatedEventPayload
  | AIConversionSuggestedEventPayload
  | FABSectionGeneratedEventPayload
  | GTMInjectedEventPayload;

// ════════════════════════════════════
// EVENT BUS (synchronous, in-memory)
// ════════════════════════════════════

type GrowthEventListener<T extends GrowthDomainEvent = GrowthDomainEvent> = (event: T) => void;

const globalListeners = new Set<GrowthEventListener>();
const typedListeners = new Map<GrowthEventType, Set<GrowthEventListener<any>>>();

/** Subscribe to ALL growth domain events. */
export function onGrowthEvent(listener: GrowthEventListener): () => void {
  globalListeners.add(listener);
  return () => { globalListeners.delete(listener); };
}

/** Subscribe to a specific growth event type. */
export function onGrowthEventType<T extends GrowthDomainEvent>(
  type: T['type'],
  listener: GrowthEventListener<T>,
): () => void {
  if (!typedListeners.has(type)) typedListeners.set(type, new Set());
  typedListeners.get(type)!.add(listener);
  return () => { typedListeners.get(type)?.delete(listener); };
}

/** Emit a growth domain event. */
export function emitGrowthEvent(event: GrowthDomainEvent): void {
  for (const l of globalListeners) {
    try { l(event); } catch { /* swallow */ }
  }
  const typed = typedListeners.get(event.type);
  if (typed) {
    for (const l of typed) {
      try { l(event); } catch { /* swallow */ }
    }
  }
  eventLog.unshift(event);
  if (eventLog.length > MAX_LOG) eventLog.pop();
}

// ════════════════════════════════════
// EVENT LOG (debugging)
// ════════════════════════════════════

const MAX_LOG = 100;
const eventLog: GrowthDomainEvent[] = [];

export function getGrowthEventLog(): ReadonlyArray<GrowthDomainEvent> {
  return eventLog;
}

export function clearGrowthEventLog(): void {
  eventLog.length = 0;
}

export const __DOMAIN_CATALOG = {
  domain: 'Growth AI',
  color: 'hsl(340 75% 55%)',
  events: [
    { name: 'LandingPageCreated', description: 'Nova landing page criada no builder' },
    { name: 'LandingPagePublished', description: 'Landing page publicada (permission-gated)' },
    { name: 'FABContentUpdated', description: 'Conteúdo FAB de um bloco atualizado' },
    { name: 'ConversionTracked', description: 'Evento de conversão registrado no funil' },
    { name: 'GrowthInsightGenerated', description: 'Insight de crescimento gerado por IA' },
    { name: 'WebsitePublished', description: 'Website publicado em produção' },
    { name: 'LandingVersionCreated', description: 'Snapshot versionado de landing page criado' },
    { name: 'AIConversionSuggested', description: 'Sugestão de conversão por IA' },
    { name: 'FABSectionGenerated', description: 'Seção FAB gerada pelo Content Engine' },
    { name: 'GTMInjected', description: 'Container GTM injetado na página' },
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
    { name: 'PublicAPIRequest', description: 'Requisição processada pelo PublicAPI Gateway' },
    { name: 'PublicAPIRateLimited', description: 'Requisição bloqueada por rate limiting' },
    { name: 'PublicAPITokenIssued', description: 'Token público limitado emitido' },
    { name: 'VersionSnapshotCreated', description: 'Snapshot de versão criado para landing page' },
    { name: 'SecurePublishExecuted', description: 'Publicação segura executada via pipeline' },
    { name: 'RollbackApplied', description: 'Rollback de versão aplicado em landing page' },
  ],
};
