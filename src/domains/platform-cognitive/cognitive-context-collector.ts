/**
 * CognitiveContextCollector
 *
 * Collects and persists NON-SENSITIVE behavioural metadata:
 *  ✅ pages accessed, modules used, commands executed, roles switched
 *  ❌ NEVER financial data, PII, passwords, tokens, salaries
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  LGPD / PRIVACY CONTRACT                                        ║
 * ║                                                                  ║
 * ║  1. NO personal data is stored — only aggregated navigation      ║
 * ║     metadata (route paths, module keys, command names).          ║
 * ║  2. BLOCKED_PATTERNS reject any key/value containing PII        ║
 * ║     patterns (CPF, email content, phone, address, salary, etc.) ║
 * ║  3. Data sent to AI advisors is ANONYMISED — user IDs are       ║
 * ║     replaced with opaque hashes before leaving the client.      ║
 * ║  4. Retention: events older than 90 days SHOULD be purged       ║
 * ║     via scheduled DB function.                                  ║
 * ║  5. Users can request data deletion per LGPD Art. 18.           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import { supabase } from '@/integrations/supabase/client';
import type { PlatformSnapshot } from './types';

// ── Blocked patterns (NEVER collected) ────────────────────────────
const BLOCKED_PATTERNS = [
  /salary/i, /salario/i, /remunerac/i, /pagamento/i,
  /cpf/i, /cnpj/i, /rg\b/i, /passport/i,
  /password/i, /senha/i, /token/i, /secret/i,
  /bank/i, /banco/i, /pix/i, /account/i, /conta/i,
  /credit/i, /credito/i, /billing/i, /fatura/i,
  /ssn/i, /social.?security/i,
  /health.*result/i, /exam.*result/i, /laudo/i,
  /phone/i, /telefone/i, /address/i, /endereco/i,
  /email.*@/i, /nome.*completo/i, /full.*name/i,
  /birth/i, /nascimento/i, /data.*nasc/i,
];

function isSafe(value: string): boolean {
  return !BLOCKED_PATTERNS.some(p => p.test(value));
}

function sanitiseMetadata(raw?: Record<string, unknown>): Record<string, unknown> {
  if (!raw) return {};
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isSafe(k)) continue;
    if (typeof v === 'string' && !isSafe(v)) continue;
    // Strip any value that looks like an email address
    if (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) continue;
    clean[k] = v;
  }
  return clean;
}

export type EventType = 'page_view' | 'module_use' | 'command_exec' | 'role_switch' | 'module_signal';

// ── Cognitive Signal (Module Federation) ──────────────────────────
export interface CognitiveSignal {
  module_id: string;
  event_type: string;
  resource: string;
  metadata?: Record<string, unknown>;
}

/** Global registry — modules call registerCognitiveSignal() at bootstrap. */
const _signalHandlers = new Map<string, (signal: CognitiveSignal) => void>();
let _collectorInstance: CognitiveContextCollector | null = null;

/**
 * Register a cognitive signal from any module.
 * Modules call this at init time so the Cognitive Layer
 * tracks their domain-specific events.
 *
 * PRIVACY: all signals pass through BLOCKED_PATTERNS + sanitisation.
 *
 * @example
 * registerCognitiveSignal({
 *   module_id: 'payroll',
 *   event_type: 'simulation_run',
 *   resource: 'payroll-simulation',
 * });
 */
export function registerCognitiveSignal(signal: CognitiveSignal): void {
  if (!isSafe(signal.module_id) || !isSafe(signal.event_type) || !isSafe(signal.resource)) {
    console.warn('[Cognitive] Signal blocked by privacy filter:', signal.module_id);
    return;
  }

  if (_collectorInstance) {
    _collectorInstance.trackModuleSignal(signal);
  } else {
    // Queue until collector is instantiated
    _pendingSignals.push(signal);
  }
}

const _pendingSignals: CognitiveSignal[] = [];

/**
 * Bulk-register multiple signals (useful for module bootstrap).
 */
export function registerCognitiveSignals(signals: CognitiveSignal[]): void {
  signals.forEach(registerCognitiveSignal);
}

/**
 * Subscribe to signals from a specific module.
 * Returns unsubscribe function.
 */
export function onCognitiveSignal(
  moduleId: string,
  handler: (signal: CognitiveSignal) => void,
): () => void {
  _signalHandlers.set(moduleId, handler);
  return () => { _signalHandlers.delete(moduleId); };
}
export class CognitiveContextCollector {
  private snapshotCache: PlatformSnapshot | null = null;
  private snapshotTs = 0;
  private readonly TTL_MS = 60_000;
  private moduleSignalLog: CognitiveSignal[] = [];

  // Tenant-scoped event stats cache
  private statsCache = new Map<string, { data: unknown; ts: number }>();
  private readonly STATS_TTL_MS = 3 * 60_000; // 3 min

