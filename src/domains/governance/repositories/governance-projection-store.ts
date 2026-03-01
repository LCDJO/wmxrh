/**
 * GovernanceCoreEngine — Projection Store
 *
 * Materialised read-model persistence.
 * Projections are upserted (INSERT ON CONFLICT UPDATE).
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface ProjectionRecord {
  tenant_id: string;
  projection_name: string;
  aggregate_type: string;
  aggregate_id: string;
  state: Record<string, unknown>;
  version: number;
  last_event_id: string | null;
}

export class GovernanceProjectionStore {
  /** Upsert a projection. */
  async save(record: ProjectionRecord): Promise<void> {
    const { error } = await supabase
      .from('governance_projections')
      .upsert([{
        tenant_id: record.tenant_id,
        projection_name: record.projection_name,
        aggregate_type: record.aggregate_type,
        aggregate_id: record.aggregate_id,
        state: JSON.parse(JSON.stringify(record.state)) as Json,
        version: record.version,
        last_event_id: record.last_event_id,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'tenant_id,projection_name,aggregate_type,aggregate_id' });

    if (error) throw new Error(`[ProjectionStore] save failed: ${error.message}`);
  }

  /** Load a single projection. */
  async load(
    tenantId: string,
    projectionName: string,
    aggregateType: string,
    aggregateId: string,
  ): Promise<ProjectionRecord | null> {
    const { data, error } = await supabase
      .from('governance_projections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('projection_name', projectionName)
      .eq('aggregate_type', aggregateType)
      .eq('aggregate_id', aggregateId)
      .maybeSingle();

    if (error) throw new Error(`[ProjectionStore] load failed: ${error.message}`);
    if (!data) return null;

    return {
      tenant_id: data.tenant_id,
      projection_name: data.projection_name,
      aggregate_type: data.aggregate_type,
      aggregate_id: data.aggregate_id,
      state: (data.state ?? {}) as Record<string, unknown>,
      version: data.version,
      last_event_id: data.last_event_id,
    };
  }

  /** List projections by name (e.g. all employee lifecycle projections). */
  async listByProjection(
    tenantId: string,
    projectionName: string,
    opts?: { limit?: number },
  ): Promise<ProjectionRecord[]> {
    const { data, error } = await supabase
      .from('governance_projections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('projection_name', projectionName)
      .order('updated_at', { ascending: false })
      .limit(opts?.limit ?? 50);

    if (error) throw new Error(`[ProjectionStore] list failed: ${error.message}`);
    return (data ?? []).map(row => ({
      tenant_id: row.tenant_id,
      projection_name: row.projection_name,
      aggregate_type: row.aggregate_type,
      aggregate_id: row.aggregate_id,
      state: (row.state ?? {}) as Record<string, unknown>,
      version: row.version,
      last_event_id: row.last_event_id,
    }));
  }
}
