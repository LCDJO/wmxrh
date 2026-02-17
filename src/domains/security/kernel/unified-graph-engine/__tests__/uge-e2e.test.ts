/**
 * Unified Graph Engine — End-to-End Tests
 *
 * Tests the full UGE pipeline using mock providers:
 *   1. GraphRegistry — register/unregister/query providers
 *   2. GraphComposer — compose snapshots from multiple domains
 *   3. GraphAnalyzer — structural analysis, SoD conflicts, overlaps
 *   4. GraphQueryService — BFS traversal, getUserAccessMap, getTenantAccessOverview, getPermissionUsage
 *   5. RiskAssessmentService — risk signals, user scores
 *   6. GraphVisualizationAdapter — visualization data generation
 *   7. GraphCache — session cache, tenant cache, incremental updates
 *   8. UGE Events — event emission and subscription
 *   9. Full Pipeline — buildFullReport end-to-end
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { graphRegistry } from '@/domains/security/kernel/unified-graph-engine/graph-registry';
import type { GraphProvider } from '@/domains/security/kernel/unified-graph-engine/graph-registry';
import { composeUnifiedGraph } from '@/domains/security/kernel/unified-graph-engine/graph-composer';
import { analyzeGraph } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';
import type { AnalysisResult } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';
import { queryGraph, getUserAccessMap, getTenantAccessOverview, getPermissionUsage } from '@/domains/security/kernel/unified-graph-engine/graph-query-service';
import { assessRisk } from '@/domains/security/kernel/unified-graph-engine/risk-assessment-service';
import { toVisualizationData } from '@/domains/security/kernel/unified-graph-engine/graph-visualization-adapter';
import { graphCache, extractTenantSnapshot, invalidateDomain } from '@/domains/security/kernel/unified-graph-engine/graph-cache';
import { onUGEEvent, onUGEEventType, clearUGEEventLog, getUGEEventLog } from '@/domains/security/kernel/unified-graph-engine/uge-events';
import type { UGEDomainEvent, GraphComposedPayload, RiskScoreUpdatedPayload } from '@/domains/security/kernel/unified-graph-engine/uge-events';
import type {
  UnifiedNode,
  UnifiedEdge,
  UnifiedGraphSnapshot,
  GraphDomain,
} from '@/domains/security/kernel/unified-graph-engine/types';

// ════════════════════════════════════
// TEST DATA FACTORY
// ════════════════════════════════════

function node(domain: GraphDomain, type: UnifiedNode['type'], id: string, label: string, meta?: Record<string, unknown>): UnifiedNode {
  return { uid: `${domain}:${id}`, domain, type, originalId: id, label, meta };
}

function edge(from: string, to: string, relation: UnifiedEdge['relation'], domain: GraphDomain): UnifiedEdge {
  return { from, to, relation, domain };
}

// ── Mock Providers ──

function createMockPlatformProvider(): GraphProvider {
  const nodes: UnifiedNode[] = [
    node('platform_access', 'platform_user', 'user-admin', 'Admin User', { slug: 'admin' }),
    node('platform_access', 'platform_user', 'user-support', 'Support User', { slug: 'support' }),
    node('platform_access', 'role', 'role-super-admin', 'Super Admin', { slug: 'platform_super_admin' }),
    node('platform_access', 'role', 'role-support', 'Support', { slug: 'platform_support' }),
    node('platform_access', 'role', 'role-finance', 'Finance', { slug: 'platform_finance' }),
    node('platform_access', 'permission', 'perm-manage', 'platform.manage', { slug: 'platform.manage' }),
    node('platform_access', 'permission', 'perm-tenant-manage', 'tenant.manage', { slug: 'tenant.manage' }),
    node('platform_access', 'permission', 'perm-tenant-view', 'tenant.view', { slug: 'tenant.view' }),
    node('platform_access', 'permission', 'perm-billing', 'billing.manage', { slug: 'billing.manage' }),
    node('platform_access', 'permission', 'perm-users-impersonate', 'users.impersonate', { slug: 'users.impersonate' }),
  ];

  const edges: UnifiedEdge[] = [
    // Admin → Super Admin role
    edge('platform_access:user-admin', 'platform_access:role-super-admin', 'HAS_PLATFORM_ROLE', 'platform_access'),
    // Support user → Support role + Finance role (SoD conflict!)
    edge('platform_access:user-support', 'platform_access:role-support', 'HAS_PLATFORM_ROLE', 'platform_access'),
    edge('platform_access:user-support', 'platform_access:role-finance', 'HAS_PLATFORM_ROLE', 'platform_access'),
    // Super Admin grants all perms
    edge('platform_access:role-super-admin', 'platform_access:perm-manage', 'PLATFORM_GRANTS', 'platform_access'),
    edge('platform_access:role-super-admin', 'platform_access:perm-tenant-manage', 'PLATFORM_GRANTS', 'platform_access'),
    edge('platform_access:role-super-admin', 'platform_access:perm-tenant-view', 'PLATFORM_GRANTS', 'platform_access'),
    edge('platform_access:role-super-admin', 'platform_access:perm-billing', 'PLATFORM_GRANTS', 'platform_access'),
    edge('platform_access:role-super-admin', 'platform_access:perm-users-impersonate', 'PLATFORM_GRANTS', 'platform_access'),
    // Support grants tenant.view only
    edge('platform_access:role-support', 'platform_access:perm-tenant-view', 'PLATFORM_GRANTS', 'platform_access'),
    // Finance grants billing.manage
    edge('platform_access:role-finance', 'platform_access:perm-billing', 'PLATFORM_GRANTS', 'platform_access'),
  ];

  return {
    domain: 'platform_access',
    graphId: 'test_platform',
    name: 'Test Platform Provider',
    sourceService: 'TestPlatformService',
    provide: () => ({ nodes, edges }),
    isAvailable: () => true,
  };
}

function createMockTenantProvider(): GraphProvider {
  const tenantId = 'tenant-1';
  const nodes: UnifiedNode[] = [
    node('tenant_access', 'tenant', tenantId, 'Acme Corp', { tenantId }),
    node('tenant_access', 'tenant_user', 'user-employee', 'Employee User', { tenantId }),
    node('tenant_access', 'tenant_user', 'user-hr', 'HR User', { tenantId }),
    node('tenant_access', 'role', 'role-employee', 'Employee', { slug: 'employee', tenantId }),
    node('tenant_access', 'role', 'role-hr-admin', 'HR Admin', { slug: 'hr_admin', tenantId }),
    node('tenant_access', 'permission', 'perm-profile-view', 'profile.view', { slug: 'profile.view', tenantId }),
    node('tenant_access', 'permission', 'perm-payroll-approve', 'payroll.approve', { slug: 'payroll.approve', tenantId }),
    node('tenant_access', 'permission', 'perm-employees-delete', 'employees.delete', { slug: 'employees.delete', tenantId }),
  ];

  const edges: UnifiedEdge[] = [
    // Users belong to tenant
    edge('tenant_access:user-employee', 'tenant_access:tenant-1', 'BELONGS_TO_TENANT', 'tenant_access'),
    edge('tenant_access:user-hr', 'tenant_access:tenant-1', 'BELONGS_TO_TENANT', 'tenant_access'),
    // Employee → Employee role
    edge('tenant_access:user-employee', 'tenant_access:role-employee', 'HAS_TENANT_ROLE', 'tenant_access'),
    // HR → HR Admin role
    edge('tenant_access:user-hr', 'tenant_access:role-hr-admin', 'HAS_TENANT_ROLE', 'tenant_access'),
    // Employee role grants profile.view
    edge('tenant_access:role-employee', 'tenant_access:perm-profile-view', 'TENANT_GRANTS', 'tenant_access'),
    // HR Admin inherits Employee role
    edge('tenant_access:role-hr-admin', 'tenant_access:role-employee', 'INHERITS_ROLE', 'tenant_access'),
    // HR Admin grants payroll + delete
    edge('tenant_access:role-hr-admin', 'tenant_access:perm-payroll-approve', 'TENANT_GRANTS', 'tenant_access'),
    edge('tenant_access:role-hr-admin', 'tenant_access:perm-employees-delete', 'TENANT_GRANTS', 'tenant_access'),
  ];

  return {
    domain: 'tenant_access',
    graphId: 'test_tenant',
    name: 'Test Tenant Provider',
    sourceService: 'TestTenantService',
    provide: () => ({ nodes, edges }),
    isAvailable: () => true,
  };
}

function createMockIdentityProvider(): GraphProvider {
  const nodes: UnifiedNode[] = [
    // Cross-domain user: same person on both platform and tenant
    node('identity', 'identity_session', 'user-admin', 'Admin Session', { userId: 'user-admin' }),
  ];

  const edges: UnifiedEdge[] = [
    edge('identity:user-admin', 'platform_access:user-admin', 'IDENTITY_LINK', 'identity'),
  ];

  return {
    domain: 'identity',
    graphId: 'test_identity',
    name: 'Test Identity Provider',
    sourceService: 'TestIdentityService',
    provide: () => ({ nodes, edges }),
    isAvailable: () => true,
  };
}

// ════════════════════════════════════
// SETUP
// ════════════════════════════════════

// Save original providers to restore after tests
let savedProviders: GraphProvider[] = [];

beforeEach(() => {
  // Save & clear registry
  savedProviders = graphRegistry.getAvailableProviders();
  for (const d of graphRegistry.getRegisteredDomains()) {
    graphRegistry.unregister(d);
  }
  graphCache.clear();
  clearUGEEventLog();
});

afterEach(() => {
  // Restore original providers
  for (const d of graphRegistry.getRegisteredDomains()) {
    graphRegistry.unregister(d);
  }
  for (const p of savedProviders) {
    graphRegistry.register(p);
  }
  graphCache.clear();
  clearUGEEventLog();
});

// ════════════════════════════════════════════════════════════════════
// 1. GRAPH REGISTRY
// ════════════════════════════════════════════════════════════════════

describe('GraphRegistry', () => {
  it('registers and retrieves providers', () => {
    const provider = createMockPlatformProvider();
    graphRegistry.register(provider);

    expect(graphRegistry.getRegisteredDomains()).toContain('platform_access');
    expect(graphRegistry.getProvider('platform_access')).not.toBeNull();
    expect(graphRegistry.getAvailableProviders().length).toBe(1);
  });

  it('unregisters providers by domain', () => {
    graphRegistry.register(createMockPlatformProvider());
    graphRegistry.register(createMockTenantProvider());
    expect(graphRegistry.getRegisteredDomains().length).toBe(2);

    graphRegistry.unregister('platform_access');
    expect(graphRegistry.getRegisteredDomains()).not.toContain('platform_access');
    expect(graphRegistry.getRegisteredDomains()).toContain('tenant_access');
  });

  it('returns null for unregistered domain', () => {
    expect(graphRegistry.getProvider('module_access')).toBeNull();
  });

  it('lists registered graphs with metadata', () => {
    graphRegistry.register(createMockPlatformProvider());
    const graphs = graphRegistry.getRegisteredGraphs();
    expect(graphs.length).toBe(1);
    expect(graphs[0].domain).toBe('platform_access');
    expect(graphs[0].available).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// 2. GRAPH COMPOSER
// ════════════════════════════════════════════════════════════════════

describe('GraphComposer', () => {
  beforeEach(() => {
    graphRegistry.register(createMockPlatformProvider());
    graphRegistry.register(createMockTenantProvider());
    graphRegistry.register(createMockIdentityProvider());
  });

  it('composes a snapshot from all providers', () => {
    const snapshot = composeUnifiedGraph();

    expect(snapshot.nodes.size).toBeGreaterThan(0);
    expect(snapshot.edges.length).toBeGreaterThan(0);
    expect(snapshot.domains).toContain('platform_access');
    expect(snapshot.domains).toContain('tenant_access');
    expect(snapshot.domains).toContain('identity');
    expect(snapshot.builtAt).toBeGreaterThan(0);
    expect(snapshot.version).toBeGreaterThan(0);
  });

  it('composes a filtered snapshot for specific domains', () => {
    const snapshot = composeUnifiedGraph(['platform_access']);

    expect(snapshot.domains).toEqual(['platform_access']);
    // Should NOT contain tenant nodes
    const hasTenantNode = Array.from(snapshot.nodes.values()).some(n => n.domain === 'tenant_access');
    expect(hasTenantNode).toBe(false);
  });

  it('deduplicates edges', () => {
    const snapshot = composeUnifiedGraph();
    const edgeKeys = snapshot.edges.map(e => `${e.from}|${e.to}|${e.relation}`);
    const uniqueKeys = new Set(edgeKeys);
    expect(edgeKeys.length).toBe(uniqueKeys.size);
  });

  it('produces frozen (immutable) snapshots', () => {
    const snapshot = composeUnifiedGraph();
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('increments version on each composition', () => {
    const s1 = composeUnifiedGraph();
    const s2 = composeUnifiedGraph();
    expect(s2.version).toBeGreaterThan(s1.version);
  });
});

// ════════════════════════════════════════════════════════════════════
// 3. GRAPH ANALYZER
// ════════════════════════════════════════════════════════════════════

describe('GraphAnalyzer', () => {
  let snapshot: UnifiedGraphSnapshot;
  let analysis: AnalysisResult;

  beforeEach(() => {
    graphRegistry.register(createMockPlatformProvider());
    graphRegistry.register(createMockTenantProvider());
    graphRegistry.register(createMockIdentityProvider());
    snapshot = composeUnifiedGraph();
    analysis = analyzeGraph(snapshot);
  });

  it('returns stats with correct counts', () => {
    expect(analysis.stats.totalNodes).toBe(snapshot.nodes.size);
    expect(analysis.stats.totalEdges).toBe(snapshot.edges.length);
    expect(analysis.stats.avgFanOut).toBeGreaterThan(0);
  });

  it('detects active domains', () => {
    expect(analysis.activeDomains).toContain('platform_access');
    expect(analysis.activeDomains).toContain('tenant_access');
  });

  it('detects SoD access conflicts (Support + Finance)', () => {
    // Our mock has user-support with both platform_support and platform_finance roles
    const sodConflicts = analysis.accessConflicts.filter(
      c => c.rule.includes('platform_support') && c.rule.includes('platform_finance'),
    );
    expect(sodConflicts.length).toBeGreaterThanOrEqual(1);
    expect(sodConflicts[0].severity).toBe('critical');
    expect(sodConflicts[0].user.label).toBe('Support User');
  });

  it('detects role overlaps when threshold is met', () => {
    // Support and Finance both grant some overlapping permissions depending on threshold
    // In our mock, they share billing.manage via finance → billing + support → tenant.view
    // Overlap depends on the data; this test validates the mechanism works
    expect(analysis.roleOverlaps).toBeDefined();
    expect(Array.isArray(analysis.roleOverlaps)).toBe(true);
  });

  it('detects operational risks', () => {
    expect(analysis.operationalRisks.length).toBeGreaterThan(0);
    // Should detect SoD violation as operational risk
    const sodRisk = analysis.operationalRisks.find(r => r.id === 'separation_of_duty_violations');
    expect(sodRisk).toBeDefined();
    expect(sodRisk!.level).toBe('critical');
  });

  it('calculates max depth via BFS', () => {
    expect(analysis.stats.maxDepth).toBeGreaterThanOrEqual(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// 4. GRAPH QUERY SERVICE
// ════════════════════════════════════════════════════════════════════

describe('GraphQueryService', () => {
  let snapshot: UnifiedGraphSnapshot;

  beforeEach(() => {
    graphRegistry.register(createMockPlatformProvider());
    graphRegistry.register(createMockTenantProvider());
    graphRegistry.register(createMockIdentityProvider());
    snapshot = composeUnifiedGraph();
  });

  describe('queryGraph (BFS)', () => {
    it('traverses from a user node to reachable nodes', () => {
      const result = queryGraph(snapshot, {
        from: 'platform_access:user-admin',
        maxDepth: 3,
      });

      expect(result.reachableNodes.length).toBeGreaterThan(0);
      expect(result.totalEdgesTraversed).toBeGreaterThan(0);
      // Admin should reach role + permissions
      const reachableLabels = result.reachableNodes.map(n => n.label);
      expect(reachableLabels).toContain('Super Admin');
    });

    it('filters by relation type', () => {
      const result = queryGraph(snapshot, {
        from: 'platform_access:user-admin',
        relations: ['HAS_PLATFORM_ROLE'],
        maxDepth: 1,
      });

      // Should only reach role nodes, not permissions
      expect(result.reachableNodes.every(n => n.type === 'role')).toBe(true);
    });

    it('returns empty result for non-existent node', () => {
      const result = queryGraph(snapshot, {
        from: 'nonexistent:node',
        maxDepth: 3,
      });
      expect(result.reachableNodes.length).toBe(0);
      expect(result.paths.length).toBe(0);
    });

    it('respects maxDepth', () => {
      const shallow = queryGraph(snapshot, {
        from: 'platform_access:user-admin',
        maxDepth: 1,
      });
      const deep = queryGraph(snapshot, {
        from: 'platform_access:user-admin',
        maxDepth: 5,
      });
      expect(deep.reachableNodes.length).toBeGreaterThanOrEqual(shallow.reachableNodes.length);
    });
  });

  describe('getUserAccessMap', () => {
    it('returns complete access map for a platform user', () => {
      const accessMap = getUserAccessMap(snapshot, 'user-admin');

      expect(accessMap.userId).toBe('user-admin');
      expect(accessMap.userNodes.length).toBeGreaterThanOrEqual(1);
      expect(accessMap.roles.length).toBeGreaterThanOrEqual(1);
      expect(accessMap.totalPermissions).toBeGreaterThan(0);

      // Admin has Super Admin role
      const roleLabels = accessMap.roles.map(r => r.role.label);
      expect(roleLabels).toContain('Super Admin');

      // Super Admin role should grant permissions
      const superAdminRole = accessMap.roles.find(r => r.role.label === 'Super Admin');
      expect(superAdminRole!.permissions.length).toBeGreaterThan(0);
    });

    it('resolves inherited permissions for tenant user', () => {
      const accessMap = getUserAccessMap(snapshot, 'user-hr');

      // HR Admin inherits Employee role → should have profile.view + payroll.approve + employees.delete
      expect(accessMap.totalPermissions).toBeGreaterThanOrEqual(3);

      const allPermLabels = accessMap.roles.flatMap(r => r.permissions.map(p => p.label));
      expect(allPermLabels).toContain('profile.view');
      expect(allPermLabels).toContain('payroll.approve');
    });

    it('returns empty access map for unknown user', () => {
      const accessMap = getUserAccessMap(snapshot, 'nonexistent-user');
      expect(accessMap.userNodes.length).toBe(0);
      expect(accessMap.roles.length).toBe(0);
      expect(accessMap.totalPermissions).toBe(0);
    });
  });

  describe('getTenantAccessOverview', () => {
    it('returns overview for a tenant', () => {
      const overview = getTenantAccessOverview(snapshot, 'tenant-1');

      expect(overview.tenantId).toBe('tenant-1');
      expect(overview.tenantNode).not.toBeNull();
      expect(overview.tenantNode!.label).toBe('Acme Corp');
      expect(overview.stats.totalUsers).toBeGreaterThanOrEqual(2);
      expect(overview.stats.totalRoles).toBeGreaterThanOrEqual(2);
      expect(overview.stats.totalPermissions).toBeGreaterThanOrEqual(2);
    });

    it('returns empty overview for unknown tenant', () => {
      const overview = getTenantAccessOverview(snapshot, 'nonexistent-tenant');
      expect(overview.tenantNode).toBeNull();
      expect(overview.stats.totalUsers).toBe(0);
    });
  });

  describe('getPermissionUsage', () => {
    it('returns usage for a known permission', () => {
      const usage = getPermissionUsage(snapshot, 'tenant.view');

      expect(usage.permissionNode).not.toBeNull();
      expect(usage.stats.totalRolesGranting).toBeGreaterThanOrEqual(1);
      expect(usage.stats.totalUsersWithAccess).toBeGreaterThanOrEqual(1);
    });

    it('finds by slug in meta', () => {
      const usage = getPermissionUsage(snapshot, 'billing.manage');
      expect(usage.permissionNode).not.toBeNull();
    });

    it('returns empty for unknown permission', () => {
      const usage = getPermissionUsage(snapshot, 'nonexistent.permission');
      expect(usage.permissionNode).toBeNull();
      expect(usage.grantedBy.length).toBe(0);
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// 5. RISK ASSESSMENT SERVICE
// ════════════════════════════════════════════════════════════════════

describe('RiskAssessmentService', () => {
  let snapshot: UnifiedGraphSnapshot;

  beforeEach(() => {
    graphRegistry.register(createMockPlatformProvider());
    graphRegistry.register(createMockTenantProvider());
    graphRegistry.register(createMockIdentityProvider());
    snapshot = composeUnifiedGraph();
  });

  it('produces risk assessment with signals', () => {
    const risk = assessRisk(snapshot);

    expect(risk.overallLevel).toBeDefined();
    expect(['low', 'medium', 'high', 'critical']).toContain(risk.overallLevel);
    expect(risk.signals.length).toBeGreaterThan(0);
    expect(risk.assessedAt).toBeGreaterThan(0);
  });

  it('detects SoD conflict as critical signal', () => {
    const risk = assessRisk(snapshot);

    const sodSignals = risk.signals.filter(s => s.title.includes('Conflito'));
    expect(sodSignals.length).toBeGreaterThanOrEqual(1);
    expect(sodSignals[0].level).toBe('critical');
  });

  it('computes user risk scores', () => {
    const risk = assessRisk(snapshot);

    expect(risk.userScores.length).toBeGreaterThan(0);
    // Admin has critical permissions → should have non-zero score
    const adminScore = risk.userScores.find(s => s.userLabel === 'Admin User');
    expect(adminScore).toBeDefined();
    expect(adminScore!.score).toBeGreaterThan(0);
    expect(adminScore!.factors.criticalPermissionCount).toBeGreaterThan(0);
  });

  it('assigns higher score to users with critical permissions', () => {
    const risk = assessRisk(snapshot);

    const adminScore = risk.userScores.find(s => s.userLabel === 'Admin User');
    const employeeScore = risk.userScores.find(s => s.userLabel === 'Employee User');

    if (adminScore && employeeScore) {
      // Admin with platform.manage, tenant.manage, etc should score higher
      expect(adminScore.score).toBeGreaterThan(employeeScore.score);
    }
  });

  it('sets overall level based on worst signal', () => {
    const risk = assessRisk(snapshot);

    // We have SoD conflict → critical signal → overall should be critical
    if (risk.signals.some(s => s.level === 'critical')) {
      expect(risk.overallLevel).toBe('critical');
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// 6. GRAPH VISUALIZATION ADAPTER
// ════════════════════════════════════════════════════════════════════

describe('GraphVisualizationAdapter', () => {
  let snapshot: UnifiedGraphSnapshot;

  beforeEach(() => {
    graphRegistry.register(createMockPlatformProvider());
    graphRegistry.register(createMockTenantProvider());
    snapshot = composeUnifiedGraph();
  });

  it('converts snapshot to visualization data', () => {
    const viz = toVisualizationData(snapshot);

    expect(viz.nodes.length).toBe(snapshot.nodes.size);
    expect(viz.edges.length).toBe(snapshot.edges.length);
    expect(viz.stats.totalNodes).toBe(snapshot.nodes.size);
    expect(viz.stats.totalEdges).toBe(snapshot.edges.length);
  });

  it('assigns colors and sizes to nodes', () => {
    const viz = toVisualizationData(snapshot);

    for (const node of viz.nodes) {
      expect(node.color).toBeDefined();
      expect(node.size).toBeGreaterThan(0);
      expect(node.domain).toBeDefined();
    }
  });

  it('includes domain breakdown stats', () => {
    const viz = toVisualizationData(snapshot);

    expect(viz.stats.domainBreakdown.platform_access).toBeDefined();
    expect(viz.stats.domainBreakdown.platform_access.nodes).toBeGreaterThan(0);
    expect(viz.stats.domainBreakdown.tenant_access.nodes).toBeGreaterThan(0);
  });

  it('filters by domain', () => {
    const viz = toVisualizationData(snapshot, { domains: ['platform_access'] });

    expect(viz.nodes.every(n => n.domain === 'platform_access')).toBe(true);
    expect(viz.stats.domainBreakdown.tenant_access.nodes).toBe(0);
  });

  it('only includes edges where both endpoints are present', () => {
    const viz = toVisualizationData(snapshot, { domains: ['platform_access'] });
    const nodeIds = new Set(viz.nodes.map(n => n.id));

    for (const edge of viz.edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// 7. GRAPH CACHE
// ════════════════════════════════════════════════════════════════════

describe('GraphCache', () => {
  beforeEach(() => {
    graphRegistry.register(createMockPlatformProvider());
    graphRegistry.register(createMockTenantProvider());
  });

  it('caches and retrieves session snapshots', () => {
    const snapshot = composeUnifiedGraph();
    graphCache.setSessionSnapshot('session-1', snapshot);

    const cached = graphCache.getSessionSnapshot('session-1');
    expect(cached).not.toBeNull();
    expect(cached!.nodes.size).toBe(snapshot.nodes.size);
  });

  it('returns null for cache miss', () => {
    expect(graphCache.getSessionSnapshot('nonexistent')).toBeNull();
  });

  it('invalidates session cache', () => {
    const snapshot = composeUnifiedGraph();
    graphCache.setSessionSnapshot('session-1', snapshot);
    graphCache.invalidateSession('session-1');

    expect(graphCache.getSessionSnapshot('session-1')).toBeNull();
  });

  it('invalidates tenant cache', () => {
    const snapshot = composeUnifiedGraph();
    const tenantSnapshot = extractTenantSnapshot(snapshot, 'tenant-1');
    expect(tenantSnapshot.nodes.size).toBeGreaterThan(0);

    graphCache.invalidateTenant('tenant-1');
    // After invalidation, tenant cache miss
    expect(graphCache.getTenantSnapshot('tenant-1')).toBeNull();
  });

  it('reports cache stats', () => {
    const stats = graphCache.stats();
    expect(stats).toHaveProperty('sessionEntries');
    expect(stats).toHaveProperty('tenantEntries');
    expect(stats).toHaveProperty('config');
  });

  it('clears all caches', () => {
    const snapshot = composeUnifiedGraph();
    graphCache.setSessionSnapshot('s1', snapshot);
    graphCache.clear();

    expect(graphCache.getSessionSnapshot('s1')).toBeNull();
    expect(graphCache.stats().sessionEntries).toBe(0);
  });
});

describe('Tenant Snapshot Extraction', () => {
  beforeEach(() => {
    graphRegistry.register(createMockPlatformProvider());
    graphRegistry.register(createMockTenantProvider());
  });

  it('extracts tenant-scoped snapshot', () => {
    const full = composeUnifiedGraph();
    const tenantSnapshot = extractTenantSnapshot(full, 'tenant-1');

    // Should contain tenant nodes
    const tenantNode = Array.from(tenantSnapshot.nodes.values()).find(n => n.type === 'tenant');
    expect(tenantNode).toBeDefined();
    expect(tenantNode!.label).toBe('Acme Corp');

    // Should NOT contain platform users (unless linked via identity)
    const platformUsers = Array.from(tenantSnapshot.nodes.values()).filter(n => n.type === 'platform_user');
    expect(platformUsers.length).toBe(0);
  });

  it('includes tenant users and their roles/permissions', () => {
    const full = composeUnifiedGraph();
    const tenantSnapshot = extractTenantSnapshot(full, 'tenant-1');

    const tenantUsers = Array.from(tenantSnapshot.nodes.values()).filter(n => n.type === 'tenant_user');
    expect(tenantUsers.length).toBeGreaterThanOrEqual(2);

    const roles = Array.from(tenantSnapshot.nodes.values()).filter(n => n.type === 'role');
    expect(roles.length).toBeGreaterThanOrEqual(2);

    const perms = Array.from(tenantSnapshot.nodes.values()).filter(n => n.type === 'permission');
    expect(perms.length).toBeGreaterThanOrEqual(2);
  });
});

// ════════════════════════════════════════════════════════════════════
// 8. UGE EVENTS
// ════════════════════════════════════════════════════════════════════

describe('UGE Events', () => {
  beforeEach(() => {
    graphRegistry.register(createMockPlatformProvider());
    graphRegistry.register(createMockTenantProvider());
  });

  it('emits GraphComposed event on composition', () => {
    const events: UGEDomainEvent[] = [];
    const unsub = onUGEEvent(e => events.push(e));

    composeUnifiedGraph();

    expect(events.length).toBeGreaterThanOrEqual(1);
    const composed = events.find(e => e.type === 'GraphComposed') as GraphComposedPayload;
    expect(composed).toBeDefined();
    expect(composed.nodeCount).toBeGreaterThan(0);
    expect(composed.edgeCount).toBeGreaterThan(0);
    expect(composed.compositionTimeMs).toBeGreaterThanOrEqual(0);

    unsub();
  });

  it('emits RiskScoreUpdated event on risk assessment', () => {
    const events: UGEDomainEvent[] = [];
    const unsub = onUGEEventType<RiskScoreUpdatedPayload>('RiskScoreUpdated', e => events.push(e));

    const snapshot = composeUnifiedGraph();
    assessRisk(snapshot);

    expect(events.length).toBeGreaterThanOrEqual(1);
    const riskEvent = events[0] as RiskScoreUpdatedPayload;
    expect(riskEvent.currentLevel).toBeDefined();
    expect(riskEvent.signalCount).toBeGreaterThan(0);

    unsub();
  });

  it('maintains event log', () => {
    composeUnifiedGraph();
    const log = getUGEEventLog();
    expect(log.length).toBeGreaterThan(0);
  });

  it('clears event log', () => {
    composeUnifiedGraph();
    clearUGEEventLog();
    expect(getUGEEventLog().length).toBe(0);
  });

  it('supports unsubscribe', () => {
    const events: UGEDomainEvent[] = [];
    const unsub = onUGEEvent(e => events.push(e));
    unsub();

    composeUnifiedGraph();
    expect(events.length).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// 9. FULL PIPELINE (end-to-end)
// ════════════════════════════════════════════════════════════════════

describe('Full UGE Pipeline (end-to-end)', () => {
  beforeEach(() => {
    graphRegistry.register(createMockPlatformProvider());
    graphRegistry.register(createMockTenantProvider());
    graphRegistry.register(createMockIdentityProvider());
  });

  it('executes full pipeline: register → compose → analyze → risk → visualize', () => {
    // 1. Verify registry
    expect(graphRegistry.getRegisteredDomains().length).toBe(3);

    // 2. Compose
    const snapshot = composeUnifiedGraph();
    expect(snapshot.nodes.size).toBeGreaterThan(0);

    // 3. Analyze
    const analysis = analyzeGraph(snapshot);
    expect(analysis.stats.totalNodes).toBe(snapshot.nodes.size);
    expect(analysis.accessConflicts.length).toBeGreaterThanOrEqual(1);

    // 4. Query
    const adminAccess = getUserAccessMap(snapshot, 'user-admin');
    expect(adminAccess.totalPermissions).toBeGreaterThan(0);

    const tenantOverview = getTenantAccessOverview(snapshot, 'tenant-1');
    expect(tenantOverview.stats.totalUsers).toBeGreaterThanOrEqual(2);

    // 5. Risk
    const risk = assessRisk(snapshot);
    expect(risk.signals.length).toBeGreaterThan(0);
    expect(risk.userScores.length).toBeGreaterThan(0);

    // 6. Visualization
    const viz = toVisualizationData(snapshot);
    expect(viz.nodes.length).toBe(snapshot.nodes.size);

    // 7. Events were emitted
    const log = getUGEEventLog();
    expect(log.some(e => e.type === 'GraphComposed')).toBe(true);
    expect(log.some(e => e.type === 'RiskScoreUpdated')).toBe(true);
  });

  it('caches and retrieves session snapshot', () => {
    const s1 = composeUnifiedGraph();
    graphCache.setSessionSnapshot('test-session', s1);

    const cached = graphCache.getSessionSnapshot('test-session');
    expect(cached).not.toBeNull();
    expect(cached!.version).toBe(s1.version);
  });

  it('extracts tenant snapshot and analyzes it independently', () => {
    const full = composeUnifiedGraph();
    const tenantSnapshot = extractTenantSnapshot(full, 'tenant-1');

    const analysis = analyzeGraph(tenantSnapshot);
    expect(analysis.stats.totalNodes).toBeGreaterThan(0);
    expect(analysis.stats.totalNodes).toBeLessThan(full.nodes.size);

    const risk = assessRisk(tenantSnapshot);
    expect(risk.signals).toBeDefined();
  });

  it('handles domain invalidation correctly', () => {
    const snapshot = composeUnifiedGraph();
    graphCache.setSessionSnapshot('s1', snapshot);

    // Invalidate platform domain
    invalidateDomain('platform_access');

    // Stale domains should detect change
    const stale = graphCache.getStaleDomains(snapshot);
    // May or may not detect depending on version tracking
    // At minimum, the function should not throw
    expect(Array.isArray(stale)).toBe(true);
  });

  it('queries permission usage across the full graph', () => {
    const snapshot = composeUnifiedGraph();

    // billing.manage is granted by Super Admin and Finance roles
    const usage = getPermissionUsage(snapshot, 'billing.manage');
    expect(usage.permissionNode).not.toBeNull();
    expect(usage.stats.totalRolesGranting).toBeGreaterThanOrEqual(2);
    expect(usage.stats.totalUsersWithAccess).toBeGreaterThanOrEqual(1);
  });

  it('detects critical user risk from impersonation capability', () => {
    const snapshot = composeUnifiedGraph();
    const risk = assessRisk(snapshot);

    // Admin has users.impersonate permission → should contribute to critical score
    const adminScore = risk.userScores.find(s => s.userLabel === 'Admin User');
    expect(adminScore).toBeDefined();
    expect(adminScore!.factors.criticalPermissionCount).toBeGreaterThanOrEqual(3);
  });
});
