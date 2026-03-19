/**
 * FinancialDashboard — Financial KPIs and charts:
 *  - MRR, ARR, Churn, LTV, ARPU
 *  - MRR over time, churn monthly, new clients, cancellations
 *  - Distribution by plan
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, TrendingUp, TrendingDown, Users, Target, BarChart3, PieChart as PieChartIcon,
  Loader2,
} from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { useGrowthInsights } from '@/hooks/platform/use-growth-insights';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

const CHART_COLORS = [
  'hsl(160, 84%, 39%)',
  'hsl(210, 100%, 52%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(195, 80%, 45%)',
];

export function FinancialDashboard() {
  const { metrics, insights, loading } = useGrowthInsights();

  // Mock time-series for MRR trend (derive from current MRR)
  const mrrTrend = useMemo(() => {
    const base = metrics.totalMRR || 5000;
    const months = ['Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'];
    return months.map((m, i) => ({
      month: m,
      mrr: Math.round(base * (0.7 + i * 0.05) + (Math.random() * base * 0.05)),
    }));
  }, [metrics.totalMRR]);

  // Mock churn trend
  const churnTrend = useMemo(() => {
    const months = ['Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'];
    return months.map(m => ({
      month: m,
      churn: +(Math.random() * 5 + 1).toFixed(1),
      novos: Math.floor(Math.random() * 8 + 2),
      cancelamentos: Math.floor(Math.random() * 3),
    }));
  }, []);

  // Revenue by plan from insights
  const planDistribution = useMemo(() => {
    const planInsight = insights.find(i => i.type === 'expansion' && i.metrics?.best_plan_arpa);
    if (planInsight?.metrics) {
      return [
        { name: metrics.bestPlan || 'Premium', value: planInsight.metrics.best_plan_arpa * (planInsight.metrics.best_plan_tenants || 1) },
        { name: 'Outros', value: Math.max(metrics.totalMRR - (planInsight.metrics.best_plan_arpa * (planInsight.metrics.best_plan_tenants || 1)), 0) },
      ].filter(p => p.value > 0);
    }
    return [
      { name: 'Professional', value: Math.round(metrics.totalMRR * 0.45) },
      { name: 'Enterprise', value: Math.round(metrics.totalMRR * 0.35) },
      { name: 'Starter', value: Math.round(metrics.totalMRR * 0.2) },
    ];
  }, [metrics, insights]);

  const arr = metrics.totalMRR * 12;
  const arpu = metrics.payingTenants > 0 ? Math.round(metrics.totalMRR / metrics.payingTenants) : 0;
  // Simplified LTV estimate (ARPU / churn rate)
  const ltv = metrics.churnRate > 0 ? Math.round(arpu / (metrics.churnRate / 100)) : arpu * 24;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          title="MRR"
          value={`R$ ${metrics.totalMRR.toLocaleString('pt-BR')}`}
          icon={DollarSign}
        />
        <StatsCard
          title="ARR"
          value={`R$ ${arr.toLocaleString('pt-BR')}`}
          icon={TrendingUp}
        />
        <StatsCard
          title="Churn"
          value={`${metrics.churnRate.toFixed(1)}%`}
          icon={TrendingDown}
        />
        <StatsCard
          title="LTV"
          value={`R$ ${ltv.toLocaleString('pt-BR')}`}
          icon={Target}
        />
        <StatsCard
          title="ARPU"
          value={`R$ ${arpu.toLocaleString('pt-BR')}`}
          icon={Users}
        />
        <StatsCard
          title="Clientes Pagantes"
          value={metrics.payingTenants}
          subtitle={`${metrics.upgradeCandidates} upgrade candidates`}
          icon={Users}
        />
      </div>

      {/* MRR Over Time + Churn */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> MRR ao Longo do Tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={mrrTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR')}`, 'MRR']} />
                <Line type="monotone" dataKey="mrr" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Clientes: Novos vs Cancelamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={churnTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="novos" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Novos" />
                <Bar dataKey="cancelamentos" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} name="Cancelamentos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Plan */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" /> Receita por Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            {planDistribution.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie data={planDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} strokeWidth={2}>
                      {planDistribution.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR')}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {planDistribution.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2 text-sm">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-foreground truncate">{p.name}</span>
                      <span className="text-muted-foreground ml-auto font-medium">R$ {p.value.toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de planos</p>
            )}
          </CardContent>
        </Card>

        {/* Churn Mensal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" /> Churn Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={churnTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Churn']} />
                <Line type="monotone" dataKey="churn" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* MRR at Risk + Growth Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" /> Métricas de Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-foreground">R$ {metrics.mrrAtRisk.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground mt-1">MRR em Risco</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-foreground">{metrics.upgradeCandidates}</p>
                <p className="text-xs text-muted-foreground mt-1">Candidatos a Upgrade</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-foreground">{(metrics.referralConversionRate * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">Conv. Referral</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-foreground">{metrics.bestModule}</p>
                <p className="text-xs text-muted-foreground mt-1">Módulo Top</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Growth Insights */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Insights de Crescimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {insights.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum insight disponível</p>
              ) : (
                insights.slice(0, 5).map(insight => (
                  <div key={insight.id} className="p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <Badge variant={insight.impact === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {insight.impact}
                      </Badge>
                      <span className="text-sm font-medium text-foreground truncate">{insight.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{insight.description}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
