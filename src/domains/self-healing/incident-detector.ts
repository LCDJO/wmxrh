/**
 * IncidentDetector — Pattern matching to detect anomalies from health signals.
 *
 * Rules:
 *  - Module down → immediate critical incident
 *  - Error spike (>15 errors in 5 min) → high incident
 *  - Latency spike (p95 > 2000ms) → medium incident
 *  - Auth failure burst (>10 in 1 min) → high incident
 *  - Heartbeat lost for >3 modules → critical incident
 */

import type { HealthSignal, Incident, IncidentSeverity } from './types';

const ERROR_SPIKE_THRESHOLD = 15;
const ERROR_SPIKE_WINDOW_MS = 5 * 60_000;
const AUTH_BURST_THRESHOLD = 10;
const AUTH_BURST_WINDOW_MS = 60_000;
const MULTI_DOWN_THRESHOLD = 3;

let _idCounter = 0;

export class IncidentDetector {
  private signalBuffer: HealthSignal[] = [];
  private activeIncidentKeys = new Set<string>();

  /** Ingest a signal and return a new Incident if a pattern matches, or null. */
  ingest(signal: HealthSignal): Incident | null {
    this.signalBuffer.push(signal);
    // Prune old signals (>10 min)
    const cutoff = Date.now() - 10 * 60_000;
    this.signalBuffer = this.signalBuffer.filter(s => s.detected_at > cutoff);

    const incidentKey = `${signal.type}:${signal.source_module}`;

    // Avoid duplicate incidents for same pattern
    if (this.activeIncidentKeys.has(incidentKey)) return null;

    let incident: Incident | null = null;

    switch (signal.type) {
      case 'module_down':
        incident = this.createIncident(
          `Módulo offline: ${signal.source_module}`,
          `O módulo ${signal.source_module} está inacessível.`,
          'critical',
          [signal],
          [signal.source_module],
        );
        break;

      case 'error_spike': {
        const recentErrors = this.signalBuffer.filter(
          s => s.type === 'error_spike' && s.source_module === signal.source_module &&
               s.detected_at > Date.now() - ERROR_SPIKE_WINDOW_MS,
        );
        if (recentErrors.length >= ERROR_SPIKE_THRESHOLD) {
          incident = this.createIncident(
            `Pico de erros: ${signal.source_module}`,
            `${recentErrors.length} erros detectados em 5 minutos.`,
            'high',
            recentErrors,
            [signal.source_module],
          );
        }
        break;
      }

      case 'auth_failure_burst': {
        const recentAuth = this.signalBuffer.filter(
          s => s.type === 'auth_failure_burst' && s.detected_at > Date.now() - AUTH_BURST_WINDOW_MS,
        );
        if (recentAuth.length >= AUTH_BURST_THRESHOLD) {
          const modules = [...new Set(recentAuth.map(s => s.source_module))];
          incident = this.createIncident(
            'Surto de falhas de autenticação',
            `${recentAuth.length} falhas de auth em 1 minuto.`,
            'high',
            recentAuth,
            modules,
          );
        }
        break;
      }

      case 'heartbeat_lost': {
        const lostModules = this.signalBuffer
          .filter(s => s.type === 'heartbeat_lost')
          .map(s => s.source_module);
        const unique = [...new Set(lostModules)];
        if (unique.length >= MULTI_DOWN_THRESHOLD) {
          incident = this.createIncident(
            'Múltiplos módulos sem heartbeat',
            `${unique.length} módulos perderam heartbeat.`,
            'critical',
            this.signalBuffer.filter(s => s.type === 'heartbeat_lost'),
            unique,
          );
        }
        break;
      }

      case 'latency_spike':
        incident = this.createIncident(
          `Latência elevada: ${signal.source_module}`,
          `Latência p95 acima do limiar para ${signal.source_module}.`,
          'medium',
          [signal],
          [signal.source_module],
        );
        break;

      case 'module_degraded':
        incident = this.createIncident(
          `Módulo degradado: ${signal.source_module}`,
          `O módulo ${signal.source_module} está em estado degradado.`,
          'medium',
          [signal],
          [signal.source_module],
        );
        break;
    }

    if (incident) this.activeIncidentKeys.add(incidentKey);
    return incident;
  }

  clearIncidentKey(key: string) {
    this.activeIncidentKeys.delete(key);
  }

  private createIncident(
    title: string, description: string, severity: IncidentSeverity,
    signals: HealthSignal[], modules: string[],
  ): Incident {
    return {
      id: `inc_${++_idCounter}_${Date.now()}`,
      title,
      description,
      severity,
      status: 'detected',
      signals,
      affected_modules: modules,
      recovery_actions: [],
      detected_at: Date.now(),
      resolved_at: null,
      auto_recovered: false,
    };
  }
}
