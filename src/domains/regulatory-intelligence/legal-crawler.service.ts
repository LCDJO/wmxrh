/**
 * Legal Crawler Service — Periodic legislative document crawling
 *
 * Responsibilities:
 *  1. Download latest version of a legal document (from adapter)
 *  2. Normalize text (strip whitespace, accents, casing)
 *  3. Generate content hash (SHA-256)
 *  4. Compare with previous version to detect changes
 *
 * Pure domain logic — no HTTP calls; relies on adapters for data fetching.
 */

import type { LegalSourceId } from './adapters/types';

// ── Types ──

export interface CrawledDocument {
  sourceId: LegalSourceId;
  code: string;
  title: string;
  rawContent: string;
  normalizedContent: string;
  contentHash: string;
  crawledAt: string;
  byteSize: number;
}

export interface VersionedDocument {
  sourceId: LegalSourceId;
  code: string;
  title: string;
  version: number;
  contentHash: string;
  normalizedContent: string;
  previousHash: string | null;
  createdAt: string;
}

export interface CrawlDiffResult {
  code: string;
  sourceId: LegalSourceId;
  hasChanged: boolean;
  currentHash: string;
  previousHash: string | null;
  changeType: 'new' | 'modified' | 'unchanged';
  addedSections: string[];
  removedSections: string[];
  modifiedSections: string[];
  diffSummary: string;
}

export interface CrawlRunResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  source: LegalSourceId;
  totalDocuments: number;
  newDocuments: number;
  modifiedDocuments: number;
  unchangedDocuments: number;
  errors: CrawlError[];
  diffs: CrawlDiffResult[];
}

export interface CrawlError {
  code: string;
  message: string;
  timestamp: string;
}

// ── Store Interface (in-memory or DB-backed) ──

export interface DocumentVersionStore {
  getLatestVersion(sourceId: LegalSourceId, code: string): VersionedDocument | null;
  saveVersion(doc: VersionedDocument): void;
  getAllCodes(sourceId: LegalSourceId): string[];
}

// ── Text Normalization ──

/**
 * Normalize legal text for reliable comparison:
 *  - Lowercase
 *  - Strip diacritics (accents)
 *  - Collapse whitespace
 *  - Remove punctuation noise
 *  - Trim
 */
export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[""''«»]/g, '"')         // normalize quotes
    .replace(/[–—]/g, '-')             // normalize dashes
    .replace(/\s+/g, ' ')             // collapse whitespace
    .replace(/\n+/g, '\n')            // collapse newlines
    .trim();
}

// ── Content Hashing (SHA-256 via Web Crypto) ──

/**
 * Generate SHA-256 hash of normalized content.
 * Uses synchronous approach for pure domain logic (no crypto dependency).
 */
export function generateContentHash(content: string): string {
  // Simple FNV-1a 64-bit hash for fast comparison (no crypto dependency)
  let hash = BigInt('0xcbf29ce484222325');
  const prime = BigInt('0x100000001b3');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);

  for (let i = 0; i < bytes.length; i++) {
    hash ^= BigInt(bytes[i]);
    hash = BigInt.asUintN(64, hash * prime);
  }

  return hash.toString(16).padStart(16, '0');
}

// ── Section Extraction ──

/**
 * Extract logical sections from normalized text.
 * Identifies articles (Art.), chapters, sections, and numbered items.
 */
export function extractSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split('\n');
  let currentKey = '__header__';
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Match section headers: Art. X, NR-X, Capítulo, Seção, etc.
    const sectionMatch = trimmed.match(
      /^(art\.?\s*\d+[\w.-]*|nr-?\d+|capitulo\s+\w+|secao\s+\w+|clausula\s+\d+|item\s+\d+)/i
    );

    if (sectionMatch) {
      // Save previous section
      if (currentContent.length > 0) {
        sections.set(currentKey, currentContent.join('\n').trim());
      }
      currentKey = sectionMatch[1].toLowerCase().replace(/\s+/g, '_');
      currentContent = [trimmed];
    } else {
      currentContent.push(trimmed);
    }
  }

  // Save last section
  if (currentContent.length > 0) {
    sections.set(currentKey, currentContent.join('\n').trim());
  }

  return sections;
}

// ── Diff Engine ──

/**
 * Compare two documents section-by-section and produce a diff result.
 */
