/**
 * GrowthControlCenter — Control Plane widget for growth metrics.
 * Shows: revenue forecast, top referrers, reward financial impact.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  TrendingUp, DollarSign, Users, Gift, AlertTriangle, ArrowUpRight, ArrowDownRight, Trophy,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface GrowthData {
  forecastMrr: number;
  currentMrr: number;
  mrrGrowthPct: number;
  totalRewardsBrl: number;
  pendingRewardsBrl: number;
  paidRewardsBrl: number;
  rewardImpactPct: number;
  topReferrers: Array<{
    userId: string;
    conversions: number;
    totalRewardBrl: number;
    linkCode: string;
  }>;
  forecastChart: Array<{ month: string; base: number; optimistic: number; pessimistic: number }>;
}

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function GrowthControlCenter() {
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [linksRes, rewardsRes, plansRes, tenantsRes] = await Promise.all([
        supabase.from('referral_links').select('id, referrer_user_id, code, total_conversions, total_reward_brl').order('total_conversions', { ascending: false }).limit(20),
        supabase.from('referral_rewards').select('id, referrer_user_id, amount_brl, status'),
        supabase.from('saas_plans').select('price').eq('is_active', true),
        supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);

      const avgPrice = plansRes.data?.length
        ? plansRes.data.reduce((s, p) => s + (Number(p.price) ?? 0), 0) / plansRes.data.length
        : 0;
      const tenantCount = tenantsRes.count ?? 0;
      const currentMrr = tenantCount * avgPrice;

      const rewards = rewardsRes.data ?? [];
      const totalRewardsBrl = rewards.reduce((s, r) => s + (r.amount_brl ?? 0), 0);
      const paidRewardsBrl = rewards.filter(r => r.status === 'paid').reduce((s, r) => s + (r.amount_brl ?? 0), 0);
      const pendingRewardsBrl = rewards.filter(r => r.status === 'pending').reduce((s, r) => s + (r.amount_brl ?? 0), 0);
      const rewardImpactPct = currentMrr > 0 ? (totalRewardsBrl / currentMrr) * 100 : 0;

      // Build forecast chart (12 months)
      const growthRate = 0.05; // 5% monthly baseline
      const forecastChart = Array.from({ length: 12 }, (_, i) => {
        const month = new Date();
        month.setMonth(month.getMonth() + i);
        const base = currentMrr * Math.pow(1 + growthRate, i + 1);
        return {
          month: month.toLocaleDateString('pt-BR', { month: 'short' }),
          base: Math.round(base),
          optimistic: Math.round(base * 1.2),
          pessimistic: Math.round(base * 0.8),
        };
      });

      const forecastMrr = forecastChart[11]?.base ?? currentMrr;
      const mrrGrowthPct = currentMrr > 0 ? ((forecastMrr - currentMrr) / currentMrr) * 100 : 0;

      // Top referrers
      const topReferrers = (linksRes.data ?? [])
        .filter(l => l.total_conversions > 0)
        .slice(0, 10)
        .map(l => ({
          userId: l.referrer_user_id,
          conversions: l.total_conversions,
          totalRewardBrl: l.total_reward_brl,
          linkCode: l.code,
        }));

      setData({
        forecastMrr,
        currentMrr,
        mrrGrowthPct,
        totalRewardsBrl,
        pendingRewardsBrl,
        paidRewardsBrl,
        rewardImpactPct,
        topReferrers,
        forecastChart,
      });
    } catch (e) {
      console.error('GrowthControlCenter load error:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-32" />
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={DollarSign}
          label="MRR Atual"
          value={formatBRL(data.currentMrr)}
          accent="primary"
        />
        <KPICard
          icon={TrendingUp}
          label="MRR Projetado (12m)"
          value={formatBRL(data.forecastMrr)}
          delta={`+${data.mrrGrowthPct.toFixed(1)}%`}
          deltaPositive
          accent="emerald"
        />
        <KPICard
          icon={Gift}
          label="Recompensas Totais"
          value={formatBRL(data.totalRewardsBrl)}
          subtitle={`${formatBRL(data.pendingRewardsBrl)} pendente`}
          accent="amber"
        />
        <KPICard
          icon={AlertTriangle}
          label="Impacto / MRR"
          value={`${data.rewardImpactPct.toFixed(1)}%`}
          subtitle="Recompensas vs Receita"
          accent={data.rewardImpactPct > 15 ? 'destructive' : 'muted'}
        />
      </div>

      {/* Revenue Forecast Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Receita Prevista — 12 Meses
          </CardTitle>
          <CardDescription className="text-xs">
            Projeção base 5%/mês com cenários otimista (+20%) e pessimista (-20%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.forecastChart}>
                <defs>
                  <linearGradient id="gcOptimistic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gcBase" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatBRL(v), '']}
                />
                <Area type="monotone" dataKey="pessimistic" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" fill="none" strokeWidth={1} name="Pessimista" />
                <Area type="monotone" dataKey="base" stroke="hsl(142 71% 45%)" fill="url(#gcBase)" strokeWidth={2} name="Base" />
                <Area type="monotone" dataKey="optimistic" stroke="hsl(var(--primary))" fill="url(#gcOptimistic)" strokeWidth={1.5} name="Otimista" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Referrers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top Indicantes
            </CardTitle>
            <CardDescription className="text-xs">Ranking por conversões</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px]">
              {data.topReferrers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Nenhuma conversão por referral ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.topReferrers.map((r, i) => (
                    <div
                      key={r.userId}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${
                        i === 0 ? 'bg-amber-500/20 text-amber-600' :
                        i === 1 ? 'bg-slate-400/20 text-slate-500' :
                        i === 2 ? 'bg-orange-500/20 text-orange-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{r.userId.slice(0, 12)}…</div>
                        <div className="text-[10px] text-muted-foreground">
                          Código: <Badge variant="outline" className="text-[9px] h-4">{r.linkCode}</Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold">{r.conversions} conv.</div>
                        <div className="text-[10px] text-muted-foreground">{formatBRL(r.totalRewardBrl)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Reward Financial Impact */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Impacto Financeiro das Recompensas
            </CardTitle>
            <CardDescription className="text-xs">Breakdown de custos com programa de indicações</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <ImpactRow label="Recompensas Pagas" value={data.paidRewardsBrl} total={data.totalRewardsBrl} color="emerald" />
              <ImpactRow label="Recompensas Pendentes" value={data.pendingRewardsBrl} total={data.totalRewardsBrl} color="amber" />
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total de Recompensas</span>
                <span className="text-sm font-bold">{formatBRL(data.totalRewardsBrl)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">MRR Atual</span>
                <span className="text-sm font-bold">{formatBRL(data.currentMrr)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Impacto % sobre MRR</span>
                <Badge variant={data.rewardImpactPct > 15 ? 'destructive' : data.rewardImpactPct > 8 ? 'secondary' : 'default'} className="text-xs">
                  {data.rewardImpactPct.toFixed(1)}%
                </Badge>
              </div>
            </div>

            {data.rewardImpactPct > 15 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs text-destructive">
                  <strong>Alerta:</strong> O custo de recompensas excede 15% do MRR. Revise limites e verifique possíveis abusos no Governance AI.
                </div>
              </div>
            )}

            {data.rewardImpactPct <= 8 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <ArrowUpRight className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-700 dark:text-emerald-400">
                  Programa de indicações saudável — custo abaixo de 8% do MRR.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, delta, deltaPositive, subtitle, accent }: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  subtitle?: string;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 text-${accent === 'primary' ? 'primary' : accent === 'emerald' ? 'emerald-500' : accent === 'amber' ? 'amber-500' : 'muted-foreground'}`} />
        </div>
        <div className="text-lg font-bold">{value}</div>
        {delta && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${deltaPositive ? 'text-emerald-600' : 'text-destructive'}`}>
            {deltaPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta}
          </div>
        )}
        {subtitle && <div className="text-[10px] text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

function ImpactRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatBRL(value)}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
