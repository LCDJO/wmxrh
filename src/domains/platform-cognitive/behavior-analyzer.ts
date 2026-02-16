/**
 * BehaviorAnalyzer
 *
 * Tracks in-session navigation events and produces a BehaviorProfile
 * that advisors can use to personalise suggestions.
 * Data stays in-memory (no persistence) — privacy-first.
 */
import type { BehaviorEvent, BehaviorProfile } from './types';

const MAX_EVENTS = 500;

export class BehaviorAnalyzer {
  private events: BehaviorEvent[] = [];

  track(action: string, route: string) {
    this.events.push({ action, route, timestamp: Date.now() });
    if (this.events.length > MAX_EVENTS) this.events.shift();
  }

  profile(): BehaviorProfile {
    const routeMap = new Map<string, number>();
    this.events.forEach(e => routeMap.set(e.route, (routeMap.get(e.route) ?? 0) + 1));

    const top_routes = Array.from(routeMap.entries())
      .map(([route, visits]) => ({ route, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 8);

    // Simple session heuristic: gap > 30 min = new session
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

  clear() {
    this.events = [];
  }
}
