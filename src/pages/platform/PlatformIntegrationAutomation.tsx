/**
 * PlatformIntegrationAutomation — iPaaS Workflows hub with tabs for
 * Workflows, Templates, Execution Logs, and Sandbox Tests.
 */
import { useState } from 'react';
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Workflow, LayoutTemplate, ScrollText, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkflowDesigner } from '@/components/integration-automation/workflow-designer/WorkflowDesigner';
import { NodeLibraryPanel } from '@/components/integration-automation/workflow-designer/NodeLibraryPanel';
import { ExecutionTimeline } from '@/components/integration-automation/workflow-designer/ExecutionTimeline';
import { WorkflowTemplates } from '@/components/integration-automation/workflow-designer/WorkflowTemplates';
import { SandboxTestPanel } from '@/components/integration-automation/workflow-designer/SandboxTestPanel';
import type { WorkflowRun } from '@/components/integration-automation/workflow-designer/execution-engine';
import type { SandboxRunResult } from '@/components/integration-automation/workflow-designer/sandbox-runner';

const TABS = [
  { path: '', label: 'Workflows', icon: Workflow },
  { path: 'templates', label: 'Templates', icon: LayoutTemplate },
  { path: 'executions', label: 'Execution Logs', icon: ScrollText },
  { path: 'sandbox', label: 'Sandbox Tests', icon: Shield },
] as const;

function WorkflowsTab({ tenantId }: { tenantId: string }) {
  return (
    <div className="grid grid-cols-[320px_1fr] gap-4 h-[calc(100vh-240px)]">
      <NodeLibraryPanel />
      <WorkflowDesigner tenantId={tenantId} />
    </div>
  );
}

function ExecutionsTab() {
  const [runs] = useState<WorkflowRun[]>([]);
  return <ExecutionTimeline runs={runs} />;
}

function SandboxTab({ tenantId }: { tenantId: string }) {
  const [sandboxRuns] = useState<SandboxRunResult[]>([]);
  return <SandboxTestPanel tenantId={tenantId} sandboxRuns={sandboxRuns} />;
}

export default function PlatformIntegrationAutomation() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? 'global';
  const location = useLocation();

  // Determine active tab from pathname
  const basePath = '/platform/integration-automation';
  const subPath = location.pathname.replace(basePath, '').replace(/^\//, '');
  const activeTab = TABS.find(t => t.path === subPath)?.path ?? '';

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Integration Automation Engine</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crie e gerencie fluxos automatizados entre módulos, APIs e eventos do sistema.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map(tab => {
          const isActive = activeTab === tab.path;
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path ? `${basePath}/${tab.path}` : basePath}
              end={tab.path === ''}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-[1px] transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </NavLink>
          );
        })}
      </div>

      {/* Tab Content */}
      <Routes>
        <Route index element={<WorkflowsTab tenantId={tenantId} />} />
        <Route path="templates" element={<WorkflowTemplates />} />
        <Route path="executions" element={<ExecutionsTab />} />
        <Route path="sandbox" element={<SandboxTab tenantId={tenantId} />} />
      </Routes>
    </div>
  );
}
