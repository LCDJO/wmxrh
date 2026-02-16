/**
 * BehaviorAnalyzer
 *
 * Combines in-session tracking with persisted DB stats.
 * Detects access patterns and suggests roles based on behaviour.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  LGPD / PRIVACY                                                 ║
 * ║  This analyzer works ONLY with navigation metadata (routes,     ║
 * ║  module keys, command names). It NEVER accesses, stores, or     ║
 * ║  processes personal data (names, emails, CPF, salaries, etc.)   ║
 * ║  Events are anonymous behavioral signals only.                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Pattern detection logic:
 *  1. Aggregate page/command events per user
 *  2. Match against known role fingerprints
 *  3. Score each fingerprint match (0–1)
 *  4. Return top suggestions with confidence
 */
import type { BehaviorEvent, BehaviorProfile } from './types';
import { CognitiveContextCollector } from './cognitive-context-collector';

const MAX_EVENTS = 500;

// ── Role fingerprints ──────────────────────────────────────────────
// Each fingerprint maps a role suggestion to the signals (routes, commands, modules)
// that characterise it. Weights allow fine-grained scoring.

export interface RoleFingerprint {
  role: string;
  label: string;
  description: string;
  signals: { pattern: RegExp; weight: number }[];
  /** Minimum total weighted score to consider a match (0–1 normalised later). */
  threshold: number;
}

export const ROLE_FINGERPRINTS: RoleFingerprint[] = [
  {
    role: 'hr_manager',
    label: 'HR Manager',
    description: 'Gestão completa de colaboradores, cargos e departamentos',
    signals: [
      { pattern: /employee/i, weight: 3 },
      { pattern: /employees/i, weight: 2 },
      { pattern: /positions/i, weight: 1.5 },
      { pattern: /departments/i, weight: 1.5 },
      { pattern: /employee\.view/i, weight: 2 },
      { pattern: /employee\.update/i, weight: 2 },
      { pattern: /employee\.create/i, weight: 1.5 },
      { pattern: /compensation/i, weight: 1 },
    ],
    threshold: 4,
  },
  {
    role: 'compliance_officer',
    label: 'Compliance Officer',
    description: 'Conformidade trabalhista, eSocial e normas regulatórias',
    signals: [
      { pattern: /compliance/i, weight: 3 },
      { pattern: /esocial/i, weight: 3 },
      { pattern: /labor/i, weight: 2 },
      { pattern: /occupational/i, weight: 2 },
      { pattern: /nr-compliance/i, weight: 2 },
      { pattern: /audit/i, weight: 1.5 },
      { pattern: /health/i, weight: 1 },
    ],
    threshold: 4,
  },
  {
    role: 'payroll_analyst',
    label: 'Payroll Analyst',
    description: 'Simulação de folha, remuneração e benefícios',
    signals: [
      { pattern: /payroll/i, weight: 3 },
      { pattern: /compensation/i, weight: 2.5 },
      { pattern: /benefits/i, weight: 2 },
      { pattern: /salary/i, weight: 2 },
      { pattern: /simulation/i, weight: 2 },
      { pattern: /labor-rules/i, weight: 1 },
    ],
    threshold: 4,
  },
  {
    role: 'safety_engineer',
    label: 'Safety Engineer',
    description: 'Saúde ocupacional, treinamentos NR e riscos',
    signals: [
      { pattern: /health/i, weight: 3 },
      { pattern: /nr-compliance/i, weight: 3 },
      { pattern: /occupational/i, weight: 2.5 },
      { pattern: /training/i, weight: 2 },
      { pattern: /treinamento/i, weight: 2 },
      { pattern: /risk/i, weight: 1.5 },
    ],
    threshold: 4,
  },
  {
    role: 'iam_admin',
    label: 'IAM Admin',
    description: 'Gestão de usuários, roles e permissões',
    signals: [
      { pattern: /iam/i, weight: 3 },
      { pattern: /settings.*users/i, weight: 2.5 },
      { pattern: /settings.*roles/i, weight: 2.5 },
      { pattern: /security/i, weight: 2 },
      { pattern: /permission/i, weight: 2 },
      { pattern: /role/i, weight: 1.5 },
    ],
    threshold: 4,
  },
  {
    role: 'platform_operator',
    label: 'Platform Operator',
    description: 'Gestão de tenants, módulos e operações da plataforma',
    signals: [
      { pattern: /platform/i, weight: 3 },
      { pattern: /tenants/i, weight: 2.5 },
      { pattern: /modules/i, weight: 2 },
      { pattern: /platform.*dashboard/i, weight: 2 },
      { pattern: /platform.*users/i, weight: 2 },
      { pattern: /platform.*security/i, weight: 1.5 },
    ],
    threshold: 4,
  },
  {
    role: 'intelligence_analyst',
    label: 'Intelligence Analyst',
    description: 'Workforce intelligence, analytics e insights estratégicos',
    signals: [
      { pattern: /workforce/i, weight: 3 },
      { pattern: /intelligence/i, weight: 3 },
      { pattern: /strategic/i, weight: 2.5 },
      { pattern: /dashboard/i, weight: 1.5 },
      { pattern: /analytics/i, weight: 2 },
      { pattern: /insight/i, weight: 2 },
    ],
    threshold: 4,
  },
  {
    role: 'document_manager',
    label: 'Document Manager',
    description: 'Gestão de termos, assinatura digital e documentos',
    signals: [
      { pattern: /agreement/i, weight: 3 },
      { pattern: /document/i, weight: 2.5 },
      { pattern: /signature/i, weight: 2.5 },
      { pattern: /template/i, weight: 2 },
      { pattern: /termo/i, weight: 2 },
    ],
    threshold: 4,
  },
];

