import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert, TrendingUp, HeartPulse, AlertTriangle,
  Building2, DollarSign, Scale, Activity, Users,
  Gavel, BarChart3, Stethoscope, PieChart,
} from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import { useCompanies, useEmployeesSimple } from '@/domains/hooks';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, LineChart, Line, CartesianGrid,
  PieChart as RePieChart, Pie, Cell,
} from 'recharts';

// Fetch workforce insights from DB
function useWorkforceInsights(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['workforce-insights', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('workforce_insights')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('criado_em', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });
}

export default function WorkforceIntelligenceDashboard() {
  const { currentTenant } = useTenant();
  const { scope } = useScope();
  const { data: insights = [] } = useWorkforceInsights(currentTenant?.id);
  const { data: companies = [] } = useCompanies();
  const { data: employees = [] } = useEmployeesSimple();

  const scopedInsights = useMemo(() => {
    if (scope.level === 'company' && scope.companyId) {
      return insights.filter((i: any) => i.company_id === scope.companyId);
    }
    if (scope.level === 'group' && scope.groupId) {
      return insights.filter((i: any) => i.group_id === scope.groupId);
    }
    return insights;
  }, [insights, scope]);

  const scopedEmployees = useMemo(() => {
    if (scope.level === 'company' && scope.companyId) {
      return employees.filter(e => e.company_id === scope.companyId);
    }
    if (scope.level === 'group' && scope.groupId) {
      const groupCompanyIds = companies.filter(c => c.company_group_id === scope.groupId).map(c => c.id);
      return employees.filter(e => groupCompanyIds.includes(e.company_id));
    }
    return employees;
  }, [employees, scope, companies]);

  const activeEmps = scopedEmployees.filter(e => e.status === 'active');
  const totalPayroll = activeEmps.reduce((s, e) => s + (e.current_salary || 0), 0);

  if (scope.level === 'company') {
    return <CompanyView insights={scopedInsights} employees={activeEmps} totalPayroll={totalPayroll} />;
  }

  if (scope.level === 'group') {
    return <GroupView insights={scopedInsights} companies={companies.filter(c => c.company_group_id === scope.groupId)} employees={activeEmps} />;
  }

  return (
    <TenantView
      insights={scopedInsights}
      employees={activeEmps}
      companies={companies}
      totalPayroll={totalPayroll}
      tenantName={currentTenant?.name}
    />
  );
}

