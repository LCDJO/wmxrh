/**
 * Module Monitoring — Health status per federated module.
 *
 * Displays a table of ALL registered modules from the ModuleRegistry
 * with: module_id, status (healthy|degraded|offline), last_event, active_tenants_count
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getHealthMonitor } from '@/domains/observability/health-monitor';
import type { PlatformHealthSummary, ModuleHealthReport, HealthStatus } from '@/domains/observability/types';
import type { ModuleDescriptor, ModuleStatus } from '@/domains/platform-os/types';
import {
  Server, CheckCircle2, XCircle, MinusCircle, Heart, RefreshCw, Clock, Zap, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Status mapping: ModuleStatus → visual config ────────────────

type DisplayStatus = 'online' | 'degraded' | 'offline';

function resolveDisplayStatus(modStatus: ModuleStatus, healthStatus?: HealthStatus): DisplayStatus {
  if (modStatus === 'error' || modStatus === 'suspended') return 'offline';
  if (healthStatus === 'down') return 'offline';
  if (healthStatus === 'degraded' || modStatus === 'activating') return 'degraded';
  if (modStatus === 'active' || modStatus === 'registered') return 'online';
  return 'offline';
}

const displayStatusConfig: Record<DisplayStatus, { label: string; color: string; bg: string; icon: typeof Heart }> = {
  online:   { label: 'Online',   color: 'text-emerald-500',         bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  degraded: { label: 'Degraded', color: 'text-[hsl(38_92%_40%)]',   bg: 'bg-[hsl(38_92%_50%)]/10', icon: MinusCircle },
  offline:  { label: 'Offline',  color: 'text-destructive',         bg: 'bg-destructive/10', icon: XCircle },
};

const healthStatusConfig: Record<HealthStatus, { label: string; color: string; bg: string; icon: typeof Heart }> = {
  healthy:  { label: 'Saudável',      color: 'text-emerald-500',       bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  degraded: { label: 'Degradado',     color: 'text-[hsl(38_92%_40%)]', bg: 'bg-[hsl(38_92%_50%)]/10', icon: MinusCircle },
  down:     { label: 'Indisponível',  color: 'text-destructive',       bg: 'bg-destructive/10', icon: XCircle },
  unknown:  { label: 'Desconhecido',  color: 'text-muted-foreground',  bg: 'bg-muted', icon: MinusCircle },
};

// ── Helpers ─────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('pt-BR');
}

/** Merge registry descriptors + health data into a single row model */
interface ModuleRow {
  module_id: string;
  label: string;
  displayStatus: DisplayStatus;
  healthStatus: HealthStatus;
  registryStatus: ModuleStatus;
  last_event: number | null;
  active_tenants_count: number;
  latency_ms: number;
  uptime_ms: number;
  error_count_1h: number;
  last_heartbeat: number;
}

function buildRows(
  descriptors: ModuleDescriptor[],
  healthReports: ModuleHealthReport[],
): ModuleRow[] {
  const healthMap = new Map<string, ModuleHealthReport>();
  for (const r of healthReports) healthMap.set(r.module_id, r);

  return descriptors.map(d => {
    const h = healthMap.get(d.key);
    const healthStatus: HealthStatus = h?.status ?? 'unknown';
    const displayStatus = resolveDisplayStatus(d.status, healthStatus);

    // last_event = most recent among activated_at, deactivated_at, registered_at
    const lastEvent = Math.max(
      d.activated_at ?? 0,
      d.deactivated_at ?? 0,
      d.registered_at ?? 0,
    ) || null;

    return {
      module_id: d.key,
      label: d.label,
      displayStatus,
      healthStatus,
      registryStatus: d.status,
      last_event: lastEvent,
      active_tenants_count: d.enabled_tenants?.length ?? 0,
      latency_ms: h?.latency_ms ?? 0,
      uptime_ms: h?.uptime_ms ?? 0,
      error_count_1h: h?.error_count_1h ?? 0,
      last_heartbeat: h?.last_heartbeat ?? 0,
    };
  });
}

// ── Demo seed (only when no real modules registered) ────────────

const DEMO_MODULES: Array<{ key: string; label: string }> = [
  { key: 'core_hr', label: 'HR Core' },
  { key: 'compensation', label: 'Compensation' },
  { key: 'benefits', label: 'Benefits' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'health', label: 'Saúde Ocupacional' },
  { key: 'esocial', label: 'eSocial' },
  { key: 'payroll_sim', label: 'Simulação Folha' },
  { key: 'iam', label: 'IAM' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'observability', label: 'Observability' },
  { key: 'workforce_intel', label: 'Inteligência' },
  { key: 'labor_rules', label: 'Regras Trabalhistas' },
];

