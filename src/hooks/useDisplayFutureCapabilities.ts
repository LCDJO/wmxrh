/**
 * Display TV — Future Capability Stubs
 *
 * Preparation for upcoming features:
 *   1. Multi-tenant Sharding   — Route display data by shard key
 *   2. Predictive Risk AI      — ML-based risk forecasting on TV
 *   3. Historical Heatmap      — Time-travel heatmap replay
 *   4. Event Replay            — Full event stream replay/debugging
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY INVARIANT: These stubs MUST NOT alter permissions,    ║
 * ║  roles, or tenant data. All outputs are read-only / advisory.  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ════════════════════════════════════════════════════════════════
// 1. MULTI-TENANT SHARDING
// ════════════════════════════════════════════════════════════════

export type ShardStrategy = 'hash' | 'range' | 'geo' | 'dedicated';

export interface ShardConfig {
  tenant_id: string;
  shard_id: string;
  strategy: ShardStrategy;
  region: string;
  /** Partition key derived from tenant_id */
  partition_key: number;
  /** Max tenants per shard */
  capacity: number;
  current_load: number;
}

export interface ShardRouter {
  /** Resolve which shard a tenant belongs to. */
  resolve(tenantId: string): ShardConfig;
  /** Rebalance tenants across shards (admin-only, advisory). */
  suggestRebalance(): Array<{ tenant_id: string; from_shard: string; to_shard: string; reason: string }>;
  /** Whether sharding is active. */
  isEnabled(): boolean;
}

/** Stub — single-shard passthrough until sharding is active. */
export class ShardRouterStub implements ShardRouter {
  resolve(tenantId: string): ShardConfig {
    return {
      tenant_id: tenantId,
      shard_id: 'shard-default',
      strategy: 'hash',
      region: 'sa-east-1',
      partition_key: hashCode(tenantId) % 16,
      capacity: 1000,
      current_load: 1,
    };
  }
  suggestRebalance() { return []; }
  isEnabled() { return false; }
}

// ════════════════════════════════════════════════════════════════
// 2. PREDICTIVE RISK AI
// ════════════════════════════════════════════════════════════════

export interface RiskPredictionTV {
  tenant_id: string;
  risk_type: string;
  probability: number;        // 0-1
  severity: 'low' | 'medium' | 'high' | 'critical';
  predicted_window_hours: number;
  contributing_factors: string[];
  recommended_action: string;
  model_version: string;
  predicted_at: string;
}

export interface PredictiveRiskService {
  /** Get top predicted risks for a tenant (TV display). */
  getTopPredictions(tenantId: string, limit?: number): Promise<RiskPredictionTV[]>;
  /** Whether the AI model is ready. */
  isReady(): boolean;
}

/** Stub — will connect to Lovable AI for risk forecasting. */
export class PredictiveRiskServiceStub implements PredictiveRiskService {
  async getTopPredictions(_tenantId: string, _limit?: number): Promise<RiskPredictionTV[]> {
    // TODO: Integrate with Lovable AI (google/gemini-3-flash-preview)
    return [];
  }
  isReady() { return false; }
}

// ════════════════════════════════════════════════════════════════
// 3. HISTORICAL HEATMAP
// ════════════════════════════════════════════════════════════════

export interface HeatmapSnapshot {
  timestamp: string;
  cells: Array<{ lat: number; lng: number; intensity: number; risk_type: string }>;
  total_events: number;
}

export interface HeatmapTimelineService {
  /** Load heatmap snapshots for a time range. */
  loadTimeline(tenantId: string, from: string, to: string, intervalMinutes?: number): Promise<HeatmapSnapshot[]>;
  /** Get a single point-in-time snapshot. */
  getSnapshot(tenantId: string, at: string): Promise<HeatmapSnapshot | null>;
  /** Whether historical data is available. */
  hasHistory(tenantId: string): Promise<boolean>;
}

/** Stub — will aggregate from fleet_behavior_events. */
export class HeatmapTimelineServiceStub implements HeatmapTimelineService {
  async loadTimeline(): Promise<HeatmapSnapshot[]> { return []; }
  async getSnapshot(): Promise<HeatmapSnapshot | null> { return null; }
  async hasHistory(): Promise<boolean> { return false; }
}

// ════════════════════════════════════════════════════════════════
// 4. EVENT REPLAY
// ════════════════════════════════════════════════════════════════

export type ReplaySpeed = 0.5 | 1 | 2 | 4 | 8;
export type ReplayState = 'idle' | 'loading' | 'playing' | 'paused' | 'finished';

export interface ReplayEvent {
  id: string;
  timestamp: string;
  event_type: string;
  payload: Record<string, unknown>;
  source: string;
}

export interface EventReplaySession {
  session_id: string;
  tenant_id: string;
  from: string;
  to: string;
  total_events: number;
  current_index: number;
  state: ReplayState;
  speed: ReplaySpeed;
}

export interface EventReplayService {
  /** Create a replay session for a time range. */
  createSession(tenantId: string, from: string, to: string): Promise<EventReplaySession>;
  /** Get next batch of events. */
  nextBatch(sessionId: string, batchSize?: number): Promise<ReplayEvent[]>;
  /** Control playback. */
  setSpeed(sessionId: string, speed: ReplaySpeed): void;
  pause(sessionId: string): void;
  resume(sessionId: string): void;
  /** Seek to a specific timestamp. */
  seekTo(sessionId: string, timestamp: string): Promise<number>;
}

/** Stub — will read from immutable event tables. */
export class EventReplayServiceStub implements EventReplayService {
  async createSession(tenantId: string, from: string, to: string): Promise<EventReplaySession> {
    return {
      session_id: crypto.randomUUID(),
      tenant_id: tenantId,
      from,
      to,
      total_events: 0,
      current_index: 0,
      state: 'idle',
      speed: 1,
    };
  }
  async nextBatch(): Promise<ReplayEvent[]> { return []; }
  setSpeed() { /* future */ }
  pause() { /* future */ }
  resume() { /* future */ }
  async seekTo(): Promise<number> { return 0; }
}

// ── Utility ──
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
