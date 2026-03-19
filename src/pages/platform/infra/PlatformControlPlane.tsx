/**
 * ControlPlaneDashboard — Master panel for the Autonomous Platform Control Plane.
 * Renders 5 dedicated widgets in a unified dashboard layout.
 */
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Activity, Shield, Cpu, Users, Zap, Trash2, TrendingUp, Globe, Megaphone, ServerCrash,
} from 'lucide-react';
import { getPlatformRuntime } from '@/domains/platform-os/platform-runtime';
import { getControlPlaneEngine } from '@/domains/control-plane/control-plane-engine';
import type {
  PlatformStateSnapshot,
  RiskSummary,
  ModuleControlInfo,
  IdentityControlSummary,
  AutomationRule,
  ControlAction,
} from '@/domains/control-plane/types';

// ── Widgets ──────────────────────────────────────────────────
import { SystemStatusOverview } from '@/components/control-plane/SystemStatusOverview';
import { ActiveIncidentsPanel } from '@/components/control-plane/ActiveIncidentsPanel';
import { RiskHeatmap } from '@/components/control-plane/RiskHeatmap';
import { ModuleHealthGrid } from '@/components/control-plane/ModuleHealthGrid';
import { IdentityActivityFeed } from '@/components/control-plane/IdentityActivityFeed';
import { GrowthControlCenter } from '@/components/control-plane/GrowthControlCenter';
import { WebsiteControlCenter } from '@/components/control-plane/WebsiteControlCenter';
import { MarketingControlCenter } from '@/components/control-plane/MarketingControlCenter';
import { ActivePlatformVersionWidget } from '@/components/control-plane/ActivePlatformVersionWidget';
import { ModuleHealthByVersionWidget } from '@/components/control-plane/ModuleHealthByVersionWidget';
import { NavigationStructureStatusWidget } from '@/components/control-plane/NavigationStructureStatusWidget';
import { SupportHealthOverview } from '@/components/control-plane/SupportHealthOverview';
import { ApiTrafficMonitorWidget } from '@/components/control-plane/ApiTrafficMonitorWidget';
import { MarketplaceHealthWidget } from '@/components/control-plane/MarketplaceHealthWidget';
import { AutomationSystemHealthWidget } from '@/components/control-plane/AutomationSystemHealthWidget';
import { AutonomousOpsWidget } from '@/components/control-plane/AutonomousOpsWidget';
import { AIOperationsCenterWidget } from '@/components/control-plane/AIOperationsCenterWidget';
import { IncidentCommandCenter } from '@/components/control-plane/IncidentCommandCenter';
import { BCDRCommandCenter } from '@/components/control-plane/BCDRCommandCenter';
// ── Hook ──────────────────────────────────────────────────────

function useControlPlane() {
  const runtime = getPlatformRuntime();
  const engine = getControlPlaneEngine(runtime);

  const [state, setState] = useState<PlatformStateSnapshot | null>(null);
  const [risk, setRisk] = useState<RiskSummary | null>(null);
  const [modules, setModules] = useState<ModuleControlInfo[]>([]);
  const [identity, setIdentity] = useState<IdentityControlSummary | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);

  const refresh = () => {
    setState(engine.getState());
    setRisk(engine.getRiskSummary());
    setModules(engine.getModuleControl());
    setIdentity(engine.getIdentityControl());
    setRules(engine.listRules());
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, []);

  const executeAction = (action: ControlAction) => {
    engine.execute(action);
    setTimeout(refresh, 500);
  };

  const toggleRule = (ruleId: string, enabled: boolean) => {
    engine.toggleRule(ruleId, enabled);
    setRules(engine.listRules());
  };

  const removeRule = (ruleId: string) => {
    engine.removeRule(ruleId);
    setRules(engine.listRules());
  };

  return { state, risk, modules, identity, rules, refresh, executeAction, toggleRule, removeRule };
}

// ── Automation Panel (kept inline — small) ────────────────────

function AutomationPanel({ rules, onToggle, onRemove }: { rules: AutomationRule[]; onToggle: (id: string, enabled: boolean) => void; onRemove: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <CardDescription>{rules.length} regra(s) configurada(s)</CardDescription>
      {rules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma regra de automação configurada.
          <br />
          <span className="text-xs">Regras podem ser adicionadas via ControlPlaneEngine.addRule()</span>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {rules.map(rule => (
              <Card key={rule.id} className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{rule.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Trigger: <Badge variant="outline" className="text-[9px] h-4 ml-1">{rule.trigger}</Badge>
                        <span className="mx-2">•</span>
                        {rule.actions.length} ação(ões)
                        <span className="mx-2">•</span>
                        Disparos: {rule.trigger_count}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={rule.enabled} onCheckedChange={(v) => onToggle(rule.id, v)} />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onRemove(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function PlatformControlPlane() {
  const { state, risk, modules, identity, rules, refresh, executeAction, toggleRule, removeRule } = useControlPlane();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Control Plane</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Painel autônomo de governança, operação e controle da plataforma.
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8 max-w-4xl">
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="incidents" className="gap-1.5 text-xs">
            <Shield className="h-3.5 w-3.5" /> Incidentes
          </TabsTrigger>
          <TabsTrigger value="website" className="gap-1.5 text-xs">
            <Globe className="h-3.5 w-3.5" /> Website
          </TabsTrigger>
          <TabsTrigger value="marketing" className="gap-1.5 text-xs">
            <Megaphone className="h-3.5 w-3.5" /> Marketing
          </TabsTrigger>
          <TabsTrigger value="growth" className="gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" /> Growth
          </TabsTrigger>
          <TabsTrigger value="bcdr" className="gap-1.5 text-xs">
            <ServerCrash className="h-3.5 w-3.5" /> BCDR
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" /> Automação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {/* Row 1: System Status (full width) */}
          <SystemStatusOverview state={state} onRefresh={refresh} />

          {/* Row 2: Active Version + Module Health + Nav Structure */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ActivePlatformVersionWidget />
            <ModuleHealthByVersionWidget />
            <NavigationStructureStatusWidget />
          </div>

          {/* Row 3: Incidents + Risk Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ActiveIncidentsPanel state={state} onAction={executeAction} />
            <RiskHeatmap state={state} risk={risk} />
          </div>

          {/* Row 4: Module Health Grid (full width) */}
          <ModuleHealthGrid modules={modules} onAction={executeAction} />

          {/* Row 5: Identity Activity Feed */}
          <IdentityActivityFeed identity={identity} />

          {/* Row 6: Support Health */}
          <SupportHealthOverview />

          {/* Row 7: API Traffic Monitor */}
          <ApiTrafficMonitorWidget />

          {/* Row 8: Marketplace Health */}
          <MarketplaceHealthWidget />

          {/* Row 9: Automation System Health */}
          <AutomationSystemHealthWidget />

          {/* Row 10: AI Operations Center */}
          <AIOperationsCenterWidget />

          {/* Row 11: Autonomous Operations AI (detailed) */}
          <AutonomousOpsWidget />
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          <IncidentCommandCenter />
        </TabsContent>

        <TabsContent value="website" className="space-y-4">
          <WebsiteControlCenter />
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4">
          <MarketingControlCenter />
        </TabsContent>

        <TabsContent value="growth" className="space-y-4">
          <GrowthControlCenter />
        </TabsContent>

        <TabsContent value="bcdr" className="space-y-4">
          <BCDRCommandCenter />
        </TabsContent>

        <TabsContent value="automation">
          <AutomationPanel rules={rules} onToggle={toggleRule} onRemove={removeRule} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
