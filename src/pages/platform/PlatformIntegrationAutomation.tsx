/**
 * PlatformIntegrationAutomation — Integration Automation Engine page.
 * Visual Workflow Designer for the SaaS platform.
 */
import { useTenant } from '@/contexts/TenantContext';
import { WorkflowDesigner } from '@/components/integration-automation/workflow-designer/WorkflowDesigner';

export default function PlatformIntegrationAutomation() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? 'global';

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Integration Automation Engine</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crie fluxos automatizados entre módulos internos, APIs externas, apps do Marketplace e eventos do sistema.
        </p>
      </div>
      <WorkflowDesigner tenantId={tenantId} />
    </div>
  );
}
