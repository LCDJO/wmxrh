/**
 * PlatformRevenue — Dashboard de receita (Real Data)
 * MRR, receita por plano, tendências — tudo do banco real.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, DollarSign, Users, ArrowUpRight, RefreshCw, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import RevenueForecastChart from '@/components/platform/widgets/RevenueForecastChart';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(142 76% 36%)',
  'hsl(38 92% 50%)',
  'hsl(0 84% 60%)',
  'hsl(262 83% 58%)',
];

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export default function PlatformRevenue() {
  const [loading, setLoading] = useState(true);
  const [tenantPlans, setTenantPlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [tpRes, invRes, entRes, plRes] = await Promise.all([
      supabase.from('tenant_plans').select('*, saas_plans(name, price)').eq('status', 'active'),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('platform_financial_entries').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('saas_plans').select('id, name, price').eq('is_active', true),
    ]);
    setTenantPlans(tpRes.data ?? []);
    setInvoices(invRes.data ?? []);
    setEntries(entRes.data ?? []);
    setPlans(plRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Compute metrics from real data ──
  const activePlans = tenantPlans.filter(tp => tp.status === 'active');

  // MRR: sum of active plans' monthly price
  const mrr = activePlans.reduce((s, tp) => {
    const price = Number((tp as any).saas_plans?.price ?? 0);
    const cycle = tp.billing_cycle;
    if (cycle === 'annual' || cycle === 'yearly') return s + price / 12;
    if (cycle === 'quarterly') return s + price / 3;
    return s + price;
  }, 0);

  const arr = mrr * 12;
  const payingTenants = activePlans.length;
  const arpa = payingTenants > 0 ? mrr / payingTenants : 0;

  // Revenue by plan
  const revenueByPlan = plans.map(p => {
    const count = activePlans.filter(tp => tp.plan_id === p.id).length;
    return { name: p.name, count, mrr: count * Number(p.price) };
  }).filter(r => r.count > 0);

  // Monthly revenue from invoices (last 6 months)
  const monthlyRevenue: { month: string; total: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    const total = invoices
      .filter(inv => inv.status === 'paid' && inv.paid_at && inv.paid_at.startsWith(key))
      .reduce((s, inv) => s + Number(inv.total_amount), 0);
    monthlyRevenue.push({ month: label, total });
  }

  // Entry type breakdown
  const entryBreakdown = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.entry_type] = (acc[e.entry_type] ?? 0) + Number(e.amount);
    return acc;
  }, {});
  const entryPieData = Object.entries(entryBreakdown).map(([name, value]) => ({ name, value }));

  if (loading) return <RevenueSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Revenue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas de receita recorrente — dados reais da plataforma.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { fetchData(); toast.success('Atualizado'); }}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">MRR</p>
                <p className="text-xl font-bold font-display text-foreground">{formatBRL(mrr)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2.5"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">ARR</p>
                <p className="text-xl font-bold font-display text-foreground">{formatBRL(arr)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2.5"><Users className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Tenants Pagantes</p>
                <p className="text-xl font-bold font-display text-foreground">{payingTenants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2.5"><ArrowUpRight className="h-5 w-5 text-violet-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">ARPA</p>
                <p className="text-xl font-bold font-display text-foreground">{formatBRL(arpa)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly Revenue Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Receita Mensal (Pago)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyRevenue.every(m => m.total === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados de pagamento ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    formatter={(v: number) => formatBRL(v)}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Plan Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Receita por Plano
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
                    outerRadius={90}
                    label={({ name, count }) => `${name} (${count})`}
                  >
                    {revenueByPlan.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Plan Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">Distribuição por Plano</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueByPlan.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Plano</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Tenants</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">MRR</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">% MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueByPlan.map((r, i) => (
                    <tr key={r.name} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {r.name}
                      </td>
                      <td className="py-2 px-3 text-right">{r.count}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatBRL(r.mrr)}</td>
                      <td className="py-2 px-3 text-right">{mrr > 0 ? `${((r.mrr / mrr) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entry type breakdown */}
      {entryPieData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Lançamentos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {entryPieData.map((e, i) => (
                <div key={e.name} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-xs font-medium">{e.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{formatBRL(e.value)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Forecast Widget */}
      <RevenueForecastChart />
    </div>
  );
}

function RevenueSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72 mt-2" /></div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="pt-5"><Skeleton className="h-14 w-full" /></CardContent></Card>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="pt-5"><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card><CardContent className="pt-5"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}
