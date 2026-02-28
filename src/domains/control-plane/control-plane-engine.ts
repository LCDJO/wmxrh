/**
 * ControlPlaneEngine — Main APCP façade that integrates all sub-systems.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AutonomousControlPlane                                         ║
 * ║   ├── PlatformStateAggregator   (unified state snapshot)        ║
 * ║   ├── AutomationRuleEngine      (event-driven automation)       ║
 * ║   ├── ActionOrchestrator        (safe action execution)         ║
 * ║   ├── RiskCommandCenter         (aggregated risk view)          ║
 * ║   ├── ModuleControlCenter       (module ops + circuit state)    ║
 * ║   ├── IdentityControlCenter     (identity ops summary)          ║
 * ║   └── ObservabilityBridge       (metrics + health bridge)       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { PlatformRuntimeAPI } from '@/domains/platform-os/types';
import type { ControlPlaneAPI, ControlAction, ActionResult, AutomationRule } from './types';
import { PlatformStateAggregator } from './platform-state-aggregator';
import { AutomationRuleEngine } from './automation-rule-engine';
import { ActionOrchestrator } from './action-orchestrator';
import { RiskCommandCenter } from './risk-command-center';
import { ModuleControlCenter } from './module-control-center';
import { IdentityControlCenter } from './identity-control-center';
import { ObservabilityBridge } from './observability-bridge';
import { createSubscriptionHealthMonitor, type SubscriptionHealthMonitorAPI } from './subscription-health-monitor';

const TICK_INTERVAL_MS = 30_000; // 30s state refresh

export class ControlPlaneEngine implements ControlPlaneAPI {
  private stateAggregator: PlatformStateAggregator;
  private automationEngine: AutomationRuleEngine;
  private actionOrchestrator: ActionOrchestrator;
  private riskCenter: RiskCommandCenter;
  private moduleCenter: ModuleControlCenter;
  private identityCenter: IdentityControlCenter;
  private observability: ObservabilityBridge;
  private subscriptionHealth: SubscriptionHealthMonitorAPI;

  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private runtime: PlatformRuntimeAPI) {
    this.actionOrchestrator = new ActionOrchestrator(runtime);
    this.stateAggregator = new PlatformStateAggregator(runtime);
    this.automationEngine = new AutomationRuleEngine(runtime.events, this.actionOrchestrator);
    this.riskCenter = new RiskCommandCenter(runtime);
    this.moduleCenter = new ModuleControlCenter(runtime);
    this.identityCenter = new IdentityControlCenter(runtime);
    this.observability = new ObservabilityBridge(runtime);
    this.subscriptionHealth = createSubscriptionHealthMonitor();
  }

  start(): void {
    this.observability.registerMetrics();
    this.automationEngine.start();
    this.identityCenter.start();

    // Periodic state collection
    this.tick();
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);

    console.info('[APCP] Autonomous Control Plane started');
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.automationEngine.stop();
    this.identityCenter.stop();
    console.info('[APCP] Autonomous Control Plane stopped');
  }

  private tick(): void {
    const state = this.stateAggregator.snapshot();
    this.observability.incrementSnapshots();
    this.observability.updateGauges(
      state.overall_risk_score,
      state.active_modules,
      state.error_modules,
    );
  }

  // ── ControlPlaneAPI implementation ──────────────────────────

  getState() {
    return this.stateAggregator.snapshot();
  }

  getStateHistory(limit?: number) {
    return this.stateAggregator.getHistory(limit);
  }

  listRules() {
    return this.automationEngine.listRules();
  }

  addRule(rule: Omit<AutomationRule, 'id' | 'last_triggered_at' | 'trigger_count' | 'created_at'>) {
    return this.automationEngine.addRule(rule);
  }

  removeRule(ruleId: string) {
    this.automationEngine.removeRule(ruleId);
  }

  toggleRule(ruleId: string, enabled: boolean) {
    this.automationEngine.toggleRule(ruleId, enabled);
  }

  execute(action: ControlAction): ActionResult {
    this.observability.incrementActions();
    return this.actionOrchestrator.execute(action);
  }

  getRiskSummary() {
    return this.riskCenter.getSummary();
  }

  getModuleControl() {
    return this.moduleCenter.getAll();
  }

  getIdentityControl() {
    return this.identityCenter.getSummary();
  }

  getSubscriptionHealth() {
    return this.subscriptionHealth;
  }
}

// ══════════════════════════════════════════════════════════════════
// Singleton
// ══════════════════════════════════════════════════════════════════

let _instance: ControlPlaneEngine | null = null;

export function getControlPlaneEngine(runtime: PlatformRuntimeAPI): ControlPlaneEngine {
  if (!_instance) {
    _instance = new ControlPlaneEngine(runtime);
  }
  return _instance;
}

export function resetControlPlaneEngine(): void {
  if (_instance) {
    _instance.stop();
    _instance = null;
  }
}
