/**
 * IntegrationHealthDashboard — SuperAdmin dashboard for Integration Health & Monitoring Engine.
 *
 * Features: tenant status table, criticality colors, advanced filters, historical logs, internal alerts.
 */
import React, { useState, useMemo, Fragment } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Loader2, Server, ShieldCheck, Cpu, Radio, Clock, Layers,
  ChevronDown, ChevronUp, Gauge, Search, Filter, Bell, BellOff,
  User, ShieldAlert, Info,
} from 'lucide-react';
import {
  getLatestHealthChecks,
  getTenantHealthHistory,
  triggerHealthCheck,
  getActiveHealthAlerts,
  resolveHealthAlert,
  getTokenOwnersByTenant,
  type HealthCheckResult,
  type CheckResult,
  type HealthAlert,
  type TraccarTokenOwner,
} from '../services/integration-health.service';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  healthy: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Saudável', icon: CheckCircle2 },
  degraded: { color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Degradado', icon: AlertTriangle },
  critical: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Crítico', icon: XCircle },
  unknown: { color: 'text-muted-foreground', bg: 'bg-muted/30', label: 'Desconhecido', icon: Clock },
} as const;

const ALERT_TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  TENANT_SERVER_DOWN: { icon: Server, label: 'Servidor Indisponível' },
  NO_EVENTS_DETECTED: { icon: Radio, label: 'Sem Eventos Detectados' },
  DEVICE_SYNC_ERROR: { icon: Cpu, label: 'Erro de Sincronização' },
  ALERT_ENGINE_FAILURE: { icon: Layers, label: 'Falha no Motor de Alertas' },
};

const CHECK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
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
    pass: 'default', fail: 'destructive', warn: 'secondary', unknown: 'outline',
  };
  const labels: Record<string, string> = { pass: '✓ OK', fail: '✗ Falha', warn: '⚠ Alerta', unknown: '? N/A' };
  return <Badge variant={variants[check.status] || 'outline'} className="text-xs">{labels[check.status] || check.status}</Badge>;
}

