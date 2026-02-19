/**
 * Integration Automation — Domain Events for Global Event Kernel.
 */

export const AUTOMATION_KERNEL_EVENTS = {
  WorkflowCreated: 'automation:workflow_created',
  WorkflowActivated: 'automation:workflow_activated',
  WorkflowExecuted: 'automation:workflow_executed',
  WorkflowFailed: 'automation:workflow_failed',
  WorkflowVersionPublished: 'automation:workflow_version_published',
} as const;

export type AutomationKernelEvent = typeof AUTOMATION_KERNEL_EVENTS[keyof typeof AUTOMATION_KERNEL_EVENTS];

// ── Payload types ───────────────────────────────────────────────

export interface WorkflowCreatedPayload {
  workflow_id: string;
  tenant_id: string;
  name: string;
  created_by?: string;
}

export interface WorkflowActivatedPayload {
  workflow_id: string;
  tenant_id: string;
  name: string;
  activated_by?: string;
}

export interface WorkflowExecutedPayload {
  run_id: string;
  workflow_id: string;
  tenant_id: string;
  trigger_event: string;
  duration_ms: number;
  nodes_executed: number;
  status: 'completed';
}

export interface WorkflowFailedPayload {
  run_id: string;
  workflow_id: string;
  tenant_id: string;
  trigger_event: string;
  error: string;
  failed_node_id?: string;
  retry_count: number;
}

export interface WorkflowVersionPublishedPayload {
  workflow_id: string;
  version_id: string;
  version_tag: string;
  tenant_id: string;
  published_by?: string;
}

// ── Domain Catalog (auto-discovered by Event Catalog UI) ────────

export const __DOMAIN_CATALOG = {
  domain: 'Integration Automation',
  color: 'hsl(260 55% 52%)',
  events: [
    { name: 'WorkflowCreated', description: 'Novo workflow criado no iPaaS engine' },
    { name: 'WorkflowActivated', description: 'Workflow ativado para execução' },
    { name: 'WorkflowExecuted', description: 'Workflow executado com sucesso' },
    { name: 'WorkflowFailed', description: 'Execução de workflow falhou' },
    { name: 'WorkflowVersionPublished', description: 'Nova versão de workflow publicada' },
  ],
};