function ensureDemoData() {
  const monitor = getHealthMonitor();
  const summary = monitor.getSummary();
  if (summary.total_modules > 0) return;

  DEMO_MODULES.forEach(m => {
    monitor.registerModule(m.key, m.label);
    monitor.heartbeat(m.key, Math.random() * 120);
  });
  // Mark one as degraded for visual demo
  monitor.setStatus('compensation', 'degraded');
}

// ── Component ───────────────────────────────────────────────────

export default function ModuleMonitoringPanel() {
  const [health, setHealth] = useState<PlatformHealthSummary | null>(null);
  const [rows, setRows] = useState<ModuleRow[]>([]);

  const refresh = useCallback(() => {
    ensureDemoData();
    const monitor = getHealthMonitor();
    const summary = monitor.getSummary();
    setHealth(summary);

    // Build descriptors from health reports (real registries would come from PlatformCore)
    const descriptors: ModuleDescriptor[] = summary.modules.map(m => ({
      key: m.module_id,
      label: m.module_label,
      status: (m.status === 'healthy' ? 'active' : m.status === 'degraded' ? 'active' : 'error') as ModuleStatus,
      version: '1.0.0',
      routes: [],
      required_permissions: [],
      dependencies: [],
      cognitive_signals: [],
      registered_at: Date.now() - m.uptime_ms,
      activated_at: Date.now() - m.uptime_ms + 50,
      deactivated_at: null,
      enabled_tenants: [],
      disabled_tenants: [],
      is_core: false,
      lazy: false,
    }));

    setRows(buildRows(descriptors, summary.modules));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    const unsub = getHealthMonitor().onUpdate(() => refresh());
    return () => { clearInterval(interval); unsub(); };
  }, [refresh]);

  if (!health) return null;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-bold text-foreground">{health.total_modules}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">{health.healthy_count}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Online</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-bold text-[hsl(38_92%_40%)]">{health.degraded_count}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Degraded</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-bold text-destructive">{health.down_count}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Offline</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Módulos Registrados</h2>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {/* ── Module Registry Table ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            Module Health Service
          </CardTitle>
          <CardDescription>
            Todos os módulos registrados no ModuleRegistry com status em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Módulo</TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead className="w-[120px]">Último Evento</TableHead>
                <TableHead className="w-[100px] text-right">Tenants Ativos</TableHead>
                <TableHead className="w-[90px] text-right">Latência</TableHead>
                <TableHead className="w-[90px] text-right">Erros/1h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => {
                const cfg = displayStatusConfig[row.displayStatus];
                const Icon = cfg.icon;
                return (
                  <TableRow key={row.module_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{row.label}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{row.module_id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', cfg.bg)}>
                        <Icon className={cn('h-3 w-3', cfg.color)} />
                        <span className={cfg.color}>{cfg.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(row.last_event)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-medium text-foreground">
                        {row.active_tenants_count || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-mono text-foreground">{row.latency_ms}ms</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn('text-xs font-mono', row.error_count_1h > 0 ? 'text-destructive' : 'text-foreground')}>
                        {row.error_count_1h}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Detail cards grid ──────────────────────────────────── */}
      <h2 className="text-sm font-medium text-foreground">Detalhes por Módulo</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {health.modules.map(mod => {
          const cfg = healthStatusConfig[mod.status];
          const Icon = cfg.icon;
          const healthPct = mod.status === 'healthy' ? 100 : mod.status === 'degraded' ? 50 : 0;

          return (
            <Card key={mod.module_id}>
              <CardContent className="pt-5 pb-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{mod.module_label}</span>
                  </div>
                  <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg)}>
                    <Icon className={cn('h-3 w-3', cfg.color)} />
                    <span className={cfg.color}>{cfg.label}</span>
                  </div>
                </div>

                {/* Health bar */}
                <Progress value={healthPct} className="h-1.5" />

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{mod.latency_ms}ms</p>
                      <p className="text-[9px] text-muted-foreground">Latência</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{formatUptime(mod.uptime_ms)}</p>
                      <p className="text-[9px] text-muted-foreground">Uptime</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{mod.error_count_1h}</p>
                      <p className="text-[9px] text-muted-foreground">Erros/1h</p>
                    </div>
                  </div>
                </div>

                {/* Last heartbeat */}
                <p className="text-[10px] text-muted-foreground">
                  Último heartbeat: {new Date(mod.last_heartbeat).toLocaleTimeString('pt-BR')}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
