/**
 * Platform Dashboard — SaaS metrics overview
 * 6 sections: KPIs, Revenue, Marketing & Growth, API Usage, Financial, Clients
 * All data from get_platform_metrics + get_platform_extended_metrics RPCs
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Building2, Users, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, Crown, BarChart3, PieChart, Activity,
  Globe, Target, Share2, Zap, ShieldAlert, FileText,
  CreditCard, Receipt, Eye, MousePointerClick,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend,
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

/* ── Types ── */
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
    id: string; name: string; status: string; created_at: string;
    plan: string | null; mrr: number | null; sub_status: string | null; user_count: number;
  }>;
  plan_distribution: Array<{ plan: string; count: number; total_mrr: number }>;
  top_tenants: Array<{ name: string; mrr: number; plan: string; seats_used: number; user_count: number }>;
}

interface ExtendedMetrics {
  marketing: {
    total_landing_pages: number; published_lps: number; draft_lps: number;
    total_views: number; total_conversions: number; avg_conversion_rate: number;
    events_7d: number; lp_revenue_total: number;
    top_landing_pages: Array<{ name: string; slug: string; status: string; views: number; conversions: number; conversion_rate: number }>;
    referral_clicks: number; referral_signups: number; referral_conversions: number; referral_reward_brl: number;
  };
  api: {
    total_requests: number; total_errors: number; total_rate_limited: number;
    avg_latency_ms: number; p95_latency_ms: number; active_clients: number;
  };
  financial: {
    invoices_total: number; invoices_paid: number; invoices_pending: number; invoices_overdue: number;
    total_billed: number; total_received: number; total_pending_amount: number;
  };
}

