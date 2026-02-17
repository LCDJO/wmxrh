/**
 * Platform Dashboard — SaaS metrics overview
 * MRR, churn, tenant growth, plan distribution, top tenants, recent activity
 * + Platform Health widgets (modules, errors, performance)
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Building2, Users, Activity, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, Crown, BarChart3, PieChart, ArrowUpRight,
  HeartPulse, Bug, Gauge, CheckCircle2, AlertCircle, XCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend,
} from 'recharts';
import { format } from 'date-fns';
import { getHealthMonitor } from '@/domains/observability/health-monitor';
import { getErrorTracker } from '@/domains/observability/error-tracker';
import { getGatewayPerformanceTracker } from '@/domains/observability/gateway-performance-tracker';
import { cn } from '@/lib/utils';

interface PlatformMetrics {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  total_users: number;
  total_mrr: number;
  active_subscriptions: number;
  trial_subscriptions: number;
  churned_subscriptions: number;
  avg_mrr: number;
  churn_rate: number;
  recent_tenants: Array<{
    id: string;
    name: string;
    status: string;
    created_at: string;
    plan: string | null;
    mrr: number | null;
    sub_status: string | null;
    user_count: number;
  }>;
  plan_distribution: Array<{
    plan: string;
    count: number;
    total_mrr: number;
  }>;
  top_tenants: Array<{
    name: string;
    mrr: number;
    plan: string;
    seats_used: number;
    user_count: number;
  }>;
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'hsl(var(--muted-foreground))',
  professional: 'hsl(var(--primary))',
  enterprise: 'hsl(var(--chart-4))',
  custom: 'hsl(var(--chart-5))',
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  custom: 'Custom',
};

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Ativo', variant: 'default' },
  trial: { label: 'Trial', variant: 'outline' },
  past_due: { label: 'Em atraso', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'secondary' },
  churned: { label: 'Churn', variant: 'destructive' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function PlatformDashboard() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase.rpc('get_platform_metrics');
      if (err) {
        setError(err.message);
        console.error('[PlatformDashboard] RPC error:', err);
      } else {
        setMetrics(data as unknown as PlatformMetrics);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <AlertTriangle className="h-8 w-8" />
        <p className="text-sm">Erro ao carregar métricas: {error}</p>
      </div>
    );
  }

  const pieData = metrics.plan_distribution.map(p => ({
    name: PLAN_LABELS[p.plan] || p.plan,
    value: p.count,
    mrr: p.total_mrr,
    fill: PLAN_COLORS[p.plan] || 'hsl(var(--muted))',
  }));

  const barData = metrics.recent_tenants
    .filter(t => t.mrr != null)
    .slice(0, 8)
    .reverse()
    .map(t => ({
      name: t.name.length > 14 ? t.name.slice(0, 14) + '…' : t.name,
      mrr: t.mrr ?? 0,
      users: t.user_count,
    }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Platform Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão consolidada do SaaS — receita, crescimento e saúde operacional.
        </p>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="MRR"
          value={formatCurrency(metrics.total_mrr)}
          subtitle={`Ticket médio: ${formatCurrency(metrics.avg_mrr)}`}
          icon={DollarSign}
          iconClass="text-emerald-500"
          bgClass="bg-emerald-500/10"
        />
        <KpiCard
          label="Tenants Ativos"
          value={String(metrics.active_tenants)}
          subtitle={`${metrics.trial_subscriptions} em trial · ${metrics.suspended_tenants} suspensos`}
          icon={Building2}
          iconClass="text-primary"
          bgClass="bg-primary/10"
        />
        <KpiCard
          label="Usuários Totais"
          value={String(metrics.total_users)}
          subtitle={`~${metrics.active_tenants > 0 ? Math.round(metrics.total_users / metrics.active_tenants) : 0} por tenant`}
          icon={Users}
          iconClass="text-sky-500"
          bgClass="bg-sky-500/10"
        />
        <KpiCard
          label="Churn Rate"
          value={`${metrics.churn_rate}%`}
          subtitle={`${metrics.churned_subscriptions} churned de ${metrics.active_subscriptions + metrics.churned_subscriptions}`}
          icon={metrics.churn_rate > 5 ? TrendingDown : TrendingUp}
          iconClass={metrics.churn_rate > 5 ? 'text-destructive' : 'text-emerald-500'}
          bgClass={metrics.churn_rate > 5 ? 'bg-destructive/10' : 'bg-emerald-500/10'}
        />
      </div>

      {/* ═══ Platform Health Widgets ═══ */}
      <PlatformHealthWidgets />


      <div className="grid gap-4 lg:grid-cols-5">
        {/* MRR by Tenant (bar) */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> MRR por Tenant
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de MRR ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                  <Tooltip
                    formatter={(val: number) => formatCurrency(val)}
                    labelFormatter={(l) => `Tenant: ${l}`}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="mrr" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Plan Distribution (pie) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4" /> Distribuição por Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma assinatura ativa.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                  <Tooltip
                    formatter={(val: number, _name: string, props: any) =>
                      [`${val} tenants — ${formatCurrency(props.payload.mrr)}`, 'Plano']
                    }
                  />
                </RechartsPie>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Bottom Row: Top Tenants + Recent Activity ═══ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Tenants by MRR */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Crown className="h-4 w-4 text-chart-4" /> Top Tenants por MRR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.top_tenants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              metrics.top_tenants.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {PLAN_LABELS[t.plan] || t.plan} · {t.user_count} usuários
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(t.mrr)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Tenants */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> Tenants Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.recent_tenants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum tenant cadastrado.</p>
            ) : (
              metrics.recent_tenants.slice(0, 6).map((t) => {
                const sub = STATUS_LABELS[t.sub_status ?? ''] ?? { label: 'Sem plano', variant: 'secondary' as const };
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0 border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(t.created_at), 'dd/MM/yyyy')} · {t.user_count} usuários
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.mrr != null && t.mrr > 0 && (
                        <span className="text-xs font-medium text-muted-foreground">{formatCurrency(t.mrr)}</span>
                      )}
                      <Badge variant={sub.variant} className="text-[10px]">{sub.label}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── KPI Card component ── */
