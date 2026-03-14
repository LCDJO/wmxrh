/**
 * useSchemaData — Fetches and caches database schema from edge function.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SchemaColumn {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  ordinal_position: number;
}

export interface SchemaTable {
  table_name: string;
  table_type: string;
  columns: SchemaColumn[];
  constraints: { constraint_name: string; constraint_type: string }[];
}

export interface ForeignKey {
  constraint_name: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
}

export interface PrimaryKey {
  table_name: string;
  column_name: string;
}

export interface SchemaIndex {
  table_name: string;
  index_name: string;
  column_name: string;
  is_unique: boolean;
}

export interface SchemaData {
  tables: SchemaTable[];
  foreign_keys: ForeignKey[];
  primary_keys: PrimaryKey[];
  indexes: SchemaIndex[];
  generated_at: string;
}

const CACHE_KEY = 'system_atlas_schema_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function getCache(): SchemaData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached._cachedAt > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

function setCache(data: SchemaData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, _cachedAt: Date.now() }));
  } catch {}
}

export function useSchemaData() {
  const [data, setData] = useState<SchemaData | null>(getCache);
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  const fetchSchema = useCallback(async (force = false) => {
    if (!force && data) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('schema-introspection');
      if (fnError) throw fnError;
      const schema = result as SchemaData;
      setData(schema);
      setCache(schema);
    } catch (err: any) {
      setError(err.message || 'Failed to load schema');
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    if (!data) fetchSchema();
  }, []);

  return { data, loading, error, refresh: () => fetchSchema(true) };
}
