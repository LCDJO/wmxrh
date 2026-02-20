/**
 * Legal Source Adapters — Shared Types
 *
 * Common interfaces for all legal data source adapters.
 */

export type LegalSourceId = 'nr' | 'clt' | 'esocial' | 'cnae' | 'cbo' | 'cct';

export interface LegalSourceAdapter<T = unknown> {
  readonly sourceId: LegalSourceId;
  readonly sourceName: string;
  readonly sourceUrl: string;

  /** Fetch all available items from this source */
  fetchAll(tenantId: string): Promise<LegalSourceResult<T[]>>;

  /** Fetch a single item by code/id */
  fetchByCode(tenantId: string, code: string): Promise<LegalSourceResult<T | null>>;

  /** Check if source has updates since a given date */
  checkForUpdates(since: string): Promise<LegalSourceResult<LegalSourceUpdateCheck>>;
}

export interface LegalSourceResult<T> {
  success: boolean;
  data: T;
  source: LegalSourceId;
  fetchedAt: string;
  error?: string;
}

export interface LegalSourceUpdateCheck {
  hasUpdates: boolean;
  lastChecked: string;
  updatedItems: { code: string; title: string; updatedAt: string }[];
}

/** Batch sync options */
export interface SyncOptions {
  batchSize?: number;
  onProgress?: (processed: number, total: number) => void;
  dryRun?: boolean;
}

export interface SyncResult {
  source: LegalSourceId;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  duration_ms: number;
}