/* ── Constants ── */
const PLAN_COLORS: Record<string, string> = {
  starter: 'hsl(var(--muted-foreground))', professional: 'hsl(var(--primary))',
  enterprise: 'hsl(var(--chart-4))', custom: 'hsl(var(--chart-5))',
};
const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise', custom: 'Custom',
};
const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Ativo', variant: 'default' }, trial: { label: 'Trial', variant: 'outline' },
  past_due: { label: 'Em atraso', variant: 'destructive' }, cancelled: { label: 'Cancelado', variant: 'secondary' },
  churned: { label: 'Churn', variant: 'destructive' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

/* ── Main Component ── */
export default function PlatformDashboard() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [extended, setExtended] = useState<ExtendedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [mainRes, extRes] = await Promise.all([
        supabase.rpc('get_platform_metrics'),
        supabase.rpc('get_platform_extended_metrics'),
      ]);
      if (mainRes.error) {
        setError(mainRes.error.message);
      } else {
        setMetrics(mainRes.data as unknown as PlatformMetrics);
      }
      if (!extRes.error && extRes.data) {
        setExtended(extRes.data as unknown as ExtendedMetrics);
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
    name: PLAN_LABELS[p.plan] || p.plan, value: p.count, mrr: p.total_mrr,
    fill: PLAN_COLORS[p.plan] || 'hsl(var(--muted))',
  }));

  const barData = metrics.recent_tenants
    .filter(t => t.mrr != null).slice(0, 8).reverse()
    .map(t => ({ name: t.name.length > 14 ? t.name.slice(0, 14) + '…' : t.name, mrr: t.mrr ?? 0, users: t.user_count }));

  const mkt = extended?.marketing;
  const api = extended?.api;
  const fin = extended?.financial;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Platform Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão consolidada — receita, marketing, APIs e saúde financeira.
        </p>
      </div>

      {/* ═══ SEÇÃO 1: KPIs Principais ═══ */}
      <section>
        <SectionHeader title="Indicadores Principais" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="MRR" value={formatCurrency(metrics.total_mrr)} subtitle={`Ticket médio: ${formatCurrency(metrics.avg_mrr)}`} icon={DollarSign} iconClass="text-emerald-500" bgClass="bg-emerald-500/10" />
          <KpiCard label="ARR" value={formatCurrency(metrics.total_mrr * 12)} subtitle="Receita anual recorrente" icon={TrendingUp} iconClass="text-primary" bgClass="bg-primary/10" />
          <KpiCard label="Clientes Ativos" value={String(metrics.active_tenants)} subtitle={`${metrics.trial_subscriptions} trial · ${metrics.suspended_tenants} suspensos`} icon={Building2} iconClass="text-sky-500" bgClass="bg-sky-500/10" />
          <KpiCard label="Churn Rate" value={`${metrics.churn_rate}%`} subtitle={`${metrics.churned_subscriptions} churned de ${metrics.active_subscriptions + metrics.churned_subscriptions}`} icon={metrics.churn_rate > 5 ? TrendingDown : TrendingUp} iconClass={metrics.churn_rate > 5 ? 'text-destructive' : 'text-emerald-500'} bgClass={metrics.churn_rate > 5 ? 'bg-destructive/10' : 'bg-emerald-500/10'} />
        </div>
      </section>

      {/* ═══ SEÇÃO 2: Receita & Distribuição ═══ */}
      <section>
        <SectionHeader title="Receita & Distribuição" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          <KpiCard label="Assinaturas Ativas" value={String(metrics.active_subscriptions)} subtitle={`ARPA: ${formatCurrency(metrics.active_subscriptions > 0 ? metrics.total_mrr / metrics.active_subscriptions : 0)}`} icon={Activity} iconClass="text-amber-500" bgClass="bg-amber-500/10" />
          <KpiCard label="Usuários Totais" value={String(metrics.total_users)} subtitle={`~${metrics.active_tenants > 0 ? Math.round(metrics.total_users / metrics.active_tenants) : 0} por cliente`} icon={Users} iconClass="text-sky-500" bgClass="bg-sky-500/10" />
          <KpiCard label="Total Clientes" value={String(metrics.total_tenants)} subtitle={`${metrics.active_tenants} ativos · ${metrics.suspended_tenants} suspensos`} icon={Building2} iconClass="text-muted-foreground" bgClass="bg-muted/30" />
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
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
                    <Tooltip formatter={(val: number) => formatCurrency(val)} labelFormatter={l => `Cliente: ${l}`} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="mrr" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
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
                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Legend verticalAlign="bottom" height={36} />
                    <Tooltip formatter={(val: number, _name: string, props: any) => [`${val} tenants — ${formatCurrency(props.payload.mrr)}`, 'Plano']} />
                  </RechartsPie>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══ SEÇÃO 3: Marketing & Growth ═══ */}
      {mkt && (
        <section>
          <SectionHeader title="Marketing & Growth" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <KpiCard label="Landing Pages" value={String(mkt.total_landing_pages)} subtitle={`${mkt.published_lps} publicadas · ${mkt.draft_lps} rascunhos`} icon={Globe} iconClass="text-violet-500" bgClass="bg-violet-500/10" />
            <KpiCard label="Visualizações" value={formatNumber(mkt.total_views)} subtitle={`${formatNumber(mkt.events_7d)} eventos (7d)`} icon={Eye} iconClass="text-sky-500" bgClass="bg-sky-500/10" />
            <KpiCard label="Conversões" value={formatNumber(mkt.total_conversions)} subtitle={`Taxa média: ${mkt.avg_conversion_rate}%`} icon={Target} iconClass="text-emerald-500" bgClass="bg-emerald-500/10" />
            <KpiCard label="Receita LPs" value={formatCurrency(mkt.lp_revenue_total)} subtitle="Receita atribuída a landing pages" icon={DollarSign} iconClass="text-amber-500" bgClass="bg-amber-500/10" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top LPs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Top Landing Pages
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mkt.top_landing_pages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma landing page criada.</p>
                ) : (
                  mkt.top_landing_pages.map((lp, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 border-border/50">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/10 text-xs font-bold text-violet-500">{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium">{lp.name}</p>
                          <p className="text-xs text-muted-foreground">/{lp.slug} · {lp.views} views</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{lp.conversion_rate}%</span>
                        <Badge variant={lp.status === 'published' ? 'default' : 'secondary'} className="text-[10px]">{lp.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Referral Program */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Share2 className="h-4 w-4" /> Programa de Referral
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <MetricBlock label="Cliques" value={formatNumber(mkt.referral_clicks)} icon={MousePointerClick} />
                  <MetricBlock label="Signups" value={formatNumber(mkt.referral_signups)} icon={Users} />
                  <MetricBlock label="Conversões" value={formatNumber(mkt.referral_conversions)} icon={Target} />
                  <MetricBlock label="Recompensas" value={formatCurrency(mkt.referral_reward_brl)} icon={DollarSign} />
                </div>
                {mkt.referral_clicks > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Funil: Cliques → Conversões</span>
                      <span className="font-semibold text-foreground">
                        {mkt.referral_clicks > 0 ? ((mkt.referral_conversions / mkt.referral_clicks) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <Progress value={mkt.referral_clicks > 0 ? (mkt.referral_conversions / mkt.referral_clicks) * 100 : 0} className="h-1.5" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* ═══ SEÇÃO 4: API Usage ═══ */}
      {api && (
        <section>
          <SectionHeader title="Uso de APIs" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Requisições" value={formatNumber(api.total_requests)} subtitle={`${api.active_clients} clientes ativos`} icon={Zap} iconClass="text-primary" bgClass="bg-primary/10" />
            <KpiCard label="Erros" value={formatNumber(api.total_errors)} subtitle={api.total_requests > 0 ? `Taxa: ${((api.total_errors / api.total_requests) * 100).toFixed(2)}%` : 'Sem tráfego'} icon={ShieldAlert} iconClass={api.total_errors > 0 ? 'text-destructive' : 'text-emerald-500'} bgClass={api.total_errors > 0 ? 'bg-destructive/10' : 'bg-emerald-500/10'} />
            <KpiCard label="Rate Limited" value={formatNumber(api.total_rate_limited)} subtitle="Requisições bloqueadas por limite" icon={ShieldAlert} iconClass="text-amber-500" bgClass="bg-amber-500/10" />
            <KpiCard label="Latência p95" value={`${api.p95_latency_ms}ms`} subtitle={`Média: ${api.avg_latency_ms}ms`} icon={Activity} iconClass="text-sky-500" bgClass="bg-sky-500/10" />
          </div>
        </section>
      )}

      {/* ═══ SEÇÃO 5: Financeiro (Faturas) ═══ */}
      {fin && (
        <section>
          <SectionHeader title="Financeiro" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <KpiCard label="Total Faturado" value={formatCurrency(fin.total_billed)} subtitle={`${fin.invoices_total} faturas emitidas`} icon={Receipt} iconClass="text-primary" bgClass="bg-primary/10" />
            <KpiCard label="Recebido" value={formatCurrency(fin.total_received)} subtitle={`${fin.invoices_paid} faturas pagas`} icon={CreditCard} iconClass="text-emerald-500" bgClass="bg-emerald-500/10" />
            <KpiCard label="A Receber" value={formatCurrency(fin.total_pending_amount)} subtitle={`${fin.invoices_pending} faturas pendentes`} icon={FileText} iconClass="text-amber-500" bgClass="bg-amber-500/10" />
            <KpiCard label="Inadimplentes" value={String(fin.invoices_overdue)} subtitle="Faturas vencidas não pagas" icon={AlertTriangle} iconClass={fin.invoices_overdue > 0 ? 'text-destructive' : 'text-muted-foreground'} bgClass={fin.invoices_overdue > 0 ? 'bg-destructive/10' : 'bg-muted/30'} />
          </div>
          {fin.invoices_total > 0 && (
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>Taxa de Recebimento</span>
                  <span className="font-semibold text-foreground">{fin.invoices_total > 0 ? ((fin.invoices_paid / fin.invoices_total) * 100).toFixed(1) : 0}%</span>
                </div>
                <Progress value={fin.invoices_total > 0 ? (fin.invoices_paid / fin.invoices_total) * 100 : 0} className="h-2" />
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>{fin.invoices_paid} pagas</span>
                  <span>{fin.invoices_pending} pendentes</span>
                  <span>{fin.invoices_overdue} vencidas</span>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* ═══ SEÇÃO 6: Base de Clientes ═══ */}
      <section>
        <SectionHeader title="Base de Clientes" />
        <div className="grid gap-4 lg:grid-cols-2">
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
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{PLAN_LABELS[t.plan] || t.plan} · {t.user_count} usuários</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(t.mrr)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" /> Tenants Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics.recent_tenants.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
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
                          <p className="text-xs text-muted-foreground">{format(new Date(t.created_at), 'dd/MM/yyyy')} · {t.user_count} usuários</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.mrr != null && t.mrr > 0 && <span className="text-xs font-medium text-muted-foreground">{formatCurrency(t.mrr)}</span>}
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

/* ── KPI Card ── */
function KpiCard({ label, value, subtitle, icon: Icon, iconClass, bgClass }: {
  label: string; value: string; subtitle: string; icon: React.ElementType; iconClass: string; bgClass: string;
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

/* ── Metric Block (compact) ── */
function MetricBlock({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="p-3 rounded-lg bg-muted/20 border border-border/40 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold font-display text-foreground">{value}</p>
    </div>
  );
}

/* ── Loading Skeleton ── */
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-72 mt-2" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="pt-5 space-y-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-28" /><Skeleton className="h-3 w-36" /></CardContent></Card>
        ))}
      </div>
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