// ── Match result ───────────────────────────────────────────────────
export interface RoleSuggestionMatch {
  role: string;
  label: string;
  description: string;
  confidence: number;           // 0–1
  matched_signals: string[];    // which patterns fired
  event_count: number;          // how many events contributed
}

export class BehaviorAnalyzer {
  private events: BehaviorEvent[] = [];
  private collector: CognitiveContextCollector;

  constructor(collector: CognitiveContextCollector) {
    this.collector = collector;
  }

  track(action: string, route: string) {
    this.events.push({ action, route, timestamp: Date.now() });
    if (this.events.length > MAX_EVENTS) this.events.shift();
    this.collector.trackPageView(route);
  }

  // ── Pattern detection & role suggestion ────────────────────────

  /**
   * Analyse events (session + DB) and return role suggestions
   * sorted by confidence descending.
   */
  async detectRoleSuggestions(): Promise<RoleSuggestionMatch[]> {
    // Merge session events + DB stats into a unified signal list
    const signals = this.buildSignalList();

    // Enrich with DB aggregated data
    const dbStats = await this.collector.getEventStats(30);
    if (dbStats) {
      dbStats.top_pages?.forEach((p: any) => {
        for (let i = 0; i < Math.min(Number(p.visits), 20); i++) {
          signals.push(p.page);
        }
      });
      dbStats.top_modules?.forEach((m: any) => {
        for (let i = 0; i < Math.min(Number(m.uses), 15); i++) {
          signals.push(m.module);
        }
      });
      dbStats.top_commands?.forEach((c: any) => {
        for (let i = 0; i < Math.min(Number(c.executions), 10); i++) {
          signals.push(c.command);
        }
      });
    }

    if (signals.length === 0) return [];

    return this.scoreFingerprints(signals);
  }

  /** Synchronous session-only role suggestions (no DB call). */
  detectSessionRoleSuggestions(): RoleSuggestionMatch[] {
    const signals = this.buildSignalList();
    if (signals.length === 0) return [];
    return this.scoreFingerprints(signals);
  }

  // ── Profile helpers ────────────────────────────────────────────

  sessionProfile(): BehaviorProfile {
    const routeMap = new Map<string, number>();
    this.events.forEach(e => routeMap.set(e.route, (routeMap.get(e.route) ?? 0) + 1));

    const top_routes = Array.from(routeMap.entries())
      .map(([route, visits]) => ({ route, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 8);

    let sessions = 1;
    for (let i = 1; i < this.events.length; i++) {
      if (this.events[i].timestamp - this.events[i - 1].timestamp > 30 * 60_000) sessions++;
    }

    const totalMs = this.events.length > 1
      ? this.events[this.events.length - 1].timestamp - this.events[0].timestamp
      : 0;

    return {
      top_routes,
      session_count: sessions,
      avg_session_minutes: sessions > 0 ? Math.round(totalMs / sessions / 60_000) : 0,
      most_used_features: top_routes.slice(0, 5).map(r => r.route),
    };
  }

  async fullProfile(daysBack = 30): Promise<BehaviorProfile & { db_stats: Record<string, unknown> | null; role_suggestions: RoleSuggestionMatch[] }> {
    const session = this.sessionProfile();
    const dbStats = await this.collector.getEventStats(daysBack);

    if (dbStats?.top_pages) {
      const merged = new Map<string, number>();
      session.top_routes.forEach(r => merged.set(r.route, r.visits));
      dbStats.top_pages.forEach((p: any) => {
        merged.set(p.page, (merged.get(p.page) ?? 0) + Number(p.visits));
      });
      session.top_routes = Array.from(merged.entries())
        .map(([route, visits]) => ({ route, visits }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 10);
      session.most_used_features = session.top_routes.slice(0, 5).map(r => r.route);
    }

    const role_suggestions = await this.detectRoleSuggestions();

    return { ...session, db_stats: dbStats, role_suggestions };
  }

  clear() {
    this.events = [];
  }

  // ── Internal ───────────────────────────────────────────────────

  private buildSignalList(): string[] {
    return this.events.map(e => e.route);
  }

  private scoreFingerprints(signals: string[]): RoleSuggestionMatch[] {
    const results: RoleSuggestionMatch[] = [];

    for (const fp of ROLE_FINGERPRINTS) {
      let totalScore = 0;
      let eventCount = 0;
      const matchedSignals = new Set<string>();

      for (const signal of signals) {
        for (const s of fp.signals) {
          if (s.pattern.test(signal)) {
            totalScore += s.weight;
            eventCount++;
            matchedSignals.add(s.pattern.source);
          }
        }
      }

      if (totalScore >= fp.threshold && matchedSignals.size >= 2) {
        // Normalise confidence: asymptotic approach to 1.0
        const confidence = Math.min(1, totalScore / (fp.threshold * 3));

        results.push({
          role: fp.role,
          label: fp.label,
          description: fp.description,
          confidence: Math.round(confidence * 100) / 100,
          matched_signals: Array.from(matchedSignals),
          event_count: eventCount,
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}
