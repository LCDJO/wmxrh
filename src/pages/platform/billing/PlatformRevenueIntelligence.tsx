/**
 * PlatformRevenueIntelligence — Revenue Intelligence + Referral & Gamification Dashboard
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, DollarSign, Users, AlertTriangle, ArrowUpRight, Link2,
  Trophy, Star, Zap, RefreshCw, Copy, Shield, Target, Crown,
} from 'lucide-react';
import { toast } from 'sonner';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type {
  RevenueMetrics,
  RevenueForecast,
  ChurnRiskTenant,
  UpgradeCandidate,
  ReferralLink,
  GamificationLeaderboardEntry,
} from '@/domains/revenue-intelligence';

const TIER_COLORS: Record<string, string> = {
  bronze: 'hsl(30 60% 50%)',
  silver: 'hsl(0 0% 65%)',
  gold: 'hsl(45 90% 50%)',
  platinum: 'hsl(200 30% 60%)',
  diamond: 'hsl(200 80% 60%)',
};

const TIER_ICONS: Record<string, typeof Star> = {
  bronze: Star,
  silver: Shield,
  gold: Crown,
  platinum: Trophy,
  diamond: Zap,
};

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export default function PlatformRevenueIntelligence() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [forecast, setForecast] = useState<RevenueForecast[]>([]);
  const [trend, setTrend] = useState<{ month: string; mrr: number; tenants: number }[]>([]);
  const [churnRisks, setChurnRisks] = useState<ChurnRiskTenant[]>([]);
  const [upgradeCandidates, setUpgradeCandidates] = useState<UpgradeCandidate[]>([]);
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [leaderboard, setLeaderboard] = useState<GamificationLeaderboardEntry[]>([]);

  const engine = getRevenueIntelligenceEngine();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [m, f, t, cr, uc, rl, lb] = await Promise.all([
        engine.analyzer.getMetrics(),
        engine.analyzer.getForecast(6),
        engine.analyzer.getMonthlyTrend(6),
        engine.churn.getAtRiskTenants(),
        engine.upgrade.getCandidates(),
        engine.referral.getLinks(),
        engine.gamification.getLeaderboard(10),
      ]);
      setMetrics(m);
      setForecast(f);
      setTrend(t);
      setChurnRisks(cr);
      setUpgradeCandidates(uc);
      setReferralLinks(rl);
      setLeaderboard(lb);
    } catch (e) {
      console.error('Revenue Intelligence fetch error:', e);
      toast.error('Erro ao carregar dados de Revenue Intelligence');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Revenue Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análise de receita, previsão de crescimento, referrals e gamificação.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { fetchAll(); toast.success('Atualizado'); }}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard icon={DollarSign} label="MRR" value={formatBRL(metrics.mrr)} accent="primary" />
          <KPICard icon={TrendingUp} label="Crescimento" value={`${metrics.growth_rate_pct}%`} accent="emerald" />
          <KPICard icon={Users} label="Tenants Pagantes" value={String(metrics.paying_tenants)} accent="amber" />
          <KPICard icon={Target} label="LTV Estimado" value={formatBRL(metrics.ltv_estimate)} accent="violet" />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analytics" className="gap-2"><TrendingUp className="h-3.5 w-3.5" /> Analytics</TabsTrigger>
          <TabsTrigger value="churn" className="gap-2"><AlertTriangle className="h-3.5 w-3.5" /> Churn</TabsTrigger>
          <TabsTrigger value="referrals" className="gap-2"><Link2 className="h-3.5 w-3.5" /> Referrals</TabsTrigger>
          <TabsTrigger value="gamification" className="gap-2"><Trophy className="h-3.5 w-3.5" /> Gamificação</TabsTrigger>
        </TabsList>

        {/* ── Analytics Tab ── */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Receita Mensal (Trend)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue Forecast */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Previsão de Receita (6 meses)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={forecast}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Bar dataKey="confidence_low" fill="hsl(var(--muted))" radius={[2, 2, 0, 0]} name="Pessimista" />
                    <Bar dataKey="projected_mrr" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Base" />
                    <Bar dataKey="confidence_high" fill="hsl(142 76% 36%)" radius={[2, 2, 0, 0]} name="Otimista" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Metrics Summary */}
          {metrics && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Métricas Detalhadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <MetricItem label="ARR" value={formatBRL(metrics.arr)} />
                  <MetricItem label="ARPA" value={formatBRL(metrics.arpa)} />
                  <MetricItem label="NRR" value={`${metrics.net_revenue_retention_pct.toFixed(1)}%`} />
                  <MetricItem label="Churn Rate" value={`${metrics.churn_rate_pct.toFixed(1)}%`} />
                  <MetricItem label="Ledger Total" value={formatBRL(metrics.ledger_total_brl)} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Revenue by Plan + by Module */}
          {metrics && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Receita por Plano</CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.revenue_by_plan.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Sem dados de planos ativos.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={metrics.revenue_by_plan} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <YAxis dataKey="plan_name" type="category" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={100} />
                        <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                        <Bar dataKey="mrr" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="MRR" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Receita por Módulo</CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.revenue_by_module.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Sem dados de uso por módulo.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={metrics.revenue_by_module} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <YAxis dataKey="module_id" type="category" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={100} />
                        <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                        <Bar dataKey="total_brl" fill="hsl(142 76% 36%)" radius={[0, 4, 4, 0]} name="Total" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Upgrade Candidates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" /> Candidatos a Upgrade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upgradeCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum candidato identificado.</p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {upgradeCandidates.map(c => (
                      <div key={c.tenant_id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div>
                          <p className="text-sm font-medium text-foreground">{c.tenant_name}</p>
                          <p className="text-xs text-muted-foreground">{c.current_plan} → {c.recommended_plan}</p>
                          <div className="flex gap-1 mt-1">
                            {c.signals.map(s => (
                              <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">+{formatBRL(c.potential_uplift_brl)}</p>
                          <Progress value={c.usage_pct} className="w-20 h-1.5 mt-1" />
                          <p className="text-[10px] text-muted-foreground mt-0.5">{c.usage_pct}% uso</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Churn Tab ── */}
        <TabsContent value="churn" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-5">
                <div className="text-2xl font-bold text-foreground">{churnRisks.length}</div>
                <div className="text-xs text-muted-foreground">Tenants em Risco</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-2xl font-bold text-destructive">
                  {formatBRL(churnRisks.reduce((s, r) => s + r.mrr_at_risk, 0))}
                </div>
                <div className="text-xs text-muted-foreground">MRR em Risco</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-2xl font-bold text-foreground">
                  {churnRisks.filter(r => r.risk_score > 60).length}
                </div>
                <div className="text-xs text-muted-foreground">Risco Crítico</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tenants em Risco de Churn</CardTitle>
            </CardHeader>
            <CardContent>
              {churnRisks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente em risco identificado. 🎉</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {churnRisks.map(r => (
                      <div key={r.tenant_id} className="p-4 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">{r.tenant_name}</p>
                            <p className="text-xs text-muted-foreground">{r.plan_name}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant={r.risk_score > 60 ? 'destructive' : 'secondary'}>
                              Score: {r.risk_score}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">{formatBRL(r.mrr_at_risk)}/mês</p>
                          </div>
                        </div>
                        <Progress value={r.risk_score} className="h-1.5 mb-2" />
                        <div className="flex flex-wrap gap-1 mb-2">
                          {r.risk_factors.map(f => (
                            <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Último contato: {r.days_since_last_activity} dias
                          </span>
                          <Badge variant="outline" className="text-[10px]">{r.recommended_action}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Referrals Tab ── */}
        <TabsContent value="referrals" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <div className="text-2xl font-bold text-foreground">{referralLinks.length}</div>
                <div className="text-xs text-muted-foreground">Links Ativos</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-2xl font-bold text-foreground">
                  {referralLinks.reduce((s, l) => s + l.total_clicks, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Total Clicks</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-2xl font-bold text-foreground">
                  {referralLinks.reduce((s, l) => s + l.total_signups, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Signups via Referral</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-2xl font-bold text-foreground">
                  {referralLinks.reduce((s, l) => s + l.total_conversions, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Conversões</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Links de Referral</CardTitle>
            </CardHeader>
            <CardContent>
              {referralLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum link de referral criado.</p>
              ) : (
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {referralLinks.map(link => (
                      <div key={link.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-3 min-w-0">
                          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <code className="text-xs font-semibold text-foreground">{link.code}</code>
                            <p className="text-[10px] text-muted-foreground truncate">{link.url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className="flex gap-2 text-xs">
                              <span>{link.total_clicks} clicks</span>
                              <span>{link.total_signups} signups</span>
                              <span className="font-semibold">{link.total_conversions} conv.</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Reward: {formatBRL(link.total_reward_brl)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => { navigator.clipboard.writeText(link.url); toast.success('Link copiado!'); }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Gamification Tab ── */}
        <TabsContent value="gamification" className="space-y-4">
          {/* Tier Legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tiers de Gamificação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {Object.entries(TIER_COLORS).map(([tier, color]) => {
                  const TierIcon = TIER_ICONS[tier] ?? Star;
                  const thresholds = engine.rewards.getTierThresholds();
                  return (
                    <div key={tier} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border">
                      <TierIcon className="h-4 w-4" style={{ color }} />
                      <span className="text-xs font-semibold capitalize" style={{ color }}>{tier}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {thresholds[tier as keyof typeof thresholds]}+ pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Leaderboard — Top 10
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados no leaderboard ainda.</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, idx) => {
                    const color = TIER_COLORS[entry.current_tier] ?? 'hsl(var(--muted-foreground))';
                    const TierIcon = TIER_ICONS[entry.current_tier] ?? Star;
                    return (
                      <div key={entry.user_id} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 text-sm font-bold" style={{ borderColor: color, color }}>
                          {idx + 1}
                        </div>
                        <TierIcon className="h-4 w-4 shrink-0" style={{ color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-muted-foreground truncate">{entry.user_id.slice(0, 12)}...</p>
                          <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span>{entry.total_referrals} referrals</span>
                            <span>{entry.total_conversions} conv.</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-foreground">{entry.total_points} pts</p>
                          <Badge variant="outline" className="text-[10px] capitalize" style={{ borderColor: color, color }}>
                            {entry.current_tier}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, accent }: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  accent: string;
}) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    amber: 'bg-amber-500/10 text-amber-600',
    violet: 'bg-violet-500/10 text-violet-600',
  };
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2.5 ${colorMap[accent] ?? colorMap.primary}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold font-display text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border border-border text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between"><Skeleton className="h-8 w-56" /><Skeleton className="h-9 w-28" /></div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="pt-5"><Skeleton className="h-14 w-full" /></CardContent></Card>)}
      </div>
      <Card><CardContent className="pt-5"><Skeleton className="h-64 w-full" /></CardContent></Card>
    </div>
  );
}
