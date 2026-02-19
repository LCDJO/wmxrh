/**
 * Workflow Execution Engine
 *
 * Executes workflows asynchronously with:
 *  - Multi-tenant isolation (tenant_id scoping on every run)
 *  - Automatic retry with exponential backoff
 *  - Node-level execution tracking
 *  - Condition branching (true/false paths)
 *  - Connector-aware action dispatch
 */

import type { WfCanvasNode, WfCanvasEdge } from './types';
import type { ConnectorType } from './connector-registry';
import { getConnectorDef } from './connector-registry';
import type { EventTriggerDef } from './event-trigger-registry';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';
export type NodeExecStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface WorkflowRun {
  id: string;
  workflowId: string;
  tenantId: string;
  status: RunStatus;
  triggerEvent: string;
  triggerPayload: unknown;
  nodeExecutions: NodeExecution[];
  startedAt: string;
  completedAt?: string;
  error?: string;
  retryAttempt: number;
  maxRetries: number;
  metadata: Record<string, unknown>;
}

export interface NodeExecution {
  nodeId: string;
  nodeLabel: string;
  nodeCategory: string;
  status: NodeExecStatus;
  startedAt?: string;
  completedAt?: string;
  input: unknown;
  output: unknown;
  error?: string;
  retryCount: number;
  durationMs?: number;
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface ExecutionContext {
  tenantId: string;
  runId: string;
  /** Accumulated outputs from previous nodes, keyed by nodeId */
  nodeOutputs: Record<string, unknown>;
  /** The original trigger payload */
  triggerPayload: unknown;
  /** Whether running in sandbox mode */
  isSandbox: boolean;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

// ════════════════════════════════════
// DEFAULT RETRY POLICY
// ════════════════════════════════════

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
};

// ════════════════════════════════════
// ACTION HANDLERS (per connector type)
// ════════════════════════════════════

type ActionHandler = (
  node: WfCanvasNode,
  ctx: ExecutionContext,
) => Promise<unknown>;

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  // HTTP Webhook — POST payload to configured URL
  async http_webhook(node, ctx) {
    const url = node.config.url as string;
    const method = (node.config.method as string) || 'POST';
    const headers = (node.config.headers as Record<string, string>) ?? {};
    const timeoutMs = (node.config.timeout_ms as number) || 5_000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          run_id: ctx.runId,
          tenant_id: ctx.tenantId,
          payload: ctx.triggerPayload,
          node_outputs: ctx.nodeOutputs,
          is_sandbox: ctx.isSandbox,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      return { status: res.status, ok: res.ok };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  },

  // REST API — generic REST call
  async rest_api(node, ctx) {
    const baseUrl = node.config.base_url as string;
    const endpoint = (node.config.endpoint as string) || '';
    const method = (node.config.method as string) || 'GET';
    const authToken = node.config.auth_token as string | undefined;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...((node.config.default_headers as Record<string, string>) ?? {}),
    };

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      ...(method !== 'GET' ? {
        body: JSON.stringify({ payload: ctx.triggerPayload, node_outputs: ctx.nodeOutputs }),
      } : {}),
    });
    return { status: res.status, ok: res.ok };
  },

  // Slack — send message via Bot API
  async slack(node, _ctx) {
    const botToken = node.config.bot_token as string;
    const channel = node.config.channel as string;
    const text = (node.config.message as string) || `Workflow run ${_ctx.runId}`;

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({ channel, text }),
    });
    return { status: res.status, ok: res.ok };
  },

  // Email — log-based stub (real impl via edge function)
  async email(node, ctx) {
    const to = node.config.to as string;
    const subject = (node.config.subject as string) || 'Workflow Notification';
    console.log(`[WorkflowEngine] Email action: to=${to}, subject=${subject}, run=${ctx.runId}`);
    return { sent: true, to, subject };
  },

  // Marketplace App — stub for sandboxed app invocation
  async marketplace_app(node, ctx) {
    const appId = node.config.app_id as string;
    console.log(`[WorkflowEngine] MarketplaceApp invoked: appId=${appId}, run=${ctx.runId}`);
    return { invoked: true, appId };
  },

  // Internal module — stub
  async internal_module(node, ctx) {
    const moduleId = node.config.module_id as string;
    const operation = node.config.operation as string;
    console.log(`[WorkflowEngine] InternalModule: ${moduleId}.${operation}, run=${ctx.runId}`);
    return { executed: true, moduleId, operation };
  },

  // Event stream — re-emit event via kernel
  async event_stream(node, ctx) {
    const eventType = node.config.event_type as string;
    console.log(`[WorkflowEngine] EventStream emit: ${eventType}, run=${ctx.runId}`);
    return { emitted: true, eventType };
  },
};

