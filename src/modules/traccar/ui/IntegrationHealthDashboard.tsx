/**
 * IntegrationHealthDashboard — SuperAdmin dashboard for Integration Health & Monitoring Engine.
 *
 * Shows health scores per tenant, drill-down per check, metrics, and history.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Loader2, Server, ShieldCheck, Cpu, Radio, Clock, Layers,
  ChevronDown, ChevronUp, Gauge,
} from 'lucide-react';
import {
  getLatestHealthChecks,
  getTenantHealthHistory,
  triggerHealthCheck,
  type HealthCheckResult,
  type CheckResult,
} from '../services/integration-health.service';
import { supabase } from '@/integrations/supabase/client';

const STATUS_CONFIG = {
  healthy: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Saudável', icon: CheckCircle2 },
  degraded: { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Degradado', icon: AlertTriangle },
  critical: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', label: 'Crítico', icon: XCircle },
  unknown: { color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-muted', label: 'Desconhecido', icon: Clock },
} as const;

const CHECK_ICONS: Record<string, typeof Server> = {
  server_connection: Server,
  api_authentication: ShieldCheck,
  device_sync: Cpu,
  event_flow: Radio,
  queue_health: Layers,
  alert_generation: AlertTriangle,
};

const CHECK_LABELS: Record<string, string> = {
  server_connection: 'Conexão Servidor',
  api_authentication: 'Autenticação API',
  device_sync: 'Sincronização Dispositivos',
  event_flow: 'Fluxo de Eventos',
  queue_health: 'Saúde da Fila',
  alert_generation: 'Geração de Alertas',
};

function CheckStatusBadge({ check }: { check: CheckResult }) {
  const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
    pass: 'default',
    fail: 'destructive',
    warn: 'secondary',
    unknown: 'outline',
  };
  const labels: Record<string, string> = { pass: '✓ OK', fail: '✗ Falha', warn: '⚠ Alerta', unknown: '? N/A' };
  return <Badge variant={variants[check.status] || 'outline'} className="text-xs">{labels[check.status] || check.status}</Badge>;
}

export default function IntegrationHealthDashboard() {
  const [checks, setChecks] = useState<HealthCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [history, setHistory] = useState<HealthCheckResult[]>([]);
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLatestHealthChecks();
      setChecks(data);

      // Fetch tenant names
      if (data.length > 0) {
        const ids = data.map(d => d.tenant_id);
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, name')
          .in('id', ids);
        const names: Record<string, string> = {};
        for (const t of (tenants || [])) names[t.id] = t.name;
        setTenantNames(names);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRunAll = async () => {
    setRunning(true);
    try {
      await triggerHealthCheck();
      await fetchData();
    } catch {}
    setRunning(false);
  };

  const handleRunSingle = async (tenantId: string) => {
    setRunning(true);
    try {
      await triggerHealthCheck(tenantId);
      await fetchData();
    } catch {}
    setRunning(false);
  };

  const toggleExpand = async (tenantId: string) => {
    if (expandedTenant === tenantId) {
      setExpandedTenant(null);
      setHistory([]);
    } else {
      setExpandedTenant(tenantId);
      const h = await getTenantHealthHistory(tenantId, 20);
      setHistory(h);
    }
  };

  // Aggregated stats
  const totalTenants = checks.length;
  const healthyCount = checks.filter(c => c.health_status === 'healthy').length;
  const degradedCount = checks.filter(c => c.health_status === 'degraded').length;
  const criticalCount = checks.filter(c => c.health_status === 'critical').length;
  const avgScore = totalTenants > 0 ? Math.round(checks.reduce((s, c) => s + c.health_score, 0) / totalTenants) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6" /> Integration Health Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitoramento automático da integração Traccar por tenant
          </p>
        </div>
        <Button onClick={handleRunAll} disabled={running} className="gap-1.5">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Verificar Todos
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{totalTenants}</div>
            <div className="text-xs text-muted-foreground mt-1">Tenants Monitorados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-emerald-500">{healthyCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Saudáveis</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-500">{degradedCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Degradados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-destructive">{criticalCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Críticos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Gauge className="h-5 w-5 text-muted-foreground" />
              <span className="text-3xl font-bold">{avgScore}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Score Médio</div>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saúde por Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : checks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum tenant com integração Traccar encontrado. Execute uma verificação.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Dispositivos</TableHead>
                    <TableHead>Eventos (24h)</TableHead>
                    <TableHead>Alertas (24h)</TableHead>
                    <TableHead>Queue Lag</TableHead>
                    <TableHead>Latência</TableHead>
                    <TableHead>Verificado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.map(check => {
                    const cfg = STATUS_CONFIG[check.health_status];
                    const StatusIcon = cfg.icon;
                    const isExpanded = expandedTenant === check.tenant_id;

                    return (
                      <>
                        <TableRow
                          key={check.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleExpand(check.tenant_id)}
                        >
                          <TableCell>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-medium">
                            {tenantNames[check.tenant_id] || check.tenant_id.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1.5 ${cfg.color}`}>
                              <StatusIcon className="h-4 w-4" />
                              <span className="text-xs font-medium">{cfg.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <Progress value={check.health_score} className="h-2 flex-1" />
                              <span className="text-xs font-mono w-8 text-right">{check.health_score}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{check.devices_synced}</TableCell>
                          <TableCell className="text-sm">{check.events_last_24h}</TableCell>
                          <TableCell className="text-sm">{check.alerts_last_24h}</TableCell>
                          <TableCell className="text-sm">
                            <span className={check.queue_lag > 100 ? 'text-destructive font-medium' : ''}>
                              {check.queue_lag}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {check.server_response_time_ms ? `${check.server_response_time_ms}ms` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(check.checked_at).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); handleRunSingle(check.tenant_id); }}
                              disabled={running}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Detail */}
                        {isExpanded && (
                          <TableRow key={`${check.id}-detail`}>
                            <TableCell colSpan={11} className="bg-muted/20 p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Individual Checks */}
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold mb-3">Testes de Saúde</h4>
                                  {Object.entries(CHECK_LABELS).map(([key, label]) => {
                                    const checkData = check[key as keyof HealthCheckResult] as CheckResult;
                                    const Icon = CHECK_ICONS[key] || Activity;
                                    return (
                                      <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                                        <div className="flex items-center gap-2">
                                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className="text-sm">{label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                                            {checkData?.message}
                                          </span>
                                          <CheckStatusBadge check={checkData || { status: 'unknown', message: '' }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* History */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-3">Histórico Recente</h4>
                                  {history.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Carregando...</p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                      {history.map(h => {
                                        const hCfg = STATUS_CONFIG[h.health_status];
                                        return (
                                          <div key={h.id} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                                            <span className="text-muted-foreground">
                                              {new Date(h.checked_at).toLocaleString('pt-BR')}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <Progress value={h.health_score} className="h-1.5 w-16" />
                                              <span className="font-mono w-6 text-right">{h.health_score}</span>
                                              <span className={`${hCfg.color} text-xs`}>{hCfg.label}</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {check.error_summary && (
                                <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
                                  {check.error_summary}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
