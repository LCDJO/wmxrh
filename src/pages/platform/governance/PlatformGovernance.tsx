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
import { Eye, ShieldCheck, Brain, HelpCircle } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
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
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Governança</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Auditoria visual, compliance automatizado e análise preditiva de risco.
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" aria-label="Ajuda sobre Governança">
                <HelpCircle className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-sm space-y-2" side="bottom" align="start">
              <p className="font-semibold text-foreground">Sobre esta Dashboard</p>
              <p className="text-muted-foreground leading-relaxed">
                A Dashboard de Governança centraliza ferramentas para garantir conformidade, segurança e transparência na gestão do seu ambiente.
              </p>
              <ul className="text-muted-foreground space-y-1 list-disc pl-4 text-xs leading-relaxed">
                <li><strong>Auditoria Visual:</strong> Capture snapshots do grafo de permissões e compare alterações ao longo do tempo com análise de IA.</li>
                <li><strong>Compliance:</strong> Configure regras automáticas de conformidade e receba alertas e remediações inteligentes.</li>
                <li><strong>Risco Preditivo:</strong> Visualize tendências de risco e utilize previsões de IA para agir preventivamente.</li>
              </ul>
            </PopoverContent>
          </Popover>
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