// ── Tenant View ──
function TenantView({ insights, employees, companies, totalPayroll, tenantName }: {
  insights: any[]; employees: any[]; companies: any[]; totalPayroll: number; tenantName?: string;
}) {
  const criticalCount = insights.filter((i: any) => i.severity === 'critical').length;
  const warningCount = insights.filter((i: any) => i.severity === 'warning').length;
  const totalExposure = insights.reduce((s: number, i: any) => {
    return s + ((i.dados_origem_json as any)?.financial_exposure ?? 0);
  }, 0);

  const latestHealthScore = useMemo(() => {
    const withScore = insights.find((i: any) => (i.dados_origem_json as any)?.health_score);
    return (withScore as any)?.dados_origem_json?.health_score?.overall_score ?? null;
  }, [insights]);

  // Salary distribution buckets
  const salaryDistribution = useMemo(() => {
    const buckets = [
      { name: 'Até 2k', min: 0, max: 2000, count: 0 },
      { name: '2k–5k', min: 2000, max: 5000, count: 0 },
      { name: '5k–10k', min: 5000, max: 10000, count: 0 },
      { name: '10k–20k', min: 10000, max: 20000, count: 0 },
      { name: '20k+', min: 20000, max: Infinity, count: 0 },
    ];
    for (const e of employees) {
      const sal = e.current_salary || 0;
      const bucket = buckets.find(b => sal >= b.min && sal < b.max);
      if (bucket) bucket.count++;
    }
    return buckets.filter(b => b.count > 0);
  }, [employees]);

  const PIE_COLORS = [
    'hsl(160, 84%, 29%)', 'hsl(210, 100%, 52%)', 'hsl(38, 92%, 50%)',
    'hsl(280, 60%, 50%)', 'hsl(0, 72%, 51%)',
  ];

  // Legal risk insights
  const legalRisks = insights.filter((i: any) =>
    i.insight_type === 'LEGAL_RISK' || i.insight_type === 'COMPLIANCE_WARNING'
  );

  // Health-related
  const healthInsights = insights.filter((i: any) =>
    i.insight_type === 'HEALTH_RISK' || i.insight_type === 'PCMSO_WARNING'
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Inteligência Trabalhista</h1>
        <p className="text-muted-foreground mt-1">Visão executiva — {tenantName}</p>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Custo Total Projetado"
          value={totalPayroll > 0 ? `R$ ${(totalPayroll / 1000).toFixed(0)}k` : 'R$ 0'}
          subtitle="folha mensal ativa"
          icon={DollarSign}
        />
        <StatsCard
          title="Riscos Críticos"
          value={criticalCount}
          subtitle={warningCount > 0 ? `${warningCount} alertas` : 'nenhum alerta'}
          icon={ShieldAlert}
          className={criticalCount > 0 ? 'border-l-4 border-l-destructive' : ''}
        />
        <StatsCard
          title="Exposição Financeira"
          value={totalExposure > 0 ? `R$ ${(totalExposure / 1000).toFixed(0)}k` : 'R$ 0'}
          subtitle="passivo estimado"
          icon={AlertTriangle}
        />
        <StatsCard
          title="Colaboradores Ativos"
          value={employees.length}
          subtitle={`${companies.length} empresas`}
          icon={Users}
        />
      </div>

      {/* 4 Themed Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1 — Risco Legal */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in border-t-4 border-t-destructive/60">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
              <Gavel className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold font-display text-card-foreground">Risco Legal</h2>
              <p className="text-xs text-muted-foreground">{legalRisks.length} alerta{legalRisks.length !== 1 ? 's' : ''} detectado{legalRisks.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {legalRisks.length > 0 ? (
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {legalRisks.slice(0, 6).map((alert: any) => (
                <div key={alert.id} className={`p-3 rounded-lg border ${alert.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-secondary/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block h-2 w-2 rounded-full ${alert.severity === 'critical' ? 'bg-destructive' : 'bg-warning'}`} />
                    <span className="text-xs font-semibold uppercase text-muted-foreground">{alert.insight_type?.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-sm text-card-foreground leading-snug">{alert.descricao}</p>
                  {(alert.dados_origem_json as any)?.recommended_action && (
                    <p className="text-xs text-muted-foreground mt-1">→ {(alert.dados_origem_json as any).recommended_action}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">Nenhum risco legal detectado.</p>
            </div>
          )}
        </div>

        {/* 2 — Projeção Financeira */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in border-t-4 border-t-warning/60">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
              <BarChart3 className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h2 className="text-lg font-semibold font-display text-card-foreground">Projeção Financeira</h2>
              <p className="text-xs text-muted-foreground">Exposição e custo projetado</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <p className="text-2xl font-bold font-display text-card-foreground">
                R$ {totalPayroll > 0 ? (totalPayroll / 1000).toFixed(0) : '0'}k
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Folha mensal</p>
            </div>
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-center">
              <p className="text-2xl font-bold font-display text-destructive">
                R$ {totalExposure > 0 ? (totalExposure / 1000).toFixed(0) : '0'}k
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Exposição estimada</p>
            </div>
          </div>
          <RiskList insights={insights.filter(i => (i.dados_origem_json as any)?.financial_exposure > 0)} maxItems={4} />
        </div>

        {/* 3 — Saúde Ocupacional */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in border-t-4 border-t-primary/60">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <Stethoscope className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold font-display text-card-foreground">Saúde Ocupacional</h2>
              <p className="text-xs text-muted-foreground">Score e alertas PCMSO</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {/* Gauge */}
            <div className="flex-shrink-0 w-40">
              {latestHealthScore != null ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={120}>
                    <RadialBarChart
                      cx="50%" cy="80%" innerRadius="65%" outerRadius="95%" barSize={12}
                      data={[{
                        name: 'Score', value: latestHealthScore,
                        fill: latestHealthScore >= 70 ? 'hsl(160, 84%, 29%)' : latestHealthScore >= 50 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 51%)',
                      }]}
                      startAngle={180} endAngle={0}
                    >
                      <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'hsl(var(--muted))' }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="-mt-8 text-center">
                    <p className="text-3xl font-bold font-display text-card-foreground">{latestHealthScore}</p>
                    <p className="text-xs text-muted-foreground">de 100</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <p className="text-xs text-muted-foreground text-center">Execute a análise para gerar o score.</p>
                </div>
              )}
            </div>
            {/* Health alerts */}
            <div className="flex-1 min-w-0">
              {healthInsights.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {healthInsights.slice(0, 4).map((h: any) => (
                    <div key={h.id} className="flex items-start gap-2 p-2 rounded-md bg-secondary/30 border border-border">
                      <HeartPulse className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <p className="text-xs text-card-foreground leading-snug">{h.descricao}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <p className="text-xs text-muted-foreground">Nenhum alerta de saúde.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4 — Distribuição Salarial */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in border-t-4 border-t-info/60">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10">
              <PieChart className="h-5 w-5 text-info" />
            </div>
            <div>
              <h2 className="text-lg font-semibold font-display text-card-foreground">Distribuição Salarial</h2>
              <p className="text-xs text-muted-foreground">{employees.length} colaboradores ativos</p>
            </div>
          </div>
          {salaryDistribution.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <RePieChart>
                  <Pie
                    data={salaryDistribution}
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={70}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="name"
                  >
                    {salaryDistribution.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, name]} />
                </RePieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {salaryDistribution.map((b, idx) => (
                  <div key={b.name} className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{b.name}</span>
                    <span className="text-xs font-semibold text-card-foreground">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-muted-foreground">Sem dados salariais.</p>
            </div>
          )}
        </div>

      </div>

      {/* Full risk list */}
      <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold font-display text-card-foreground">Todos os Riscos</h2>
        </div>
        <RiskList insights={insights} maxItems={10} />
      </div>
    </div>
  );
}

// ── Group View ──
function GroupView({ insights, companies, employees }: { insights: any[]; companies: any[]; employees: any[] }) {
  const costByCompany = useMemo(() => {
    return companies.map(c => {
      const compEmps = employees.filter(e => e.company_id === c.id);
      const cost = compEmps.reduce((s: number, e: any) => s + (e.current_salary || 0), 0);
      return { name: c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name, custo: cost };
    }).filter(c => c.custo > 0).sort((a, b) => b.custo - a.custo);
  }, [companies, employees]);

  const risksByCompany = useMemo(() => {
    return companies.map(c => ({
      name: c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name,
      critical: insights.filter(i => i.company_id === c.id && i.severity === 'critical').length,
      warning: insights.filter(i => i.company_id === c.id && i.severity === 'warning').length,
    })).filter(c => c.critical + c.warning > 0);
  }, [companies, insights]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Inteligência Trabalhista — Grupo</h1>
        <p className="text-muted-foreground mt-1">Ranking e riscos por unidade</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatsCard title="Empresas" value={companies.length} icon={Building2} />
        <StatsCard title="Colaboradores" value={employees.length} icon={Users} />
        <StatsCard title="Riscos Detectados" value={insights.length} subtitle={`${insights.filter(i => i.severity === 'critical').length} críticos`} icon={ShieldAlert} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Ranking por Custo</h2>
          </div>
          {costByCompany.length > 0 ? (
            <ResponsiveContainer width="100%" height={costByCompany.length * 50 + 30}>
              <BarChart data={costByCompany} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Custo']} />
                <Bar dataKey="custo" fill="hsl(160, 84%, 29%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de custo.</p>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Riscos por Unidade</h2>
          </div>
          {risksByCompany.length > 0 ? (
            <ResponsiveContainer width="100%" height={risksByCompany.length * 50 + 30}>
              <BarChart data={risksByCompany} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <Tooltip />
                <Bar dataKey="critical" stackId="a" fill="hsl(0, 72%, 51%)" name="Crítico" />
                <Bar dataKey="warning" stackId="a" fill="hsl(38, 92%, 50%)" name="Alerta" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum risco detectado.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Company View ──
function CompanyView({ insights, employees, totalPayroll }: { insights: any[]; employees: any[]; totalPayroll: number }) {
  const legalAlerts = insights.filter((i: any) => i.insight_type === 'LEGAL_RISK' || i.insight_type === 'COMPLIANCE_WARNING');

  const salaryTrend = useMemo(() => {
    const months: Record<string, { total: number; count: number }> = {};
    for (const e of employees) {
      if (!e.hire_date || !e.current_salary) continue;
      const month = e.hire_date.slice(0, 7);
      if (!months[month]) months[month] = { total: 0, count: 0 };
      months[month].total += e.current_salary;
      months[month].count++;
    }
    return Object.entries(months)
      .map(([month, d]) => ({ month, media: Math.round(d.total / d.count) }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [employees]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Inteligência Trabalhista — Empresa</h1>
        <p className="text-muted-foreground mt-1">Alertas legais e tendência salarial</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatsCard title="Folha Mensal" value={`R$ ${(totalPayroll / 1000).toFixed(0)}k`} icon={DollarSign} />
        <StatsCard title="Alertas Legais" value={legalAlerts.length} subtitle={legalAlerts.filter(a => a.severity === 'critical').length + ' críticos'} icon={Scale} className={legalAlerts.some(a => a.severity === 'critical') ? 'border-l-4 border-l-destructive' : ''} />
        <StatsCard title="Colaboradores" value={employees.length} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Alertas Legais</h2>
          </div>
          {legalAlerts.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {legalAlerts.map((alert: any) => (
                <div key={alert.id} className={`p-3 rounded-lg border ${alert.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-secondary/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block h-2 w-2 rounded-full ${alert.severity === 'critical' ? 'bg-destructive' : 'bg-warning'}`} />
                    <span className="text-xs font-semibold uppercase text-muted-foreground">{alert.insight_type}</span>
                  </div>
                  <p className="text-sm text-card-foreground">{alert.descricao}</p>
                  {(alert.dados_origem_json as any)?.recommended_action && (
                    <p className="text-xs text-muted-foreground mt-1">→ {(alert.dados_origem_json as any).recommended_action}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum alerta legal.</p>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Tendência Salarial</h2>
          </div>
          {salaryTrend.length > 2 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={salaryTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Média']} />
                <Line type="monotone" dataKey="media" stroke="hsl(160, 84%, 29%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Dados insuficientes para tendência.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared Risk List ──
function RiskList({ insights, maxItems = 10 }: { insights: any[]; maxItems?: number }) {
  if (insights.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Nenhum risco detectado.</p>;
  }

  return (
    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
      {insights.slice(0, maxItems).map((i: any) => (
        <div key={i.id} className={`flex items-start gap-3 p-3 rounded-lg border ${i.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' : i.severity === 'warning' ? 'border-warning/30 bg-warning/5' : 'border-border'}`}>
          <span className={`mt-0.5 inline-block h-2.5 w-2.5 rounded-full shrink-0 ${i.severity === 'critical' ? 'bg-destructive' : i.severity === 'warning' ? 'bg-warning' : 'bg-info'}`} />
          <div className="min-w-0">
            <p className="text-sm text-card-foreground leading-snug">{i.descricao}</p>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-muted-foreground">{i.insight_type?.replace(/_/g, ' ')}</span>
              {(i.dados_origem_json as any)?.financial_exposure > 0 && (
                <span className="text-xs font-medium text-destructive">R$ {((i.dados_origem_json as any).financial_exposure / 1000).toFixed(0)}k exposição</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
