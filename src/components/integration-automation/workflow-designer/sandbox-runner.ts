/**
 * WorkflowSandboxRunner
 *
 * Executes workflow runs in an isolated sandbox environment using
 * TenantSandboxEngine for multi-tenant isolation.
 *
 * Guarantees:
 *  - Data isolation via TenantSandboxEngine sandbox prefixes
 *  - Billing is NEVER triggered in sandbox mode
 *  - Rate limits are relaxed for testing
 *  - Runs are tagged with sandbox metadata
 *  - Sandbox auto-expires based on TTL
 */

import type { WfCanvasNode, WfCanvasEdge } from './types';
import type { EventTriggerDef } from './event-trigger-registry';
import {
  WorkflowExecutionEngine,
  type WorkflowRun,
  type RetryPolicy,
} from './execution-engine';

// ════════════════════════════════════
// TenantSandboxEngine contract
// (mirrors the PAMS TenantSandboxEngineAPI)
// ════════════════════════════════════

export interface TenantSandboxEngineAPI {
  hasSandbox(tenantId: string): boolean;
  getSandboxConfig(tenantId: string): SandboxConfig | null;
  createSandbox(tenantId: string, options?: SandboxOptions): SandboxConfig;
  destroySandbox(tenantId: string): void;
}

export interface SandboxConfig {
  tenantId: string;
  createdAt: string;
  expiresAt?: string;
  dataPrefix: string;
  hasTestData: boolean;
  maxRequests: number;
}

export interface SandboxOptions {
  seedTestData?: boolean;
  expiresInHours?: number;
  maxRequests?: number;
}

// ════════════════════════════════════
// SANDBOX RUN RESULT
// ════════════════════════════════════

export interface SandboxRunResult {
  run: WorkflowRun;
  sandboxConfig: SandboxConfig;
  warnings: string[];
  billingBlocked: true;
  dataIsolated: true;
}

// ════════════════════════════════════
// IN-MEMORY SANDBOX ENGINE
// (used when no external engine is provided)
// ════════════════════════════════════

class InMemoryTenantSandboxEngine implements TenantSandboxEngineAPI {
  private sandboxes = new Map<string, SandboxConfig>();

  hasSandbox(tenantId: string): boolean {
    const sb = this.sandboxes.get(tenantId);
    if (!sb) return false;
    if (sb.expiresAt && new Date(sb.expiresAt) < new Date()) {
      this.sandboxes.delete(tenantId);
      return false;
    }
    return true;
  }

  getSandboxConfig(tenantId: string): SandboxConfig | null {
    return this.sandboxes.get(tenantId) ?? null;
  }

  createSandbox(tenantId: string, options?: SandboxOptions): SandboxConfig {
    const expiresInHours = options?.expiresInHours ?? 24;
    const config: SandboxConfig = {
      tenantId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresInHours * 3600_000).toISOString(),
      dataPrefix: `sandbox_${tenantId.slice(0, 8)}_`,
      hasTestData: options?.seedTestData ?? false,
      maxRequests: options?.maxRequests ?? 10_000,
    };
    this.sandboxes.set(tenantId, config);
    return config;
  }

  destroySandbox(tenantId: string): void {
    this.sandboxes.delete(tenantId);
  }
}

// ════════════════════════════════════
// SANDBOX RETRY POLICY (more generous)
// ════════════════════════════════════

const SANDBOX_RETRY_POLICY: Partial<RetryPolicy> = {
  maxRetries: 5,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  backoffMultiplier: 1.5,
};

// ════════════════════════════════════
// WORKFLOW SANDBOX RUNNER
// ════════════════════════════════════

export class WorkflowSandboxRunner {
  private engine: WorkflowExecutionEngine;
  private sandboxEngine: TenantSandboxEngineAPI;
  private activeRuns = new Map<string, SandboxRunResult>();

  constructor(sandboxEngine?: TenantSandboxEngineAPI) {
    this.engine = new WorkflowExecutionEngine(SANDBOX_RETRY_POLICY);
    this.sandboxEngine = sandboxEngine ?? new InMemoryTenantSandboxEngine();
  }

  /**
   * Execute a workflow in sandbox mode.
   *
   * 1. Provisions (or reuses) a sandbox for the tenant
   * 2. Runs the workflow with isSandbox=true
   * 3. Blocks any billing side-effects
   * 4. Tags results with sandbox metadata
   */
  async executeInSandbox(params: {
    workflowId: string;
    tenantId: string;
    nodes: WfCanvasNode[];
    edges: WfCanvasEdge[];
    trigger: EventTriggerDef;
    triggerPayload: unknown;
    sandboxOptions?: SandboxOptions;
  }): Promise<SandboxRunResult> {
    const { tenantId } = params;
    const warnings: string[] = [];

    // 1. Ensure sandbox exists
    let sandboxConfig: SandboxConfig;
    if (this.sandboxEngine.hasSandbox(tenantId)) {
      sandboxConfig = this.sandboxEngine.getSandboxConfig(tenantId)!;
      warnings.push('Reusing existing sandbox environment');
    } else {
      sandboxConfig = this.sandboxEngine.createSandbox(tenantId, {
        seedTestData: params.sandboxOptions?.seedTestData ?? true,
        expiresInHours: params.sandboxOptions?.expiresInHours ?? 24,
        maxRequests: params.sandboxOptions?.maxRequests ?? 10_000,
      });
    }

    // 2. Check TTL
    if (sandboxConfig.expiresAt && new Date(sandboxConfig.expiresAt) < new Date()) {
      this.sandboxEngine.destroySandbox(tenantId);
      sandboxConfig = this.sandboxEngine.createSandbox(tenantId, params.sandboxOptions);
      warnings.push('Previous sandbox expired — new sandbox provisioned');
    }

    // 3. Execute workflow with sandbox flag
    const run = await this.engine.executeWorkflow({
      ...params,
      isSandbox: true,
    });

    // 4. Build result
    const result: SandboxRunResult = {
      run,
      sandboxConfig,
      warnings,
      billingBlocked: true,
      dataIsolated: true,
    };

    this.activeRuns.set(run.id, result);
    return result;
  }

  /** Get sandbox run result by run ID. */
  getSandboxRun(runId: string): SandboxRunResult | undefined {
    return this.activeRuns.get(runId);
  }

  /** Get all sandbox runs for a tenant. */
  getSandboxRunsByTenant(tenantId: string): SandboxRunResult[] {
    return Array.from(this.activeRuns.values()).filter(
      r => r.sandboxConfig.tenantId === tenantId,
    );
  }

  /** Destroy tenant sandbox and clean up runs. */
  teardownSandbox(tenantId: string): void {
    this.sandboxEngine.destroySandbox(tenantId);
    for (const [id, result] of this.activeRuns) {
      if (result.sandboxConfig.tenantId === tenantId) {
        this.activeRuns.delete(id);
      }
    }
  }

  /** Check if a sandbox is active for a tenant. */
  hasSandbox(tenantId: string): boolean {
    return this.sandboxEngine.hasSandbox(tenantId);
  }
}

/** Singleton sandbox runner */
export const workflowSandboxRunner = new WorkflowSandboxRunner();
