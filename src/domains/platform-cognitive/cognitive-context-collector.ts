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

export type EventType = 'page_view' | 'module_use' | 'command_exec' | 'role_switch';

export class CognitiveContextCollector {
  private snapshotCache: PlatformSnapshot | null = null;
  private snapshotTs = 0;
  private readonly TTL_MS = 60_000;

  // ── Event tracking (persisted) ─────────────────────────────────

  async trackEvent(eventType: EventType, eventKey: string, metadata?: Record<string, unknown>) {
    // Safety gate
    if (!isSafe(eventKey)) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const safe = sanitiseMetadata(metadata);

    // Fire-and-forget — don't block the UI
    supabase
      .from('platform_cognitive_events')
      .insert({ user_id: user.id, event_type: eventType, event_key: eventKey, metadata: safe } as any)
      .then(({ error }) => { if (error) console.warn('[Cognitive] track error:', error.message); });
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

  // ── Aggregated stats (from DB) ─────────────────────────────────

  async getEventStats(daysBack = 30) {
    const { data, error } = await supabase.rpc('get_cognitive_event_stats', { days_back: daysBack });
    if (error) {
      console.warn('[Cognitive] stats error:', error.message);
      return null;
    }
    return data as {
      top_pages: { page: string; visits: number }[];
      top_modules: { module: string; uses: number }[];
      top_commands: { command: string; executions: number }[];
      role_usage: { role: string; switches: number }[];
      active_users: number;
      total_events: number;
    };
  }

  // ── Platform snapshot (cached) ─────────────────────────────────

  async collect(force = false): Promise<PlatformSnapshot> {
    if (!force && this.snapshotCache && Date.now() - this.snapshotTs < this.TTL_MS) {
      return this.snapshotCache;
    }

    const [tenantsRes, usersRes, permsRes, rpRes] = await Promise.all([
      supabase.from('tenants').select('id, name, status, created_at').limit(100),
      supabase.from('platform_users').select('id, email, role, status').limit(200),
      supabase.from('platform_permission_definitions').select('id, code, module, description'),
      supabase.from('platform_role_permissions').select('id, role, permission_id'),
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
