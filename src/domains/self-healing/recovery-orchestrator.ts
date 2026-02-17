/**
 * RecoveryOrchestrator — Coordinates recovery actions for incidents.
 *
 * Strategy per severity:
 *  - medium  → restart module, clear cache
 *  - high    → circuit break + restart + sandbox reset
 *  - critical → deactivate + circuit break + escalate
 */

import type { Incident, RecoveryAction, RecoveryActionType } from './types';
import { CircuitBreakerManager } from './circuit-breaker-manager';
import { HealingAuditLogger } from './healing-audit-logger';
import { ModuleAutoRecoveryService } from './module-auto-recovery-service';
import type { GlobalEventKernelAPI, ModuleOrchestratorAPI } from '@/domains/platform-os/types';

let _actionCounter = 0;

export class RecoveryOrchestrator {
  private autoRecovery: ModuleAutoRecoveryService;

  constructor(
    private circuitBreakers: CircuitBreakerManager,
    private auditLogger: HealingAuditLogger,
    private events: GlobalEventKernelAPI,
    private modules: ModuleOrchestratorAPI,
  ) {
    this.autoRecovery = new ModuleAutoRecoveryService(modules, events);
  }

  async recover(incident: Incident): Promise<void> {
    incident.status = 'recovering';
    this.events.emit('self_healing:recovery_started', 'SelfHealingEngine', {
      incident_id: incident.id, severity: incident.severity,
    }, { priority: 'high' });

    try {
      for (const moduleId of incident.affected_modules) {
        const actions = this.planActions(incident, moduleId);
        for (const actionType of actions) {
          const action = await this.executeAction(actionType, moduleId, incident);
          incident.recovery_actions.push(action);
          this.auditLogger.log(incident.id, action);
        }
      }

      const allSuccess = incident.recovery_actions.every(a => a.result === 'success' || a.result === 'skipped');
      if (allSuccess) {
        incident.status = 'recovered';
        incident.auto_recovered = true;
        incident.resolved_at = Date.now();
      } else {
        incident.status = 'escalated';
        incident.escalated_to = 'platform_super_admin';
      }
    } catch {
      incident.status = 'failed';
    }

    this.events.emit('self_healing:recovery_completed', 'SelfHealingEngine', {
      incident_id: incident.id, status: incident.status,
      actions: incident.recovery_actions.length,
    }, { priority: 'high' });
  }

  private planActions(incident: Incident, _moduleId: string): RecoveryActionType[] {
    switch (incident.severity) {
      case 'minor':
        return ['cache_clear', 'module_restart'];
      case 'major':
        return ['circuit_break', 'route_isolate', 'widget_disable', 'module_restart'];
      case 'critical':
        return ['circuit_break', 'module_deactivate', 'route_isolate', 'widget_disable', 'escalate'];
    }
  }

  private async executeAction(type: RecoveryActionType, moduleId: string, _incident: Incident): Promise<RecoveryAction> {
    const start = performance.now();
    const action: RecoveryAction = {
      id: `ra_${++_actionCounter}_${Date.now()}`,
      type,
      target_module: moduleId,
      description: '',
      executed_at: Date.now(),
      duration_ms: 0,
      result: 'success',
    };

    try {
      switch (type) {
        case 'module_restart': {
          action.description = `Reiniciando módulo ${moduleId}`;
          const res = await this.autoRecovery.restartModule(moduleId);
          if (!res.success) throw new Error(res.error);
          break;
        }

        case 'module_deactivate': {
          action.description = `Desativando módulo temporariamente ${moduleId}`;
          const res = await this.autoRecovery.disableModuleTemporarily(moduleId);
          if (!res.success) throw new Error(res.error);
          break;
        }

        case 'circuit_break':
          action.description = `Circuit breaker aberto para ${moduleId}`;
          this.circuitBreakers.recordFailure(moduleId);
          // Force open
          const cb = this.circuitBreakers.getOrCreate(moduleId);
          cb.state = 'open';
          cb.opened_at = Date.now();
          break;

        case 'cache_clear':
          action.description = `Cache limpo para ${moduleId}`;
          // Emit event so caches can react
          this.events.emit('self_healing:cache_clear', 'SelfHealingEngine', { module: moduleId });
          break;

        case 'sandbox_reset':
          action.description = `Sandbox resetado para ${moduleId}`;
          this.events.emit('self_healing:sandbox_reset', 'SelfHealingEngine', { module: moduleId });
          break;

        case 'access_graph_rebuild':
          action.description = 'Reconstruindo AccessGraph';
          this.events.emit('self_healing:access_graph_rebuild', 'SelfHealingEngine', {});
          break;

        case 'route_isolate':
          action.description = `Rotas isoladas para módulo ${moduleId}`;
          this.events.emit('self_healing:route_isolate', 'SelfHealingEngine', {
            module: moduleId, isolated: true,
          }, { priority: 'high' });
          break;

        case 'widget_disable':
          action.description = `Widgets desabilitados para módulo ${moduleId}`;
          this.events.emit('self_healing:widget_disable', 'SelfHealingEngine', {
            module: moduleId, disabled: true,
          }, { priority: 'high' });
          break;

        case 'rate_limit_engage':
          action.description = `Rate limiting ativado para ${moduleId}`;
          this.events.emit('self_healing:rate_limit', 'SelfHealingEngine', { module: moduleId });
          break;

        case 'escalate':
          action.description = `Escalado para PlatformSuperAdmin — módulo: ${moduleId}`;
          this.events.emit('self_healing:escalated', 'SelfHealingEngine', {
            module: moduleId, reason: 'Auto-recovery insufficient',
          }, { priority: 'critical' });
          break;
      }
    } catch (err) {
      action.result = 'failed';
      action.error = String(err);
    }

    action.duration_ms = Math.round(performance.now() - start);
    return action;
  }
}