export default function IntegrationHealthDashboard() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scoreFilter, setScoreFilter] = useState<string>('all');

  // Fetch health checks
  const { data: checks = [], isLoading } = useQuery({
    queryKey: ['integration-health-checks'],
    queryFn: getLatestHealthChecks,
  });

  // Fetch active alerts
  const { data: activeAlerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['integration-health-alerts'],
    queryFn: getActiveHealthAlerts,
  });

  // Fetch tenant names
  const tenantIds = useMemo(() => checks.map(c => c.tenant_id), [checks]);
  const { data: tenantNames = {} } = useQuery({
    queryKey: ['tenant-names', tenantIds],
    queryFn: async () => {
      if (tenantIds.length === 0) return {};
      const { data } = await supabase.from('tenants').select('id, name').in('id', tenantIds);
      const names: Record<string, string> = {};
      for (const t of (data || [])) names[t.id] = t.name;
      return names;
    },
    enabled: tenantIds.length > 0,
  });

  // Fetch token owners per tenant
  const { data: tokenOwners = {} } = useQuery({
    queryKey: ['traccar-token-owners'],
    queryFn: getTokenOwnersByTenant,
  });

  // Fetch history for expanded tenant
  const { data: history = [] } = useQuery({
    queryKey: ['integration-health-history', expandedTenant],
    queryFn: () => getTenantHealthHistory(expandedTenant!, 20),
    enabled: !!expandedTenant,
  });

  // Filtered checks
  const filteredChecks = useMemo(() => {
    return checks.filter(c => {
      if (statusFilter !== 'all' && c.health_status !== statusFilter) return false;
      if (scoreFilter === 'low' && c.health_score >= 50) return false;
      if (scoreFilter === 'mid' && (c.health_score < 50 || c.health_score >= 80)) return false;
      if (scoreFilter === 'high' && c.health_score < 80) return false;
      if (searchTerm) {
        const name = (tenantNames[c.tenant_id] || c.tenant_id).toLowerCase();
        if (!name.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }, [checks, statusFilter, scoreFilter, searchTerm, tenantNames]);

  const handleRunAll = async () => {
    setRunning(true);
    try {
      await triggerHealthCheck();
      await queryClient.invalidateQueries({ queryKey: ['integration-health-checks'] });
      await queryClient.invalidateQueries({ queryKey: ['integration-health-alerts'] });
      toast.success('Verificação concluída');
    } catch { toast.error('Erro ao executar verificação'); }
    setRunning(false);
  };

  const handleRunSingle = async (tenantId: string) => {
    setRunning(true);
    try {
      await triggerHealthCheck(tenantId);
      await queryClient.invalidateQueries({ queryKey: ['integration-health-checks'] });
      await queryClient.invalidateQueries({ queryKey: ['integration-health-alerts'] });
    } catch { /* */ }
    setRunning(false);
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await resolveHealthAlert(alertId);
      await queryClient.invalidateQueries({ queryKey: ['integration-health-alerts'] });
      toast.success('Alerta resolvido');
    } catch { toast.error('Erro ao resolver alerta'); }
  };

  // Aggregated stats
  const totalTenants = checks.length;
  const healthyCount = checks.filter(c => c.health_status === 'healthy').length;
  const degradedCount = checks.filter(c => c.health_status === 'degraded').length;
  const criticalCount = checks.filter(c => c.health_status === 'critical').length;
  const avgScore = totalTenants > 0 ? Math.round(checks.reduce((s, c) => s + c.health_score, 0) / totalTenants) : 0;

  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
  const warningAlerts = activeAlerts.filter(a => a.severity === 'warning');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card><CardContent className="p-4 text-center">
          <div className="text-3xl font-bold">{totalTenants}</div>
          <div className="text-xs text-muted-foreground mt-1">Tenants</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-emerald-500">{healthyCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Saudáveis</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-amber-500">{degradedCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Degradados</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-destructive">{criticalCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Críticos</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <Gauge className="h-5 w-5 text-muted-foreground" />
            <span className="text-3xl font-bold">{avgScore}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Score Médio</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <Bell className="h-5 w-5 text-destructive" />
            <span className="text-3xl font-bold text-destructive">{activeAlerts.length}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Alertas Ativos</div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5">
            Alertas Internos
            {activeAlerts.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">{activeAlerts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Tenants ── */}
        <TabsContent value="tenants" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar tenant..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="healthy">Saudável</SelectItem>
                    <SelectItem value="degraded">Degradado</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                    <SelectItem value="unknown">Desconhecido</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Score" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Scores</SelectItem>
                    <SelectItem value="high">Alto (≥80)</SelectItem>
                    <SelectItem value="mid">Médio (50-79)</SelectItem>
                    <SelectItem value="low">Baixo (&lt;50)</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground ml-auto">{filteredChecks.length} de {checks.length} tenants</span>
              </div>
            </CardContent>
          </Card>

          {/* Tenant Table */}
          <Card>
            <CardHeader><CardTitle className="text-base">Saúde por Tenant</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredChecks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum tenant encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Tenant</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Dispositivos</TableHead>
                        <TableHead>Eventos (24h)</TableHead>
                        <TableHead>Alertas (24h)</TableHead>
                        <TableHead>Queue Lag</TableHead>
                        <TableHead>Latência</TableHead>
                        <TableHead>Verificado</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredChecks.map(check => {
                        const cfg = STATUS_CONFIG[check.health_status];
                        const StatusIcon = cfg.icon;
                        const isExpanded = expandedTenant === check.tenant_id;
                        const tenantAlerts = activeAlerts.filter(a => a.tenant_id === check.tenant_id);

                        return (
                          <Fragment key={check.id}>
                            <TableRow
                              className={`cursor-pointer hover:bg-muted/50 border-l-4 ${
                                check.health_status === 'critical' ? 'border-l-destructive' :
                                check.health_status === 'degraded' ? 'border-l-amber-500' :
                                check.health_status === 'healthy' ? 'border-l-emerald-500' :
                                'border-l-muted'
                              }`}
                              onClick={() => setExpandedTenant(isExpanded ? null : check.tenant_id)}
                            >
                              <TableCell>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {tenantNames[check.tenant_id] || check.tenant_id.slice(0, 8)}
                                  {tenantAlerts.length > 0 && (
                                    <Badge variant="destructive" className="text-[10px] px-1 py-0">{tenantAlerts.length}</Badge>
                                  )}
                                </div>
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
                                <span className={check.queue_lag > 100 ? 'text-destructive font-medium' : ''}>{check.queue_lag}</span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {check.server_response_time_ms ? `${check.server_response_time_ms}ms` : '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(check.checked_at).toLocaleString('pt-BR')}
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleRunSingle(check.tenant_id); }} disabled={running}>
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={11} className="bg-muted/20 p-4">
                                  {/* Token Owner Info */}
                                  {(() => {
                                    const owner = tokenOwners[check.tenant_id];
                                    return (
                                      <div className="mb-4 p-3 rounded-lg border border-border bg-card">
                                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                          <User className="h-4 w-4 text-primary" /> Proprietário do Token (API Key)
                                        </h4>
                                        {owner ? (
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div>
                                              <span className="text-xs text-muted-foreground block">Nome</span>
                                              <span className="font-medium text-foreground">{owner.name || '—'}</span>
                                            </div>
                                            <div>
                                              <span className="text-xs text-muted-foreground block">E-mail</span>
                                              <span className="font-medium text-foreground">{owner.email}</span>
                                            </div>
                                            <div>
                                              <span className="text-xs text-muted-foreground block">Função</span>
                                              <Badge variant={owner.administrator ? 'default' : owner.readonly ? 'outline' : 'secondary'} className="text-xs mt-0.5">
                                                {owner.administrator ? '🛡️ Administrador' : owner.readonly ? '👁️ Somente Leitura' : '👤 Usuário Padrão'}
                                              </Badge>
                                            </div>
                                            <div>
                                              <span className="text-xs text-muted-foreground block">Acesso Total</span>
                                              {owner.administrator ? (
                                                <span className="text-xs font-medium flex items-center gap-1 mt-0.5 text-emerald-600">
                                                  <CheckCircle2 className="h-3.5 w-3.5" /> Sim — vê todos os dispositivos
                                                </span>
                                              ) : (
                                                <span className="text-xs font-medium flex items-center gap-1 mt-0.5 text-amber-600">
                                                  <AlertTriangle className="h-3.5 w-3.5" /> Não — acesso limitado
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="text-xs text-muted-foreground italic">
                                            Informação indisponível — execute uma sincronização para identificar o proprietário do token.
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Individual Checks */}
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-semibold mb-3">Testes de Saúde</h4>
                                      {Object.entries(CHECK_LABELS).map(([key, label]) => {
                                        const checkData = (check as any)[key] as CheckResult | undefined;
                                        const Icon = CHECK_ICONS[key] || Activity;
                                        return (
                                          <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                                            <div className="flex items-center gap-2">
                                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                              <span className="text-sm">{label}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-muted-foreground max-w-[200px] truncate">{checkData?.message}</span>
                                              <CheckStatusBadge check={checkData || { status: 'unknown', message: '' }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Tenant Alerts */}
                                    <div>
                                      <h4 className="text-sm font-semibold mb-3">Alertas Ativos</h4>
                                      {tenantAlerts.length === 0 ? (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Nenhum alerta ativo
                                        </p>
                                      ) : (
                                        <div className="space-y-2">
                                          {tenantAlerts.map(alert => {
                                            const alertCfg = ALERT_TYPE_CONFIG[alert.alert_type];
                                            const AlertIcon = alertCfg?.icon || AlertTriangle;
                                            return (
                                              <div key={alert.id} className={`p-2 rounded border text-xs ${
                                                alert.severity === 'critical' ? 'bg-destructive/10 border-destructive/20' : 'bg-amber-500/10 border-amber-500/20'
                                              }`}>
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-1.5">
                                                    <AlertIcon className={`h-3.5 w-3.5 ${alert.severity === 'critical' ? 'text-destructive' : 'text-amber-500'}`} />
                                                    <span className="font-medium">{alertCfg?.label || alert.alert_type}</span>
                                                  </div>
                                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => handleResolveAlert(alert.id)}>
                                                    <BellOff className="h-3 w-3 mr-1" /> Resolver
                                                  </Button>
                                                </div>
                                                <p className="text-muted-foreground mt-1">{alert.message}</p>
                                                <p className="text-muted-foreground/70 mt-0.5">{new Date(alert.created_at).toLocaleString('pt-BR')}</p>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
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
                                                <span className="text-muted-foreground">{new Date(h.checked_at).toLocaleString('pt-BR')}</span>
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
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Alertas Internos ── */}
        <TabsContent value="alerts" className="space-y-4">
          {/* Alert summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(ALERT_TYPE_CONFIG).map(([type, cfg]) => {
              const count = activeAlerts.filter(a => a.alert_type === type).length;
              const AlertIcon = cfg.icon;
              return (
                <Card key={type}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertIcon className={`h-5 w-5 ${count > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs text-muted-foreground">{cfg.label}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Active Alerts Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" /> Alertas Ativos ({activeAlerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeAlerts.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                  <p className="text-sm text-muted-foreground">Nenhum alerta ativo. Todos os sistemas operacionais.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAlerts.map(alert => {
                      const alertCfg = ALERT_TYPE_CONFIG[alert.alert_type];
                      const AlertIcon = alertCfg?.icon || AlertTriangle;
                      return (
                        <TableRow key={alert.id} className={`border-l-4 ${
                          alert.severity === 'critical' ? 'border-l-destructive' : 'border-l-amber-500'
                        }`}>
                          <TableCell>
                            <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                              {alert.severity === 'critical' ? '🔴 Crítico' : '🟡 Alerta'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <AlertIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-medium">{alertCfg?.label || alert.alert_type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{tenantNames[alert.tenant_id] || alert.tenant_id.slice(0, 8)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{alert.message}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(alert.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleResolveAlert(alert.id)}>
                              <BellOff className="h-3 w-3" /> Resolver
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Admin Legend */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-foreground">Legenda — Níveis de Acesso do Token Traccar</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-[10px]">🛡️ Administrador</Badge>
                  <span>Acesso total a todos os dispositivos, grupos e relatórios do servidor.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">👤 Usuário Padrão</Badge>
                  <span>Acesso apenas a dispositivos explicitamente vinculados ao seu perfil.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">👁️ Somente Leitura</Badge>
                  <span>Visualização sem permissão de alterações ou comandos.</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/80 pt-1 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                <strong>Importante:</strong> Apenas tokens vinculados a usuários <strong>Administradores</strong> possuem visibilidade completa de todos os dispositivos.
                Tokens de usuários padrão retornam apenas os dispositivos atribuídos a eles.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
