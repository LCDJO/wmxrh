/**
 * BehaviorAnalyzer
 *
 * Combines in-session tracking (memory) with persisted event stats (DB)
 * to produce a rich BehaviorProfile for advisors.
 */
import type { BehaviorEvent, BehaviorProfile } from './types';
import { CognitiveContextCollector } from './cognitive-context-collector';

const MAX_EVENTS = 500;

export class BehaviorAnalyzer {
  private events: BehaviorEvent[] = [];
  private collector: CognitiveContextCollector;

  constructor(collector: CognitiveContextCollector) {
    this.collector = collector;
  }

  /** Track in-session event (memory only — persistence is handled by collector). */
  track(action: string, route: string) {
    this.events.push({ action, route, timestamp: Date.now() });
    if (this.events.length > MAX_EVENTS) this.events.shift();

    // Also persist via collector
    this.collector.trackPageView(route);
  }

  /** In-session profile (fast, no DB call). */
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

  /** Full profile merging session data with persisted DB stats. */
  async fullProfile(daysBack = 30): Promise<BehaviorProfile & { db_stats: Record<string, unknown> | null }> {
    const session = this.sessionProfile();
    const dbStats = await this.collector.getEventStats(daysBack);

    // Merge DB top_pages into session top_routes
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

    return { ...session, db_stats: dbStats };
  }

  clear() {
    this.events = [];
  }
}
