/**
 * PlatformAutomation — Automation Rule Engine page for Platform Admin.
 */
import { useTenant } from '@/contexts/TenantContext';
import { AutomationRulesPanel } from '@/components/automation/AutomationRulesPanel';

export default function PlatformAutomation() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? 'global';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Automação</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Motor de regras low-code para automação da plataforma.
        </p>
      </div>
      <AutomationRulesPanel tenantId={tenantId} />
    </div>
  );
}
