/**
 * Visual Audit Service — Captures and compares UGE graph state.
 *
 * READ-ONLY: Consumes UGE snapshots and persists audit records.
 * Never modifies permissions, roles, or access rules.
 */

import { supabase } from '@/integrations/supabase/client';
import { unifiedGraphEngine } from '@/domains/security/kernel/unified-graph-engine';
import type { UnifiedNode } from '@/domains/security/kernel/unified-graph-engine';
import type {
  AuditSnapshot,
  AuditRiskSignal,
  AuditAnomaly,
  AuditRoleOverlap,
  AuditExcessivePermission,
  AuditOrphanNode,
  AuditComparisonResult,
} from './governance.types';

// ════════════════════════════════════
// CAPTURE
// ════════════════════════════════════

export async function captureAuditSnapshot(tenantId: string): Promise<AuditSnapshot> {
  const report = unifiedGraphEngine.buildFullReport();
  const { snapshot, analysis, risk } = report;

  const allNodes: UnifiedNode[] = Array.from(snapshot.nodes.values());

  const record: Omit<AuditSnapshot, 'id' | 'created_at'> = {
    tenant_id: tenantId,
    snapshot_type: 'full',
    node_count: snapshot.nodes.size,
    edge_count: snapshot.edges.length,
    role_count: allNodes.filter(n => n.type === 'role').length,
    permission_count: allNodes.filter(n => n.type === 'permission').length,
    user_count: allNodes.filter(n => n.type === 'platform_user' || n.type === 'tenant_user').length,
    risk_level: risk.overallLevel,
    risk_signals: risk.signals.map(s => ({
      id: s.id,
      level: s.level,
      domain: s.domain,
      title: s.title,
      detail: s.detail,
      affected_count: s.affectedNodeUids.length,
    })),
    anomalies: risk.signals
      .filter(s => s.level === 'high' || s.level === 'critical')
      .map(s => ({
        kind: s.id.split('_')[0],
        severity: s.level,
        title: s.title,
        detail: s.detail,
        affected_node_uids: s.affectedNodeUids,
      })),
    role_overlaps: analysis.roleOverlaps.map(o => ({
      role_a: o.roleA.label,
      role_b: o.roleB.label,
      overlap_ratio: o.overlapRatio,
      shared_count: o.sharedPermissions.length,
    })),
    excessive_permissions: analysis.excessivePermissions.map(ep => ({
      user_label: ep.user.label,
      permission_count: ep.permissionCount,
      domain: ep.user.domain,
    })),
    orphan_nodes: analysis.orphanNodes.map(n => ({
      uid: n.uid,
      label: n.label,
      type: n.type,
      domain: n.domain,
    })),
    composition_time_ms: 0,
    created_by: null,
  };

  const { data, error } = await supabase
    .from('governance_audit_snapshots')
    .insert(record as any)
    .select()
    .single();

  if (error) throw new Error(`Failed to save audit snapshot: ${error.message}`);
  return data as unknown as AuditSnapshot;
}

// ════════════════════════════════════
// FETCH
// ════════════════════════════════════

export async function fetchAuditSnapshots(
  tenantId: string,
  limit = 20,
): Promise<AuditSnapshot[]> {
  const { data, error } = await supabase
    .from('governance_audit_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch audit snapshots: ${error.message}`);
  return (data ?? []) as unknown as AuditSnapshot[];
}

// ════════════════════════════════════
// COMPARE
// ════════════════════════════════════

export function compareSnapshots(
  previous: AuditSnapshot,
  current: AuditSnapshot,
): AuditComparisonResult {
  const prevAnomalyKeys = new Set(previous.anomalies.map(a => `${a.kind}:${a.title}`));
  const currAnomalyKeys = new Set(current.anomalies.map(a => `${a.kind}:${a.title}`));

  return {
    previous,
    current,
    deltas: {
      node_count: current.node_count - previous.node_count,
      edge_count: current.edge_count - previous.edge_count,
      role_count: current.role_count - previous.role_count,
      permission_count: current.permission_count - previous.permission_count,
      user_count: current.user_count - previous.user_count,
      risk_level_changed: current.risk_level !== previous.risk_level,
      new_anomalies: current.anomalies.filter(a => !prevAnomalyKeys.has(`${a.kind}:${a.title}`)),
      resolved_anomalies: previous.anomalies.filter(a => !currAnomalyKeys.has(`${a.kind}:${a.title}`)),
      new_overlaps: current.role_overlaps.filter(
        o => !previous.role_overlaps.some(
          po => po.role_a === o.role_a && po.role_b === o.role_b,
        ),
      ),
    },
  };
}
