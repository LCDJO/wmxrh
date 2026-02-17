/**
 * PlatformGovernance — Unified governance panel for Platform Admin.
 *
 * Integrates:
 * - Visual Audit Dashboard (UGE snapshot capture + comparison)
 * - Compliance Automation (rule engine + AI remediation)
 * - Predictive Risk Analysis (trend charts + AI forecasting)
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, ShieldCheck, Brain } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { GovernanceAuditDashboard } from '@/components/governance/GovernanceAuditDashboard';
import { ComplianceAutomationPanel } from '@/components/governance/ComplianceAutomationPanel';
import { PredictiveRiskAnalysis } from '@/components/governance/PredictiveRiskAnalysis';
import { RiskIndicatorBadge } from '@/components/iam/RiskIndicatorBadge';

export default function PlatformGovernance() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? 'global';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Governança</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auditoria visual, compliance automatizado e análise preditiva de risco.
          </p>
        </div>
        <RiskIndicatorBadge />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="audit" className="gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" />
            Auditoria Visual
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-1.5 text-xs">
            <Brain className="h-3.5 w-3.5" />
            Risco Preditivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <GovernanceAuditDashboard tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceAutomationPanel tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="risk">
          <PredictiveRiskAnalysis tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
