/**
 * Workflow Versioning Service
 *
 * Manages immutable version snapshots of workflow definitions.
 * Each version captures nodes + edges at a point in time, enabling:
 *  - Version history browsing
 *  - Rollback to previous versions
 *  - Publishing versions for production execution
 *  - Semantic version tags (v1.0.0, v1.1.0, etc.)
 */

import { supabase } from '@/integrations/supabase/client';
import type { WfCanvasNode, WfCanvasEdge } from './types';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  tenantId: string;
  versionNumber: number;
  versionTag: string | null;
  nodesSnapshot: WfCanvasNode[];
  edgesSnapshot: WfCanvasEdge[];
  changeSummary: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export interface CreateVersionParams {
  workflowId: string;
  tenantId: string;
  nodes: WfCanvasNode[];
  edges: WfCanvasEdge[];
  versionTag?: string;
  changeSummary?: string;
  publishImmediately?: boolean;
  publishedBy?: string;
}

// ════════════════════════════════════
// SEMVER HELPERS
// ════════════════════════════════════

/** Generate next version tag from existing tags. */
export function nextVersionTag(
  existing: string[],
  bump: 'major' | 'minor' | 'patch' = 'patch',
): string {
  if (existing.length === 0) return 'v1.0.0';

  const parsed = existing
    .map(t => t.replace(/^v/, ''))
    .map(t => {
      const [maj, min, pat] = t.split('.').map(Number);
      return { major: maj || 0, minor: min || 0, patch: pat || 0 };
    })
    .sort((a, b) =>
      a.major !== b.major ? b.major - a.major :
      a.minor !== b.minor ? b.minor - a.minor :
      b.patch - a.patch,
    );

  const latest = parsed[0];
  switch (bump) {
    case 'major': return `v${latest.major + 1}.0.0`;
    case 'minor': return `v${latest.major}.${latest.minor + 1}.0`;
    case 'patch': return `v${latest.major}.${latest.minor}.${latest.patch + 1}`;
  }
}

// ════════════════════════════════════
// SERVICE
// ════════════════════════════════════

export const WorkflowVersioningService = {
  /** Create a new immutable version snapshot. */
  async createVersion(params: CreateVersionParams): Promise<WorkflowVersion> {
    // Get next version number
    const { data: maxRow } = await supabase
      .from('integration_workflow_versions')
      .select('version_number')
      .eq('workflow_id', params.workflowId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextNumber = (maxRow?.version_number ?? 0) + 1;

    // Auto-generate version tag if not provided
    let tag = params.versionTag;
    if (!tag) {
      const { data: tags } = await supabase
        .from('integration_workflow_versions')
        .select('version_tag')
        .eq('workflow_id', params.workflowId)
        .not('version_tag', 'is', null);

      tag = nextVersionTag(
        (tags ?? []).map(t => t.version_tag).filter(Boolean) as string[],
      );
    }

    const record = {
      workflow_id: params.workflowId,
      tenant_id: params.tenantId,
      version_number: nextNumber,
      version_tag: tag,
      nodes: JSON.parse(JSON.stringify(params.nodes)),
      edges: JSON.parse(JSON.stringify(params.edges)),
      change_summary: params.changeSummary ?? null,
      published_at: params.publishImmediately ? new Date().toISOString() : null,
      published_by: params.publishedBy ?? null,
      is_current: params.publishImmediately ?? false,
    };

    const { data, error } = await supabase
      .from('integration_workflow_versions')
      .insert([record])
      .select()
      .single();

    if (error) throw new Error(`Failed to create version: ${error.message}`);
    return mapRow(data);
  },

  /** List all versions for a workflow, newest first. */
  async listVersions(workflowId: string): Promise<WorkflowVersion[]> {
    const { data, error } = await supabase
      .from('integration_workflow_versions')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('version_number', { ascending: false });

    if (error) throw new Error(`Failed to list versions: ${error.message}`);
    return (data ?? []).map(mapRow);
  },

  /** Get the current (published) version for a workflow. */
  async getCurrentVersion(workflowId: string): Promise<WorkflowVersion | null> {
    const { data, error } = await supabase
      .from('integration_workflow_versions')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('is_current', true)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to get current version: ${error.message}`);
    return data ? mapRow(data) : null;
  },

  /** Publish a specific version (sets is_current, trigger auto-unsets others). */
  async publishVersion(versionId: string, publishedBy?: string): Promise<WorkflowVersion> {
    const { data, error } = await supabase
      .from('integration_workflow_versions')
      .update({
        is_current: true,
        published_at: new Date().toISOString(),
        published_by: publishedBy ?? null,
      })
      .eq('id', versionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to publish version: ${error.message}`);
    return mapRow(data);
  },

  /** Rollback: publish a previous version by ID. */
  async rollbackToVersion(versionId: string, publishedBy?: string): Promise<WorkflowVersion> {
    return this.publishVersion(versionId, publishedBy);
  },

  /** Get a specific version by ID. */
  async getVersion(versionId: string): Promise<WorkflowVersion | null> {
    const { data, error } = await supabase
      .from('integration_workflow_versions')
      .select('*')
      .eq('id', versionId)
      .maybeSingle();

    if (error) throw new Error(`Failed to get version: ${error.message}`);
    return data ? mapRow(data) : null;
  },

  /** Compare two versions (returns diff summary). */
  async compareVersions(versionIdA: string, versionIdB: string) {
    const [a, b] = await Promise.all([
      this.getVersion(versionIdA),
      this.getVersion(versionIdB),
    ]);
    if (!a || !b) throw new Error('One or both versions not found');

    const nodesAdded = b.nodesSnapshot.filter(
      bn => !a.nodesSnapshot.some(an => an.id === bn.id),
    );
    const nodesRemoved = a.nodesSnapshot.filter(
      an => !b.nodesSnapshot.some(bn => bn.id === an.id),
    );
    const edgesAdded = b.edgesSnapshot.filter(
      be => !a.edgesSnapshot.some(ae => ae.id === be.id),
    );
    const edgesRemoved = a.edgesSnapshot.filter(
      ae => !b.edgesSnapshot.some(be => be.id === ae.id),
    );

    return {
      versionA: a.versionTag,
      versionB: b.versionTag,
      nodesAdded: nodesAdded.length,
      nodesRemoved: nodesRemoved.length,
      edgesAdded: edgesAdded.length,
      edgesRemoved: edgesRemoved.length,
      details: { nodesAdded, nodesRemoved, edgesAdded, edgesRemoved },
    };
  },
};

// ════════════════════════════════════
// ROW MAPPER
// ════════════════════════════════════

function mapRow(row: Record<string, unknown>): WorkflowVersion {
  return {
    id: row.id as string,
    workflowId: row.workflow_id as string,
    tenantId: row.tenant_id as string,
    versionNumber: row.version_number as number,
    versionTag: (row.version_tag as string) ?? null,
    nodesSnapshot: (row.nodes ?? []) as WfCanvasNode[],
    edgesSnapshot: (row.edges ?? []) as WfCanvasEdge[],
    changeSummary: (row.change_summary as string) ?? null,
    publishedAt: (row.published_at as string) ?? null,
    publishedBy: (row.published_by as string) ?? null,
    isCurrent: (row.is_current as boolean) ?? false,
    createdAt: row.created_at as string,
  };
}
