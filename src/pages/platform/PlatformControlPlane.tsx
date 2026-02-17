/**
 * ControlPlaneDashboard — Master panel for the Autonomous Platform Control Plane.
 */
import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Activity, Shield, Cpu, Users, AlertTriangle, Zap,
  Play, Square, RefreshCw, ToggleLeft, Trash2, CheckCircle2,
  XCircle, Clock, TrendingUp, TrendingDown, Minus,
  Server, Brain, Eye,
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

// ── Health Badge ──────────────────────────────────────────────

function HealthBadge({ health }: { health: string }) {
  const variant = health === 'healthy' ? 'default' : health === 'degraded' ? 'secondary' : 'destructive';
  const icon = health === 'healthy' ? <CheckCircle2 className="h-3 w-3" /> : health === 'degraded' ? <AlertTriangle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />;
  return (
    <Badge variant={variant} className="gap-1">
      {icon} {health.toUpperCase()}
    </Badge>
  );
}

// ── State Overview Tab ────────────────────────────────────────

function StateOverview({ state, onRefresh }: { state: PlatformStateSnapshot | null; onRefresh: () => void }) {
  if (!state) return <div className="text-muted-foreground text-sm">Carregando estado...</div>;

  const uptimeStr = state.uptime_ms > 0
    ? `${Math.floor(state.uptime_ms / 60000)}m ${Math.floor((state.uptime_ms % 60000) / 1000)}s`
    : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HealthBadge health={state.health} />
          <span className="text-xs text-muted-foreground">Fase: {state.runtime_phase}</span>
          <span className="text-xs text-muted-foreground">Uptime: {uptimeStr}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={<Server className="h-4 w-4" />} label="Serviços" value={state.total_services} />
        <MetricCard icon={<Cpu className="h-4 w-4" />} label="Módulos Ativos" value={`${state.active_modules}/${state.total_modules}`} accent={state.error_modules > 0 ? 'destructive' : undefined} />
        <MetricCard icon={<Zap className="h-4 w-4" />} label="Features Ativas" value={`${state.active_features}/${state.total_features}`} />
        <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Erros (1h)" value={state.total_errors_last_hour} accent={state.total_errors_last_hour > 10 ? 'destructive' : undefined} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={<Activity className="h-4 w-4" />} label="Incidentes" value={state.active_incidents} />
        <MetricCard icon={<Shield className="h-4 w-4" />} label="Circuits Abertos" value={state.open_circuit_breakers} accent={state.open_circuit_breakers > 0 ? 'destructive' : undefined} />
        <MetricCard icon={<Users className="h-4 w-4" />} label="Sessões" value={state.active_sessions_estimate} />
        <MetricCard icon={<Eye className="h-4 w-4" />} label="Impersonações" value={state.active_impersonations} accent={state.active_impersonations > 0 ? 'secondary' : undefined} />
      </div>

      {/* Subsystem Health */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Saúde dos Subsistemas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {state.subsystem_health.map(sub => (
              <div key={sub.name} className="flex items-center gap-2 text-xs p-2 rounded-md border border-border/50">
                <div className={`h-2 w-2 rounded-full ${sub.status === 'ok' ? 'bg-green-500' : sub.status === 'warn' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                <span className="truncate font-medium">{sub.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Risk Tab ──────────────────────────────────────────────────

function RiskPanel({ risk }: { risk: RiskSummary | null }) {
  if (!risk) return <div className="text-muted-foreground text-sm">Carregando riscos...</div>;

  const trendIcon = risk.trend === 'improving' ? <TrendingDown className="h-4 w-4 text-green-500" /> : risk.trend === 'worsening' ? <TrendingUp className="h-4 w-4 text-red-500" /> : <Minus className="h-4 w-4 text-muted-foreground" />;

  const riskColor = risk.level === 'critical' ? 'text-red-500' : risk.level === 'high' ? 'text-orange-500' : risk.level === 'medium' ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className={`text-4xl font-bold ${riskColor}`}>{risk.overall_score}</div>
          <div className="text-xs text-muted-foreground">Risk Score</div>
        </div>
        <div className="flex items-center gap-2">
          {trendIcon}
          <span className="text-sm capitalize">{risk.trend}</span>
        </div>
        <Badge variant={risk.level === 'critical' || risk.level === 'high' ? 'destructive' : 'secondary'}>
          {risk.level.toUpperCase()}
        </Badge>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {risk.top_risks.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhum risco identificado ✓</div>
          )}
          {risk.top_risks.map(item => (
            <Card key={item.id} className="border-border/50">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                      <span className="font-medium text-sm truncate">{item.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                    {item.suggested_action && (
                      <p className="text-xs text-primary mt-1">💡 {item.suggested_action}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-bold ${item.score > 60 ? 'text-red-500' : item.score > 30 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {item.score}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Modules Tab ───────────────────────────────────────────────

function ModulesPanel({ modules, onAction }: { modules: ModuleControlInfo[]; onAction: (a: ControlAction) => void }) {
  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2">
        {modules.map(mod => {
          const statusColor = mod.status === 'active' ? 'bg-green-500' : mod.status === 'error' ? 'bg-red-500' : mod.status === 'suspended' ? 'bg-yellow-500' : 'bg-muted';
          return (
            <Card key={mod.key} className="border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColor}`} />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{mod.label}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <span>v{mod.version}</span>
                        {mod.is_core && <Badge variant="outline" className="text-[9px] h-4">CORE</Badge>}
                        {mod.circuit_breaker_state === 'open' && <Badge variant="destructive" className="text-[9px] h-4">CIRCUIT OPEN</Badge>}
                        {mod.error_count_last_hour > 0 && <span className="text-red-500">{mod.error_count_last_hour} erros</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {mod.status === 'active' && !mod.is_core && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAction({ type: 'restart_module', module_key: mod.key })}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Restart
                      </Button>
                    )}
                    {mod.status === 'error' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAction({ type: 'clear_circuit_breaker', module_key: mod.key })}>
                        <Play className="h-3 w-3 mr-1" /> Reset
                      </Button>
                    )}
                    {mod.status !== 'active' && mod.status !== 'error' && !mod.is_core && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAction({ type: 'activate_module', module_key: mod.key })}>
                        <Play className="h-3 w-3 mr-1" /> Ativar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ── Identity Tab ──────────────────────────────────────────────

function IdentityPanel({ identity }: { identity: IdentityControlSummary | null }) {
  if (!identity) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard icon={<Users className="h-4 w-4" />} label="Usuários Ativos" value={identity.total_active_users_estimate} />
        <MetricCard icon={<Eye className="h-4 w-4" />} label="Impersonações" value={identity.active_impersonations} accent={identity.active_impersonations > 0 ? 'secondary' : undefined} />
        <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Alto Risco" value={identity.high_risk_users} accent={identity.high_risk_users > 0 ? 'destructive' : undefined} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Eventos Recentes de Identidade</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {identity.recent_identity_events.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">Nenhum evento recente</div>
            ) : (
              <div className="space-y-1">
                {identity.recent_identity_events.slice().reverse().map((evt, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded border border-border/30">
                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{new Date(evt.timestamp).toLocaleTimeString('pt-BR')}</span>
                    <Badge variant="outline" className="text-[9px] h-4">{evt.type}</Badge>
                    <span className="truncate">{evt.details}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Automation Tab ────────────────────────────────────────────

function AutomationPanel({ rules, onToggle, onRemove }: { rules: AutomationRule[]; onToggle: (id: string, enabled: boolean) => void; onRemove: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardDescription>{rules.length} regra(s) configurada(s)</CardDescription>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma regra de automação configurada.
          <br />
          <span className="text-xs">Regras podem ser adicionadas programaticamente via ControlPlaneEngine.addRule()</span>
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

// ── Metric Card ───────────────────────────────────────────────

function MetricCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: 'destructive' | 'secondary' }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <div className={`text-lg font-bold ${accent === 'destructive' ? 'text-destructive' : accent === 'secondary' ? 'text-yellow-500' : ''}`}>
            {value}
          </div>
          <div className="text-[10px] text-muted-foreground leading-none">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function PlatformControlPlane() {
  const { state, risk, modules, identity, rules, refresh, executeAction, toggleRule, removeRule } = useControlPlane();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Control Plane</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Painel autônomo de governança, operação e controle da plataforma.
          </p>
        </div>
        {state && <HealthBadge health={state.health} />}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-1.5 text-xs">
            <Shield className="h-3.5 w-3.5" />
            Risco
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-1.5 text-xs">
            <Cpu className="h-3.5 w-3.5" />
            Módulos
          </TabsTrigger>
          <TabsTrigger value="identity" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            Identidade
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" />
            Automação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <StateOverview state={state} onRefresh={refresh} />
        </TabsContent>

        <TabsContent value="risk">
          <RiskPanel risk={risk} />
        </TabsContent>

        <TabsContent value="modules">
          <ModulesPanel modules={modules} onAction={executeAction} />
        </TabsContent>

        <TabsContent value="identity">
          <IdentityPanel identity={identity} />
        </TabsContent>

        <TabsContent value="automation">
          <AutomationPanel rules={rules} onToggle={toggleRule} onRemove={removeRule} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
