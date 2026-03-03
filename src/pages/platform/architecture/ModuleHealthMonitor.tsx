/**
 * ModuleHealthMonitor — Integrated monitoring dashboard
 *
 * Displays:
 *  - Operational status per module (healthy / degraded / down)
 *  - Recent platform incidents (from Incident Management Engine)
 *  - Key metrics with Grafana/Prometheus links
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createArchitectureIntelligenceEngine } from '@/domains/architecture-intelligence';
import type { ArchModuleInfo, ModuleSLA } from '@/domains/architecture-intelligence';
import { createIncidentManagementEngine } from '@/domains/incident-management/incident-management-engine';
import type { Incident, IncidentDashboardStats, IncidentSeverity } from '@/domains/incident-management/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Activity, AlertTriangle, CheckCircle2, Circle, Clock, ExternalLink,
  Server, Shield, TrendingUp, XCircle, Gauge, BarChart3,
} from 'lucide-react';

// ── Color maps ──
const statusDot: Record<string, string> = {
  healthy: 'text-emerald-500',
  degraded: 'text-amber-500',
  down: 'text-destructive',
  unknown: 'text-muted-foreground',
};

const statusLabel: Record<string, string> = {
  healthy: 'Operacional',
  degraded: 'Degradado',
  down: 'Indisponível',
  unknown: 'Desconhecido',
};

const sevColor: Record<string, string> = {
  sev1: 'bg-destructive text-destructive-foreground',
  sev2: 'bg-amber-600 text-white',
  sev3: 'bg-amber-400 text-amber-950',
  sev4: 'bg-muted text-muted-foreground',
};

const sevLabel: Record<string, string> = {
  sev1: 'Crítico',
  sev2: 'Alto',
  sev3: 'Médio',
  sev4: 'Baixo',
};

const statusIncidentLabel: Record<string, string> = {
  open: 'Aberto',
  investigating: 'Investigando',
  mitigated: 'Mitigado',
  resolved: 'Resolvido',
};

export default function ModuleHealthMonitor() {
  const archEngine = useMemo(() => createArchitectureIntelligenceEngine(), []);
  const incidentEngine = useMemo(() => createIncidentManagementEngine(), []);
  const modules = useMemo(() => archEngine.getModules(), [archEngine]);

  const [tab, setTab] = useState('status');

  // Fetch incidents
  const { data: incidents = [] } = useQuery<Incident[]>({
    queryKey: ['module-health-incidents'],
    queryFn: () => incidentEngine.listIncidents({ limit: 20 }),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery<IncidentDashboardStats>({
    queryKey: ['module-health-stats'],
    queryFn: () => incidentEngine.getDashboardStats(),
    refetchInterval: 60_000,
  });

  // Counts
  const healthy = modules.filter((m: ArchModuleInfo) => m.status === 'healthy').length;
  const degraded = modules.filter((m: ArchModuleInfo) => m.status === 'degraded').length;
  const down = modules.filter((m: ArchModuleInfo) => m.status === 'down').length;
  const openIncidents = incidents.filter((i: Incident) =>
    i.status === 'open' || i.status === 'investigating' || i.status === 'mitigated'
  );

  // Prometheus endpoint
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const prometheusUrl = `https://${projectId}.supabase.co/functions/v1/prometheus-metrics`;
  const metricsExportUrl = `https://${projectId}.supabase.co/functions/v1/metrics-export`;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Operacionais" value={healthy} />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Degradados" value={degraded} />
        <SummaryCard icon={<XCircle className="h-4 w-4 text-destructive" />} label="Indisponíveis" value={down} />
        <SummaryCard icon={<Activity className="h-4 w-4 text-primary" />} label="Incidentes Abertos" value={openIncidents.length} />
        <SummaryCard icon={<Clock className="h-4 w-4 text-muted-foreground" />} label="MTTR (min)" value={stats?.mttr_minutes ?? '—'} />
      </div>

      {/* Global indicators */}
      {stats && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <MetricBox label="Uptime 30d" value={`${stats.uptime_30d.toFixed(2)}%`} icon={<TrendingUp className="h-3.5 w-3.5" />} />
              <MetricBox label="SLA Breaches" value={String(stats.sla_breach_count)} icon={<Shield className="h-3.5 w-3.5" />} />
              <MetricBox label="Sev1 Abertos" value={String(stats.by_severity.sev1)} critical={stats.by_severity.sev1 > 0} icon={<AlertTriangle className="h-3.5 w-3.5" />} />
              <MetricBox label="Total Abertos" value={String(stats.total_open)} icon={<Activity className="h-3.5 w-3.5" />} />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="status">Status Operacional</TabsTrigger>
          <TabsTrigger value="incidents">Incidentes Recentes</TabsTrigger>
          <TabsTrigger value="metrics">Métricas & Grafana</TabsTrigger>
        </TabsList>

        {/* ── Status Operacional ── */}
        <TabsContent value="status">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4" />
                Status por Módulo ({modules.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {modules.map((m: ArchModuleInfo) => (
                  <div key={m.key} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent/5 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Circle className={`h-2.5 w-2.5 fill-current ${statusDot[m.status]}`} />
                      <div>
                        <span className="font-medium">{m.label}</span>
                        <p className="text-[10px] text-muted-foreground">{m.domain === 'saas' ? 'SaaS' : 'Tenant'} · {m.sla.tier}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{m.version_tag}</Badge>
                      <span className={`text-xs font-medium ${statusDot[m.status]}`}>
                        {statusLabel[m.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Incidentes Recentes ── */}
        <TabsContent value="incidents">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Incidentes Recentes ({incidents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm">Nenhum incidente registrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {incidents.slice(0, 15).map((inc: Incident) => (
                    <div key={inc.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge className={`text-[10px] shrink-0 ${sevColor[inc.severity]}`}>
                          {sevLabel[inc.severity]}
                        </Badge>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{inc.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {inc.affected_modules?.join(', ') || 'N/A'} · {new Date(inc.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {statusIncidentLabel[inc.status] ?? inc.status}
                        </Badge>
                        {inc.sla_breached && (
                          <Badge variant="destructive" className="text-[10px]">SLA</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Métricas & Grafana ── */}
        <TabsContent value="metrics">
          <div className="space-y-4">
            {/* Prometheus endpoints */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4" />
                  Endpoints Prometheus
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Configure esses endpoints como data sources no Grafana para visualizar métricas da plataforma em tempo real.
                </p>
                <EndpointRow label="Prometheus Metrics" url={prometheusUrl} description="Métricas de billing, governança e operações" />
                <EndpointRow label="Metrics Export" url={metricsExportUrl} description="Endpoint OpenTelemetry-compatible com métricas de assinaturas e saúde" />
              </CardContent>
            </Card>

            {/* Module metrics registry */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Métricas por Módulo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {modules
                    .filter((m: ArchModuleInfo) => m.monitoring_metrics.length > 0)
                    .map((m: ArchModuleInfo) => (
                      <div key={m.key}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Circle className={`h-2 w-2 fill-current ${statusDot[m.status]}`} />
                          <span className="text-sm font-semibold">{m.label}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">{m.key}</Badge>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 pl-4">
                          {m.monitoring_metrics.map((metric, mi) => (
                            <div key={mi} className="rounded-md border p-2.5 text-xs">
                              <code className="font-mono text-primary text-[11px]">{metric.metric_name}</code>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Badge variant="outline" className="text-[9px]">{metric.type}</Badge>
                                <span className="text-muted-foreground">{metric.description}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Separator className="mt-3" />
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Grafana setup guide */}
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardContent className="pt-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  Configuração Grafana
                </h3>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4">
                  <li>Adicione um novo <strong>Data Source → Prometheus</strong> no Grafana</li>
                  <li>Configure a URL do endpoint: <code className="bg-muted px-1 rounded text-[10px]">{prometheusUrl}</code></li>
                  <li>Configure o header de autenticação: <code className="bg-muted px-1 rounded text-[10px]">apikey: &lt;anon_key&gt;</code></li>
                  <li>Importe dashboards pré-configurados ou crie painéis customizados com as métricas listadas acima</li>
                  <li>Configure alertas no Grafana para métricas críticas (ex: <code className="bg-muted px-1 rounded text-[10px]">sla_breaches_total</code>)</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Helpers ──

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}

function MetricBox({ label, value, icon, critical }: { label: string; value: string; icon: React.ReactNode; critical?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${critical ? 'border-destructive/40 bg-destructive/5' : ''}`}>
      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">{icon}{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${critical ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  );
}

function EndpointRow({ label, url, description }: { label: string; url: string; description: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono shrink-0">GET</Badge>
      </div>
      <code className="text-[10px] text-primary font-mono mt-1.5 block break-all bg-muted/50 rounded px-2 py-1">{url}</code>
    </div>
  );
}
