/**
 * BillingControlCenter — Painel de controle financeiro do Control Plane
 *
 * Mostra: cupons ativos, impacto financeiro, receita líquida vs descontos
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DollarSign, Tag, TrendingDown, TrendingUp, RefreshCw,
  BarChart3, PieChart, ArrowDownRight, ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, PieChart as RPieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(var(--accent))',
  'hsl(var(--secondary))',
  'hsl(var(--muted))',
];

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

interface CouponSummary {
  code: string;
  name: string;
  discount_type: string;
  discount_value: number;
  current_redemptions: number;
  max_redemptions: number | null;
  status: string;
  total_discount_brl: number;
}

interface FinancialImpact {
  total_revenue: number;
  total_discounts: number;
  total_overage: number;
  net_revenue: number;
  discount_ratio: number;
}

export default function BillingControlCenter() {
  const [coupons, setCoupons] = useState<CouponSummary[]>([]);
  const [impact, setImpact] = useState<FinancialImpact | null>(null);
  const [revenueByType, setRevenueByType] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [couponsRes, redemptionsRes, entriesRes] = await Promise.all([
        supabase.from('coupons').select('*').eq('status', 'active'),
        supabase.from('coupon_redemptions').select('*, coupons(code, name, discount_type, discount_value, current_redemptions, max_redemptions, status)'),
        supabase.from('platform_financial_entries').select('entry_type, amount, description'),
      ]);

      // Build coupon summaries
      const couponMap = new Map<string, CouponSummary>();
      for (const c of couponsRes.data ?? []) {
        couponMap.set(c.id, {
          code: c.code,
          name: c.name,
          discount_type: c.discount_type,
          discount_value: c.discount_value,
          current_redemptions: c.current_redemptions,
          max_redemptions: c.max_redemptions,
          status: c.status,
          total_discount_brl: 0,
        });
      }
      for (const r of redemptionsRes.data ?? []) {
        const couponData = (r as any).coupons;
        if (couponData) {
          const existing = couponMap.get(r.coupon_id);
          if (existing) {
            existing.total_discount_brl += Number(r.discount_applied_brl ?? 0);
          } else {
            couponMap.set(r.coupon_id, {
              code: couponData.code,
              name: couponData.name,
              discount_type: couponData.discount_type,
              discount_value: couponData.discount_value,
              current_redemptions: couponData.current_redemptions,
              max_redemptions: couponData.max_redemptions,
              status: couponData.status ?? 'inactive',
              total_discount_brl: Number(r.discount_applied_brl ?? 0),
            });
          }
        }
      }
      setCoupons(Array.from(couponMap.values()));

      // Financial impact from entries
      const entries = entriesRes.data ?? [];
      let totalRevenue = 0;
      let totalDiscounts = 0;
      let totalOverage = 0;
      const typeMap = new Map<string, number>();

      for (const e of entries) {
        const amount = Number(e.amount);
        const type = e.entry_type as string;
        typeMap.set(type, (typeMap.get(type) ?? 0) + amount);

        if (type === 'subscription' || type === 'plan_charge' || type === 'upgrade') {
          totalRevenue += amount;
        } else if (type === 'coupon_discount' || type === 'credit') {
          totalDiscounts += amount;
        } else if (type === 'usage_overage') {
          totalOverage += amount;
        } else if (type === 'payment') {
          totalRevenue += amount;
        }
      }

      const netRevenue = totalRevenue + totalOverage - totalDiscounts;
      setImpact({
        total_revenue: totalRevenue,
        total_discounts: totalDiscounts,
        total_overage: totalOverage,
        net_revenue: netRevenue,
        discount_ratio: totalRevenue > 0 ? (totalDiscounts / totalRevenue) * 100 : 0,
      });

      // Revenue by type for chart
      const LABELS: Record<string, string> = {
        subscription: 'Assinatura',
        plan_charge: 'Cobrança Plano',
        upgrade: 'Upgrade',
        payment: 'Pagamento',
        coupon_discount: 'Desconto Cupom',
        usage_overage: 'Excedente Uso',
        credit: 'Crédito',
        refund: 'Reembolso',
        adjustment: 'Ajuste',
        downgrade: 'Downgrade',
      };
      setRevenueByType(
        Array.from(typeMap.entries())
          .filter(([, v]) => v > 0)
          .map(([k, v]) => ({ name: LABELS[k] ?? k, value: v }))
          .sort((a, b) => b.value - a.value)
      );
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados do Control Center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <ControlCenterSkeleton />;

  const pieData = impact ? [
    { name: 'Receita Bruta', value: impact.total_revenue },
    { name: 'Descontos', value: impact.total_discounts },
    { name: 'Excedente Uso', value: impact.total_overage },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Billing Control Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Painel consolidado de impacto financeiro, cupons e receita líquida.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { fetchData(); toast.success('Atualizado'); }}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
          label="Receita Bruta"
          value={formatBRL(impact?.total_revenue ?? 0)}
          accent="bg-primary/10"
        />
        <KPICard
          icon={<TrendingDown className="h-5 w-5 text-destructive" />}
          label="Descontos Totais"
          value={formatBRL(impact?.total_discounts ?? 0)}
          accent="bg-destructive/10"
          subtitle={impact ? `${impact.discount_ratio.toFixed(1)}% da receita` : undefined}
        />
        <KPICard
          icon={<ArrowUpRight className="h-5 w-5 text-accent-foreground" />}
          label="Excedente de Uso"
          value={formatBRL(impact?.total_overage ?? 0)}
          accent="bg-accent/10"
        />
        <KPICard
          icon={<DollarSign className="h-5 w-5 text-primary" />}
          label="Receita Líquida"
          value={formatBRL(impact?.net_revenue ?? 0)}
          accent="bg-primary/10"
          highlight
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue by Type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Receita por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByType.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados financeiros.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenueByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <RechartsTooltip
                    formatter={(v: number) => formatBRL(v)}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue vs Discounts Pie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <PieChart className="h-4 w-4" /> Receita vs Descontos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados financeiros.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <RPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                  />
                  <RechartsTooltip
                    formatter={(v: number) => formatBRL(v)}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  />
                </RPieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Coupons Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Tag className="h-4 w-4" /> Cupons Ativos
            <Badge variant="secondary" className="text-[10px] ml-1">{coupons.filter(c => c.status === 'active').length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cupom encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Código</TableHead>
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Desconto</TableHead>
                    <TableHead className="text-xs">Usos</TableHead>
                    <TableHead className="text-xs">Impacto (R$)</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map(c => (
                    <TableRow key={c.code}>
                      <TableCell className="font-mono font-semibold text-foreground text-xs">{c.code}</TableCell>
                      <TableCell className="text-xs">{c.name}</TableCell>
                      <TableCell className="text-xs">
                        {c.discount_type === 'percentage' ? 'Percentual' : c.discount_type === 'fixed_amount' ? 'Fixo' : 'Meses Grátis'}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {c.discount_type === 'percentage' ? `${c.discount_value}%` : formatBRL(c.discount_value)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.current_redemptions}{c.max_redemptions ? `/${c.max_redemptions}` : ''}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        <span className="text-destructive flex items-center gap-1">
                          <ArrowDownRight className="h-3 w-3" />
                          {formatBRL(c.total_discount_brl)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={c.status === 'active' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {c.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ icon, label, value, accent, subtitle, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'ring-1 ring-primary/30' : ''}>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2.5 ${accent}`}>{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold font-display text-foreground">{value}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ControlCenterSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-80 mt-2" /></div>
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
