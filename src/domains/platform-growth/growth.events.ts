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
