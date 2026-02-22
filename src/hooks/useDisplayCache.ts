/**
 * useDisplayCache — Lightweight browser cache for TV display data.
 *
 * Features:
 *   ✅ sessionStorage persistence (survives refresh, not tab close)
 *   ✅ TTL-based expiry (default 5 min)
 *   ✅ Incremental merge (patch only changed fields)
 *   ✅ Version-stamped to avoid stale structure
 */
import { useCallback, useRef } from 'react';

const CACHE_VERSION = 2;

interface CacheEntry<T> {
  version: number;
  data: T;
  updatedAt: number;
  etag: string;
}

interface UseDisplayCacheOptions {
  key: string;
  ttlMs?: number;
}

export function useDisplayCache<T extends Record<string, any>>({ key, ttlMs = 300_000 }: UseDisplayCacheOptions) {
  const storageKey = `tv_cache_${key}`;
  const etagRef = useRef<string>('');

  const computeEtag = (data: T): string => {
    try {
      const str = JSON.stringify(data);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
      }
      return hash.toString(36);
    } catch {
      return Date.now().toString(36);
    }
  };

  const read = useCallback((): T | null => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (entry.version !== CACHE_VERSION) return null;
      if (Date.now() - entry.updatedAt > ttlMs) {
        sessionStorage.removeItem(storageKey);
        return null;
      }
      etagRef.current = entry.etag;
      return entry.data;
    } catch {
      return null;
    }
  }, [storageKey, ttlMs]);

  const write = useCallback((data: T): boolean => {
    const etag = computeEtag(data);
    // Skip write if data hasn't changed
    if (etag === etagRef.current) return false;
    etagRef.current = etag;
    try {
      const entry: CacheEntry<T> = {
        version: CACHE_VERSION,
        data,
        updatedAt: Date.now(),
        etag,
      };
      sessionStorage.setItem(storageKey, JSON.stringify(entry));
      return true;
    } catch {
      // Storage full — clear old TV caches
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k?.startsWith('tv_cache_') && k !== storageKey) {
          sessionStorage.removeItem(k);
        }
      }
      return false;
    }
  }, [storageKey]);

  /** Merge partial update into cached data */
  const merge = useCallback((partial: Partial<T>): T | null => {
    const existing = read();
    if (!existing) return null;
    const merged = { ...existing, ...partial } as T;
    write(merged);
    return merged;
  }, [read, write]);

  const clear = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    etagRef.current = '';
  }, [storageKey]);

  return { read, write, merge, clear };
}