function KpiCard({
  label, value, subtitle, icon: Icon, iconClass, bgClass,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  iconClass: string;
  bgClass: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgClass}`}>
            <Icon className={`h-4 w-4 ${iconClass}`} />
          </div>
        </div>
        <p className="text-2xl font-bold font-display text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

/* ── Loading skeleton ── */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-72 mt-2" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="pt-5 space-y-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-28" /><Skeleton className="h-3 w-36" /></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3"><CardContent className="pt-5"><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card className="lg:col-span-2"><CardContent className="pt-5"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}

/* ── Platform Health Widgets ── */
function PlatformHealthWidgets() {
  const health = getHealthMonitor().getSummary();
  const errors = getErrorTracker().getSummary();
  const perf = getGatewayPerformanceTracker().getSummary();

  const healthPct = health.total_modules > 0
    ? Math.round((health.healthy_count / health.total_modules) * 100)
    : 100;

  const statusIcon = health.overall === 'healthy'
    ? CheckCircle2
    : health.overall === 'degraded'
    ? AlertCircle
    : XCircle;

  const statusColor = health.overall === 'healthy'
    ? 'text-emerald-500'
    : health.overall === 'degraded'
    ? 'text-amber-500'
    : 'text-destructive';

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Module Health */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Saúde dos Módulos</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <HeartPulse className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {(() => { const Icon = statusIcon; return <Icon className={cn('h-5 w-5', statusColor)} />; })()}
            <p className="text-2xl font-bold font-display text-foreground">{healthPct}%</p>
          </div>
          <Progress value={healthPct} className="h-1.5 mb-2" />
          <p className="text-xs text-muted-foreground">
            {health.healthy_count} saudáveis · {health.degraded_count} degradados · {health.down_count} offline
          </p>
        </CardContent>
      </Card>

      {/* Error Rate */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Erros (1h)</p>
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg',
              errors.total_errors_1h > 10 ? 'bg-destructive/10' : 'bg-amber-500/10'
            )}>
              <Bug className={cn('h-4 w-4', errors.total_errors_1h > 10 ? 'text-destructive' : 'text-amber-500')} />
            </div>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">{errors.total_errors_1h}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {errors.error_rate_per_min.toFixed(1)}/min · {errors.total_errors_24h} nas últimas 24h
          </p>
        </CardContent>
      </Card>

      {/* Gateway Latency */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Gateway p95</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10">
              <Gauge className="h-4 w-4 text-sky-500" />
            </div>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">{perf.gateway.p95}ms</p>
          <p className="text-xs text-muted-foreground mt-1">
            avg {perf.gateway.avg}ms · p99 {perf.gateway.p99}ms
          </p>
        </CardContent>
      </Card>

      {/* AccessGraph Recomp */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AccessGraph</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <Activity className="h-4 w-4 text-violet-500" />
            </div>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">{perf.access_graph.p95}ms</p>
          <p className="text-xs text-muted-foreground mt-1">
            recomposição p95 · avg {perf.access_graph.avg}ms
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