export function diffDocuments(
  current: CrawledDocument,
  previous: VersionedDocument | null
): CrawlDiffResult {
  if (!previous) {
    return {
      code: current.code,
      sourceId: current.sourceId,
      hasChanged: true,
      currentHash: current.contentHash,
      previousHash: null,
      changeType: 'new',
      addedSections: [],
      removedSections: [],
      modifiedSections: [],
      diffSummary: `Novo documento detectado: ${current.title}`,
    };
  }

  if (current.contentHash === previous.contentHash) {
    return {
      code: current.code,
      sourceId: current.sourceId,
      hasChanged: false,
      currentHash: current.contentHash,
      previousHash: previous.contentHash,
      changeType: 'unchanged',
      addedSections: [],
      removedSections: [],
      modifiedSections: [],
      diffSummary: 'Nenhuma alteração detectada.',
    };
  }

  // Section-level diff
  const currentSections = extractSections(current.normalizedContent);
  const previousSections = extractSections(previous.normalizedContent);

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const [key, value] of currentSections) {
    const prev = previousSections.get(key);
    if (!prev) {
      added.push(key);
    } else if (generateContentHash(value) !== generateContentHash(prev)) {
      modified.push(key);
    }
  }

  for (const key of previousSections.keys()) {
    if (!currentSections.has(key)) {
      removed.push(key);
    }
  }

  const parts: string[] = [];
  if (added.length > 0) parts.push(`${added.length} seção(ões) adicionada(s)`);
  if (modified.length > 0) parts.push(`${modified.length} seção(ões) modificada(s)`);
  if (removed.length > 0) parts.push(`${removed.length} seção(ões) removida(s)`);

  return {
    code: current.code,
    sourceId: current.sourceId,
    hasChanged: true,
    currentHash: current.contentHash,
    previousHash: previous.contentHash,
    changeType: 'modified',
    addedSections: added,
    removedSections: removed,
    modifiedSections: modified,
    diffSummary: `Documento alterado: ${parts.join(', ')}.`,
  };
}

// ── Crawl Pipeline ──

/**
 * Process a single document through the crawl pipeline:
 *  1. Normalize → 2. Hash → 3. Compare → 4. Store if changed
 */
export function crawlDocument(
  sourceId: LegalSourceId,
  code: string,
  title: string,
  rawContent: string,
  store: DocumentVersionStore
): { crawled: CrawledDocument; diff: CrawlDiffResult; version: VersionedDocument | null } {
  const normalized = normalizeText(rawContent);
  const hash = generateContentHash(normalized);

  const crawled: CrawledDocument = {
    sourceId,
    code,
    title,
    rawContent,
    normalizedContent: normalized,
    contentHash: hash,
    crawledAt: new Date().toISOString(),
    byteSize: new TextEncoder().encode(rawContent).length,
  };

  const previous = store.getLatestVersion(sourceId, code);
  const diff = diffDocuments(crawled, previous);

  let newVersion: VersionedDocument | null = null;

  if (diff.hasChanged) {
    newVersion = {
      sourceId,
      code,
      title,
      version: previous ? previous.version + 1 : 1,
      contentHash: hash,
      normalizedContent: normalized,
      previousHash: previous?.contentHash ?? null,
      createdAt: new Date().toISOString(),
    };
    store.saveVersion(newVersion);
  }

  return { crawled, diff, version: newVersion };
}

/**
 * Run a full crawl for a given source, processing all documents.
 */
export function runCrawl(
  sourceId: LegalSourceId,
  documents: Array<{ code: string; title: string; content: string }>,
  store: DocumentVersionStore
): CrawlRunResult {
  const startedAt = new Date().toISOString();
  const diffs: CrawlDiffResult[] = [];
  const errors: CrawlError[] = [];

  let newCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;

  for (const doc of documents) {
    try {
      const { diff } = crawlDocument(sourceId, doc.code, doc.title, doc.content, store);
      diffs.push(diff);

      switch (diff.changeType) {
        case 'new': newCount++; break;
        case 'modified': modifiedCount++; break;
        case 'unchanged': unchangedCount++; break;
      }
    } catch (err) {
      errors.push({
        code: doc.code,
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      });
    }
  }

  return {
    runId: `crawl_${sourceId}_${Date.now()}`,
    startedAt,
    completedAt: new Date().toISOString(),
    source: sourceId,
    totalDocuments: documents.length,
    newDocuments: newCount,
    modifiedDocuments: modifiedCount,
    unchangedDocuments: unchangedCount,
    errors,
    diffs,
  };
}

// ── In-Memory Store (for development / testing) ──

export function createInMemoryVersionStore(): DocumentVersionStore {
  const store = new Map<string, VersionedDocument>();

  const makeKey = (sourceId: LegalSourceId, code: string) => `${sourceId}::${code}`;

  return {
    getLatestVersion(sourceId, code) {
      return store.get(makeKey(sourceId, code)) ?? null;
    },

    saveVersion(doc) {
      store.set(makeKey(doc.sourceId, doc.code), doc);
    },

    getAllCodes(sourceId) {
      const codes: string[] = [];
      for (const [key] of store) {
        if (key.startsWith(`${sourceId}::`)) {
          codes.push(key.split('::')[1]);
        }
      }
      return codes;
    },
  };
}