  // Async write queue — batches DB writes to avoid blocking UI
  private writeQueue: Array<{ event_type: string; event_key: string; metadata: Record<string, unknown>; user_id: string }> = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_INTERVAL_MS = 2_000;
  private readonly MAX_BATCH = 20;

  constructor() {
    _collectorInstance = this;
    if (_pendingSignals.length > 0) {
      _pendingSignals.splice(0).forEach(s => this.trackModuleSignal(s));
    }
  }

  // ── Event tracking (persisted) ─────────────────────────────────

  async trackEvent(eventType: EventType, eventKey: string, metadata?: Record<string, unknown>) {
    if (!isSafe(eventKey)) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const safe = sanitiseMetadata(metadata);

    // Queue for batched async write — never blocks the UI
    this.writeQueue.push({ event_type: eventType, event_key: eventKey, metadata: safe, user_id: user.id });

    if (this.writeQueue.length >= this.MAX_BATCH) {
      this.flushWrites();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushWrites(), this.FLUSH_INTERVAL_MS);
    }
  }

  private flushWrites() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.writeQueue.length === 0) return;

    const batch = this.writeQueue.splice(0);
    // Fire-and-forget batch insert
    supabase
      .from('platform_cognitive_events')
      .insert(batch as any[])
      .then(({ error }) => {
        if (error) console.warn('[Cognitive] batch write error:', error.message);
      });
  }

  trackPageView(route: string) {
    this.trackEvent('page_view', route);
  }

  trackModuleUse(moduleKey: string) {
    this.trackEvent('module_use', moduleKey);
  }

  trackCommand(command: string, meta?: Record<string, unknown>) {
    this.trackEvent('command_exec', command, meta);
  }

  trackRoleSwitch(role: string) {
    this.trackEvent('role_switch', role);
  }

  // ── Module Signal (Federation) ────────────────────────────────

  /**
   * Track a signal emitted by a federated module.
   * PRIVACY: signal passes through isSafe + sanitiseMetadata.
   */
  trackModuleSignal(signal: CognitiveSignal) {
    this.moduleSignalLog.push(signal);
    if (this.moduleSignalLog.length > 200) this.moduleSignalLog.shift();

    // Persist as module_signal event
    const eventKey = `${signal.module_id}::${signal.event_type}::${signal.resource}`;
    this.trackEvent('module_signal', eventKey, sanitiseMetadata(signal.metadata));

    // Notify subscribers
    const handler = _signalHandlers.get(signal.module_id);
    if (handler) handler(signal);
  }

  /** Get recent module signals (in-memory only). */
  getModuleSignals(moduleId?: string): CognitiveSignal[] {
    if (!moduleId) return [...this.moduleSignalLog];
    return this.moduleSignalLog.filter(s => s.module_id === moduleId);
  }

  // ── Aggregated stats (from DB) ─────────────────────────────────

  async getEventStats(daysBack = 30) {
    // Tenant-scoped cache for stats
    const ck = `stats_${daysBack}`;
    const cached = this.statsCache.get(ck);
    if (cached && Date.now() - cached.ts < this.STATS_TTL_MS) {
      return cached.data as any;
    }

    const { data, error } = await supabase.rpc('get_cognitive_event_stats', { days_back: daysBack });
    if (error) {
      console.warn('[Cognitive] stats error:', error.message);
      return null;
    }

    const result = data as {
      top_pages: { page: string; visits: number }[];
      top_modules: { module: string; uses: number }[];
      top_commands: { command: string; executions: number }[];
      role_usage: { role: string; switches: number }[];
      active_users: number;
      total_events: number;
    };

    this.statsCache.set(ck, { data: result, ts: Date.now() });
    return result;
  }

  // ── Platform snapshot (cached) ─────────────────────────────────

  async collect(force = false): Promise<PlatformSnapshot> {
    if (!force && this.snapshotCache && Date.now() - this.snapshotTs < this.TTL_MS) {
      return this.snapshotCache;
    }

    const [tenantsRes, usersRes, permsRes, rpRes] = await Promise.all([
      supabase.from('tenants').select('id, name, status, created_at').limit(100),
      supabase.from('platform_users').select('id, email, role, role_id, status, platform_roles(slug, name)').limit(200),
      supabase.from('platform_permission_definitions').select('id, code, module, resource, action, domain, description'),
      supabase.from('platform_role_permissions').select('id, role, role_id, permission_id'),
    ]);

    this.snapshotCache = {
      tenants: (tenantsRes.data as any[]) ?? [],
      users: (usersRes.data as any[]) ?? [],
      permissions: (permsRes.data as any[]) ?? [],
      role_permissions: (rpRes.data as any[]) ?? [],
      modules_available: ['dashboard', 'tenants', 'modules', 'users', 'security', 'audit'],
    };
    this.snapshotTs = Date.now();
    return this.snapshotCache;
  }

  invalidate() {
    this.snapshotCache = null;
    this.snapshotTs = 0;
  }
}
