/**
 * Platform Dashboard — SaaS metrics overview
 * Organized in clear sections: KPIs, Financial, Charts, Tenants
 * All data sourced from get_platform_metrics RPC (real DB data)
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2, Users, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, Crown, BarChart3, PieChart, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend,
} from 'recharts';
import { format } from 'date-fns';

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

  const arrValue = metrics.total_mrr * 12;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Platform Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão consolidada do SaaS — receita, crescimento e base de clientes.
        </p>
      </div>

      {/* ═══ SEÇÃO 1: KPIs Principais ═══ */}
      <section>
        <SectionHeader title="Indicadores Principais" />
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
            label="ARR"
            value={formatCurrency(arrValue)}
            subtitle="Receita anual recorrente"
            icon={TrendingUp}
            iconClass="text-primary"
            bgClass="bg-primary/10"
          />
          <KpiCard
            label="Tenants Ativos"
            value={String(metrics.active_tenants)}
            subtitle={`${metrics.trial_subscriptions} em trial · ${metrics.suspended_tenants} suspensos`}
            icon={Building2}
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
      </section>

      {/* ═══ SEÇÃO 2: Receita & Planos ═══ */}
      <section>
        <SectionHeader title="Receita & Distribuição" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Assinaturas Ativas"
            value={String(metrics.active_subscriptions)}
            subtitle={`ARPA: ${formatCurrency(metrics.active_subscriptions > 0 ? metrics.total_mrr / metrics.active_subscriptions : 0)}`}
            icon={Activity}
            iconClass="text-amber-500"
            bgClass="bg-amber-500/10"
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
            label="Total Tenants"
            value={String(metrics.total_tenants)}
            subtitle={`${metrics.active_tenants} ativos · ${metrics.suspended_tenants} suspensos`}
            icon={Building2}
            iconClass="text-muted-foreground"
            bgClass="bg-muted/30"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-5 mt-4">
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
      </section>

      {/* ═══ SEÇÃO 3: Base de Clientes ═══ */}
      <section>
        <SectionHeader title="Base de Clientes" />
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
      </section>
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="flex-1 h-px bg-border/60" />
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
    <div className="space-y-8">
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
