/**
 * Financial Dashboard Widgets — Real data from platform_financial_entries + invoices
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign, TrendingUp, CreditCard, BarChart3,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--accent))',
];

function formatBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface FinancialData {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  revenueByPlan: { name: string; count: number; mrr: number }[];
  loaded: boolean;
}

function useFinancialData(): FinancialData {
  const [data, setData] = useState<FinancialData>({
    mrr: 0, arr: 0, activeSubscriptions: 0, revenueByPlan: [], loaded: false,
  });

  useEffect(() => {
    (async () => {
      const [tpRes, plansRes] = await Promise.all([
        supabase.from('tenant_plans').select('*, saas_plans(name, price)').eq('status', 'active'),
        supabase.from('saas_plans').select('id, name, price').eq('is_active', true),
      ]);

      const activePlans = tpRes.data ?? [];
      const plans = plansRes.data ?? [];

      const mrr = activePlans.reduce((s, tp) => {
        const price = Number((tp as any).saas_plans?.price ?? 0);
        const cycle = tp.billing_cycle;
        if (cycle === 'annual' || cycle === 'yearly') return s + price / 12;
        if (cycle === 'quarterly') return s + price / 3;
        return s + price;
      }, 0);

      const revenueByPlan = plans.map(p => {
        const count = activePlans.filter(tp => tp.plan_id === p.id).length;
        return { name: p.name, count, mrr: count * Number(p.price) };
      }).filter(r => r.count > 0);

      setData({
        mrr,
        arr: mrr * 12,
        activeSubscriptions: activePlans.length,
        revenueByPlan,
        loaded: true,
      });
    })();
  }, []);

  return data;
}

export function MRRWidget() {
  const { mrr, loaded } = useFinancialData();
  if (!loaded) return <WidgetSkeleton label="MRR" />;
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">MRR</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
        </div>
        <p className="text-2xl font-bold font-display text-foreground">{formatBRL(mrr)}</p>
        <p className="text-xs text-muted-foreground mt-1">Receita mensal recorrente</p>
      </CardContent>
    </Card>
  );
}

export function ARRWidget() {
  const { arr, loaded } = useFinancialData();
  if (!loaded) return <WidgetSkeleton label="ARR" />;
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ARR</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
        </div>
        <p className="text-2xl font-bold font-display text-foreground">{formatBRL(arr)}</p>
        <p className="text-xs text-muted-foreground mt-1">Receita anual recorrente</p>
      </CardContent>
    </Card>
  );
}

export function ActiveSubscriptionsWidget() {
  const { activeSubscriptions, mrr, loaded } = useFinancialData();
  if (!loaded) return <WidgetSkeleton label="Assinaturas" />;
  const arpa = activeSubscriptions > 0 ? mrr / activeSubscriptions : 0;
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Assinaturas Ativas</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <CreditCard className="h-4 w-4 text-amber-600" />
          </div>
        </div>
        <p className="text-2xl font-bold font-display text-foreground">{activeSubscriptions}</p>
        <p className="text-xs text-muted-foreground mt-1">ARPA: {formatBRL(arpa)}</p>
      </CardContent>
    </Card>
  );
}

export function RevenueByPlanChart() {
  const { revenueByPlan, loaded } = useFinancialData();
  if (!loaded) return <Card><CardContent className="pt-5"><Skeleton className="h-64 w-full" /></CardContent></Card>;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Receita por Plano
        </CardTitle>
      </CardHeader>
      <CardContent>
        {revenueByPlan.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Sem assinaturas ativas.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={revenueByPlan}
                dataKey="mrr"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                label={({ name, count }) => `${name} (${count})`}
              >
                {revenueByPlan.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatBRL(v)} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function WidgetSkeleton({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-3 w-36" />
      </CardContent>
    </Card>
  );
}