// ════════════════════════════════════
// CONDITION EVALUATOR
// ════════════════════════════════════

function evaluateCondition(node: WfCanvasNode, ctx: ExecutionContext): boolean {
  const field = (node.config.field as string) || '';
  const operator = (node.config.operator as string) || '==';
  const value = node.config.value;

  // Resolve field value from trigger payload or node outputs
  const payload = ctx.triggerPayload as Record<string, unknown> | undefined;
  const actualValue = payload?.[field] ?? (ctx.nodeOutputs as Record<string, unknown>)[field];

  switch (operator) {
    case '==': return actualValue == value;
    case '!=': return actualValue != value;
    case '>': return Number(actualValue) > Number(value);
    case '<': return Number(actualValue) < Number(value);
    case '>=': return Number(actualValue) >= Number(value);
    case '<=': return Number(actualValue) <= Number(value);
    case 'contains': return String(actualValue).includes(String(value));
    default: return false;
  }
}

// ════════════════════════════════════
// RETRY HELPER
// ════════════════════════════════════

async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  onRetry?: (attempt: number, err: unknown) => void,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < policy.maxRetries) {
        const delay = Math.min(
          policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt),
          policy.maxDelayMs,
        );
        onRetry?.(attempt + 1, err);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ════════════════════════════════════
// TOPOLOGICAL SORT
// ════════════════════════════════════

function topoSort(nodes: WfCanvasNode[], edges: WfCanvasEdge[]): string[] {
  const inDeg: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  for (const n of nodes) {
    inDeg[n.id] = 0;
    adj[n.id] = [];
  }
  for (const e of edges) {
    adj[e.sourceId]?.push(e.targetId);
    inDeg[e.targetId] = (inDeg[e.targetId] ?? 0) + 1;
  }

  const queue = Object.keys(inDeg).filter(k => inDeg[k] === 0);
  const order: string[] = [];
  while (queue.length) {
    const curr = queue.shift()!;
    order.push(curr);
    for (const next of adj[curr] ?? []) {
      inDeg[next]--;
      if (inDeg[next] === 0) queue.push(next);
    }
  }
  return order;
}

// ════════════════════════════════════
// WORKFLOW EXECUTION ENGINE
// ════════════════════════════════════

export class WorkflowExecutionEngine {
  private retryPolicy: RetryPolicy;
  private activeRuns = new Map<string, WorkflowRun>();

  constructor(retryPolicy?: Partial<RetryPolicy>) {
    this.retryPolicy = { ...DEFAULT_RETRY_POLICY, ...retryPolicy };
  }

  /** Start an async workflow run. Returns immediately with run ID. */
  async executeWorkflow(params: {
    workflowId: string;
    tenantId: string;
    nodes: WfCanvasNode[];
    edges: WfCanvasEdge[];
    trigger: EventTriggerDef;
    triggerPayload: unknown;
    isSandbox?: boolean;
  }): Promise<WorkflowRun> {
    const runId = crypto.randomUUID();

    const run: WorkflowRun = {
      id: runId,
      workflowId: params.workflowId,
      tenantId: params.tenantId,
      status: 'pending',
      triggerEvent: params.trigger.eventType,
      triggerPayload: params.triggerPayload,
      nodeExecutions: params.nodes.map(n => ({
        nodeId: n.id,
        nodeLabel: n.label,
        nodeCategory: n.category,
        status: 'pending' as NodeExecStatus,
        input: null,
        output: null,
        retryCount: 0,
      })),
      startedAt: new Date().toISOString(),
      retryAttempt: 0,
      maxRetries: this.retryPolicy.maxRetries,
      metadata: { isSandbox: params.isSandbox ?? false },
    };

    this.activeRuns.set(runId, run);

    // Fire-and-forget async execution (multi-tenant isolated)
    this._runAsync(run, params.nodes, params.edges, params.isSandbox ?? false)
      .catch(err => {
        run.status = 'failed';
        run.error = String(err);
        run.completedAt = new Date().toISOString();
      });

    return run;
  }

  /** Get a run's current state. */
  getRun(runId: string): WorkflowRun | undefined {
    return this.activeRuns.get(runId);
  }

