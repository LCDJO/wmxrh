/**
 * CognitiveOrchestrator — Bridges the Cognitive Layer into the POSL.
 *
 * Provides a simplified facade for tracking navigation, module use,
 * and querying the cognitive state. Delegates to CognitiveInsightsService.
 *
 * SECURITY: READ-ONLY. Does not execute any mutations.
 */

import type { CognitiveOrchestratorAPI, CognitiveState, GlobalEventKernelAPI } from './types';
import { CognitiveInsightsService } from '@/domains/platform-cognitive/cognitive-insights.service';

export function createCognitiveOrchestrator(
  events: GlobalEventKernelAPI,
  cognitiveService: CognitiveInsightsService,
): CognitiveOrchestratorAPI {
  let lastQueryAt: number | null = null;

  // Bridge navigation events from EventKernel to cognitive tracking
  events.on('navigation:navigated', (event) => {
    const path = (event.payload as any)?.path;
    if (path) cognitiveService.trackNavigation(path);
  });

  // Bridge module activation events
  events.on('module:activated', (event) => {
    const key = (event.payload as any)?.key;
    if (key) cognitiveService.trackModuleUse(key);
  });

  function state(): CognitiveState {
    const profile = cognitiveService.getBehaviorProfile();
    return {
      is_active: true,
      last_query_at: lastQueryAt,
      pending_suggestions: 0,
      active_signals: 0,
      behavior_session_count: profile?.session_count ?? 0,
    };
  }

  function trackNavigation(route: string, userId?: string): void {
    cognitiveService.trackNavigation(route, userId);
  }

  function trackModuleUse(moduleKey: string): void {
    cognitiveService.trackModuleUse(moduleKey);
  }

  function isActive(): boolean {
    return true;
  }

  return { state, trackNavigation, trackModuleUse, isActive };
}
