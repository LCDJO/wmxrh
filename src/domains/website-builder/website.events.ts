/**
 * Website Builder Domain Events
 *
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  Lifecycle events for the Website Builder module:              ║
 * ║                                                                ║
 * ║  1. WebsiteDraftCreated        → new draft page created        ║
 * ║  2. WebsiteSubmitted           → draft submitted for review    ║
 * ║  3. WebsiteApproved            → page approved by governance   ║
 * ║  4. WebsitePublished           → page published to production  ║
 * ║  5. ComplianceWarningDetected  → compliance issue found        ║
 * ║                                                                ║
 * ║  Pure data — NO UI, NO side-effects inside this file.          ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

// ════════════════════════════════════
// EVENT TYPES
// ════════════════════════════════════

export type WebsiteEventType =
  | 'WebsiteDraftCreated'
  | 'WebsiteSubmitted'
  | 'WebsiteApproved'
  | 'WebsitePublished'
  | 'ComplianceWarningDetected';

// ── Payloads ──

export interface WebsiteDraftCreatedPayload {
  type: 'WebsiteDraftCreated';
  timestamp: number;
  pageId: string;
  pageTitle: string;
  slug: string;
  blocksCount: number;
  createdBy: string;
}

export interface WebsiteSubmittedPayload {
  type: 'WebsiteSubmitted';
  timestamp: number;
  pageId: string;
  pageTitle: string;
  slug: string;
  submittedBy: string;
  submitterRole: string;
  blocksCount: number;
  seoScore: number;
}

export interface WebsiteApprovedPayload {
  type: 'WebsiteApproved';
  timestamp: number;
  pageId: string;
  pageTitle: string;
  slug: string;
  approvedBy: string;
  approverRole: string;
  complianceIssues: number;
  version: number;
}

export interface WebsitePublishedPayload {
  type: 'WebsitePublished';
  timestamp: number;
  pageId: string;
  pageTitle: string;
  slug: string;
  version: number;
  publishedBy: string;
  publisherRole: string;
  url: string;
}

export interface ComplianceWarningDetectedPayload {
  type: 'ComplianceWarningDetected';
  timestamp: number;
  pageId: string;
  pageTitle: string;
  warningId: string;
  category: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  description: string;
}

// ── Union ──

export type WebsiteDomainEvent =
  | WebsiteDraftCreatedPayload
  | WebsiteSubmittedPayload
  | WebsiteApprovedPayload
  | WebsitePublishedPayload
  | ComplianceWarningDetectedPayload;

// ════════════════════════════════════
// EVENT BUS (synchronous, in-memory)
// ════════════════════════════════════

type WebsiteEventListener<T extends WebsiteDomainEvent = WebsiteDomainEvent> = (event: T) => void;

const globalListeners = new Set<WebsiteEventListener>();
const typedListeners = new Map<WebsiteEventType, Set<WebsiteEventListener<any>>>();

/** Subscribe to ALL website domain events. */
export function onWebsiteEvent(listener: WebsiteEventListener): () => void {
  globalListeners.add(listener);
  return () => { globalListeners.delete(listener); };
}

/** Subscribe to a specific website event type. */
export function onWebsiteEventType<T extends WebsiteDomainEvent>(
  type: T['type'],
  listener: WebsiteEventListener<T>,
): () => void {
  if (!typedListeners.has(type)) typedListeners.set(type, new Set());
  typedListeners.get(type)!.add(listener);
  return () => { typedListeners.get(type)?.delete(listener); };
}

/** Emit a website domain event. */
export function emitWebsiteEvent(event: WebsiteDomainEvent): void {
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
// CONVENIENCE EMITTERS
// ════════════════════════════════════

export const websiteEvents = {
  draftCreated(pageId: string, pageTitle: string, slug: string, blocksCount: number, createdBy: string) {
    emitWebsiteEvent({ type: 'WebsiteDraftCreated', timestamp: Date.now(), pageId, pageTitle, slug, blocksCount, createdBy });
  },

  submitted(pageId: string, pageTitle: string, slug: string, submittedBy: string, submitterRole: string, blocksCount: number, seoScore: number) {
    emitWebsiteEvent({ type: 'WebsiteSubmitted', timestamp: Date.now(), pageId, pageTitle, slug, submittedBy, submitterRole, blocksCount, seoScore });
  },

  approved(pageId: string, pageTitle: string, slug: string, approvedBy: string, approverRole: string, complianceIssues: number, version: number) {
    emitWebsiteEvent({ type: 'WebsiteApproved', timestamp: Date.now(), pageId, pageTitle, slug, approvedBy, approverRole, complianceIssues, version });
  },

  published(pageId: string, pageTitle: string, slug: string, version: number, publishedBy: string, publisherRole: string, url: string) {
    emitWebsiteEvent({ type: 'WebsitePublished', timestamp: Date.now(), pageId, pageTitle, slug, version, publishedBy, publisherRole, url });
  },

  complianceWarning(pageId: string, pageTitle: string, warningId: string, category: string, severity: 'info' | 'warning' | 'error', title: string, description: string) {
    emitWebsiteEvent({ type: 'ComplianceWarningDetected', timestamp: Date.now(), pageId, pageTitle, warningId, category, severity, title, description });
  },
};

// ════════════════════════════════════
// EVENT LOG (debugging)
// ════════════════════════════════════

const MAX_LOG = 100;
const eventLog: WebsiteDomainEvent[] = [];

export function getWebsiteEventLog(): ReadonlyArray<WebsiteDomainEvent> {
  return eventLog;
}

export function clearWebsiteEventLog(): void {
  eventLog.length = 0;
}