  /** Cancel a running workflow. */
  cancelRun(runId: string): boolean {
    const run = this.activeRuns.get(runId);
    if (!run || run.status !== 'running') return false;
    run.status = 'cancelled';
    run.completedAt = new Date().toISOString();
    return true;
  }

  /** Get all active runs for a tenant (multi-tenant isolation). */
  getRunsByTenant(tenantId: string): WorkflowRun[] {
    return Array.from(this.activeRuns.values()).filter(r => r.tenantId === tenantId);
  }

  // ── Internal Execution ──

  private async _runAsync(
    run: WorkflowRun,
    nodes: WfCanvasNode[],
    edges: WfCanvasEdge[],
    isSandbox: boolean,
  ) {
    run.status = 'running';

    const ctx: ExecutionContext = {
      tenantId: run.tenantId,
      runId: run.id,
      nodeOutputs: {},
      triggerPayload: run.triggerPayload,
      isSandbox,
    };

    const executionOrder = topoSort(nodes, edges);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const edgesBySource = new Map<string, WfCanvasEdge[]>();
    for (const e of edges) {
      const arr = edgesBySource.get(e.sourceId) ?? [];
      arr.push(e);
      edgesBySource.set(e.sourceId, arr);
    }

    const skippedNodes = new Set<string>();

    for (const nodeId of executionOrder) {
      if ((run.status as RunStatus) === 'cancelled') break;

      const node = nodeMap.get(nodeId);
      if (!node) continue;
      if (skippedNodes.has(nodeId)) continue;

      const nodeExec = run.nodeExecutions.find(ne => ne.nodeId === nodeId);
      if (!nodeExec) continue;

      nodeExec.status = 'running';
      nodeExec.startedAt = new Date().toISOString();
      nodeExec.input = node.category === 'trigger' ? run.triggerPayload : ctx.nodeOutputs;

      const startTime = Date.now();

      try {
        if (node.category === 'trigger') {
          // Triggers just pass through the payload
          nodeExec.output = run.triggerPayload;
          nodeExec.status = 'succeeded';
        } else if (node.category === 'condition') {
          const result = evaluateCondition(node, ctx);
          nodeExec.output = { conditionResult: result };
          nodeExec.status = 'succeeded';

          // Skip nodes on the non-matching branch
          const outEdges = edgesBySource.get(nodeId) ?? [];
          for (const edge of outEdges) {
            const shouldSkip =
              (result && edge.edgeType === 'condition_false') ||
              (!result && edge.edgeType === 'condition_true') ||
              (result && edge.edgeType === 'failure') ||
              (!result && edge.edgeType === 'success');

            if (shouldSkip) {
              this._markSubtreeSkipped(edge.targetId, edgesBySource, skippedNodes);
            }
          }
        } else {
          // Action node — execute with retry
          const connectorType = (node.config.connector_type as ConnectorType) || node.templateKey;
          const handler = ACTION_HANDLERS[connectorType] ?? ACTION_HANDLERS['internal_module'];

          const output = await withRetry(
            () => handler(node, ctx),
            this.retryPolicy,
            (attempt) => {
              nodeExec.retryCount = attempt;
              run.status = 'retrying';
            },
          );

          nodeExec.output = output;
          nodeExec.status = 'succeeded';
          ctx.nodeOutputs[nodeId] = output;
          run.status = 'running';
        }
      } catch (err) {
        nodeExec.status = 'failed';
        nodeExec.error = String(err);
        run.status = 'failed';
        run.error = `Node "${node.label}" failed: ${err}`;
        break;
      } finally {
        nodeExec.durationMs = Date.now() - startTime;
        nodeExec.completedAt = new Date().toISOString();
      }
    }

    if (run.status === 'running') {
      run.status = 'completed';
    }
    run.completedAt = new Date().toISOString();
  }

  /** Recursively mark downstream nodes as skipped (for condition branching). */
  private _markSubtreeSkipped(
    nodeId: string,
    edgesBySource: Map<string, WfCanvasEdge[]>,
    skippedNodes: Set<string>,
  ) {
    if (skippedNodes.has(nodeId)) return;
    skippedNodes.add(nodeId);
    for (const edge of edgesBySource.get(nodeId) ?? []) {
      this._markSubtreeSkipped(edge.targetId, edgesBySource, skippedNodes);
    }
  }
}

/** Singleton default engine instance */
export const workflowEngine = new WorkflowExecutionEngine();
