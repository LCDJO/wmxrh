/**
 * useSelfHealingStatus — React hook that exposes degraded module state
 * from the SelfHealingEngine for UI fallback experience (PXE).
 *
 * Returns:
 *  - degradedModules: list of module IDs with open/half_open circuits
 *  - activeIncidents: current unresolved incidents
 *  - showDegradationBanner: boolean shortcut
 */

import { useState, useEffect, useCallback } from 'react';
import type { Incident, CircuitBreakerState } from '@/domains/self-healing/types';

interface SelfHealingStatus {
  degradedModules: string[];
  activeIncidents: Pick<Incident, 'id' | 'title' | 'severity' | 'status' | 'affected_modules'>[];
  circuitBreakers: CircuitBreakerState[];
  showDegradationBanner: boolean;
}

/**
 * Connects to the SelfHealingEngine singleton (lazy import to avoid
 * circular deps with platform-os). Falls back gracefully if engine
 * is not yet initialised.
 */
export function useSelfHealingStatus(): SelfHealingStatus {
  const [status, setStatus] = useState<SelfHealingStatus>({
    degradedModules: [],
    activeIncidents: [],
    circuitBreakers: [],
    showDegradationBanner: false,
  });

  const refresh = useCallback(() => {
    try {
      // Dynamic require to avoid top-level circular import
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getSelfHealingEngine } = require('@/domains/self-healing/self-healing-engine') as {
        getSelfHealingEngine: () => {
          getState: () => {
            active_incidents: Incident[];
            circuit_breakers: CircuitBreakerState[];
          };
          circuitBreakers: { getDegradedModules: () => string[] };
        } | null;
      };

      const engine = getSelfHealingEngine();
      if (!engine) return;

      const state = engine.getState();
      const degraded = engine.circuitBreakers.getDegradedModules();

      setStatus({
        degradedModules: degraded,
        activeIncidents: state.active_incidents.map(i => ({
          id: i.id,
          title: i.title,
          severity: i.severity,
          status: i.status,
          affected_modules: i.affected_modules,
        })),
        circuitBreakers: state.circuit_breakers,
        showDegradationBanner: degraded.length > 0 || state.active_incidents.length > 0,
      });
    } catch {
      // Engine not initialised yet — no-op
    }
  }, []);

  useEffect(() => {
    refresh();

    let cleanup: (() => void) | undefined;
    try {
      const { getSelfHealingEngine } = require('@/domains/self-healing/self-healing-engine') as {
        getSelfHealingEngine: () => { onUpdate: (fn: () => void) => () => void } | null;
      };
      const engine = getSelfHealingEngine();
      if (engine) {
        cleanup = engine.onUpdate(refresh);
      }
    } catch {
      // Engine not ready
    }
    return () => { cleanup?.(); };
  }, [refresh]);

  return status;
}
