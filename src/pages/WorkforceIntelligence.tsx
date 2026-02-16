import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert, TrendingUp, HeartPulse, AlertTriangle,
  Building2, DollarSign, Scale, Activity, Users,
} from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import { useCompanies, useEmployeesSimple } from '@/domains/hooks';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, Legend, LineChart, Line, CartesianGrid,
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

  // Stats
  const criticalCount = scopedInsights.filter((i: any) => i.severity === 'critical').length;
  const warningCount = scopedInsights.filter((i: any) => i.severity === 'warning').length;
  const totalExposure = scopedInsights.reduce((s: number, i: any) => {
    const exp = (i.dados_origem_json as any)?.financial_exposure ?? 0;
    return s + exp;
  }, 0);

  const activeEmps = scopedEmployees.filter(e => e.status === 'active');
  const totalPayroll = activeEmps.reduce((s, e) => s + (e.current_salary || 0), 0);

  // Health score from latest insight
  const latestHealthScore = useMemo(() => {
    const withScore = scopedInsights.find((i: any) => (i.dados_origem_json as any)?.health_score);
    return (withScore as any)?.dados_origem_json?.health_score?.overall_score ?? null;
  }, [scopedInsights]);

  const healthScoreData = latestHealthScore != null ? [
    { name: 'Score', value: latestHealthScore, fill: latestHealthScore >= 70 ? 'hsl(160, 84%, 29%)' : latestHealthScore >= 50 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 51%)' },
  ] : [];

  if (scope.level === 'company') {
    return <CompanyView insights={scopedInsights} employees={activeEmps} totalPayroll={totalPayroll} />;
  }

  if (scope.level === 'group') {
    return <GroupView insights={scopedInsights} companies={companies.filter(c => c.company_group_id === scope.groupId)} employees={activeEmps} />;
  }

  // Tenant level
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Inteligência da Força de Trabalho</h1>
        <p className="text-muted-foreground mt-1">Visão executiva — {currentTenant?.name}</p>
      </div>

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
          value={activeEmps.length}
          subtitle={`${companies.length} empresas`}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score Gauge */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <HeartPulse className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Saúde da Força de Trabalho</h2>
          </div>
          {latestHealthScore != null ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" barSize={14} data={healthScoreData} startAngle={180} endAngle={0}>
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'hsl(var(--muted))' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="-mt-16 text-center">
                <p className="text-4xl font-bold font-display text-card-foreground">{latestHealthScore}</p>
                <p className="text-sm text-muted-foreground">de 100</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-muted-foreground">Execute a análise para gerar o score.</p>
            </div>
          )}
        </div>

        {/* Risk Distribution */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Distribuição de Riscos</h2>
          </div>
          <RiskList insights={scopedInsights} />
        </div>
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
      const risks = insights.filter(i => i.company_id === c.id).length;
      return { name: c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name, custo: cost, riscos: risks };
    }).filter(c => c.custo > 0).sort((a, b) => b.custo - a.custo);
  }, [companies, employees, insights]);

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
        <h1 className="text-2xl font-bold font-display text-foreground">Inteligência — Grupo</h1>
        <p className="text-muted-foreground mt-1">Ranking e riscos por unidade</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatsCard title="Empresas" value={companies.length} icon={Building2} />
        <StatsCard title="Colaboradores" value={employees.length} icon={Users} />
        <StatsCard title="Riscos Detectados" value={insights.length} subtitle={`${insights.filter(i => i.severity === 'critical').length} críticos`} icon={ShieldAlert} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking by Cost */}
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

        {/* Risks by Unit */}
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
                <Bar dataKey="critical" stackId="a" fill="hsl(0, 72%, 51%)" name="Crítico" radius={[0, 0, 0, 0]} />
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

  // Salary trend (mock monthly from employees' hire dates)
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
        <h1 className="text-2xl font-bold font-display text-foreground">Inteligência — Empresa</h1>
        <p className="text-muted-foreground mt-1">Alertas legais e tendência salarial</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatsCard title="Folha Mensal" value={`R$ ${(totalPayroll / 1000).toFixed(0)}k`} icon={DollarSign} />
        <StatsCard title="Alertas Legais" value={legalAlerts.length} subtitle={legalAlerts.filter(a => a.severity === 'critical').length + ' críticos'} icon={Scale} className={legalAlerts.some(a => a.severity === 'critical') ? 'border-l-4 border-l-destructive' : ''} />
        <StatsCard title="Colaboradores" value={employees.length} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Legal Alerts */}
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

        {/* Salary Trend */}
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
function RiskList({ insights }: { insights: any[] }) {
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of insights) {
      const type = i.insight_type ?? 'OTHER';
      map[type] = (map[type] ?? 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [insights]);

  if (insights.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum risco detectado. Execute a análise.</p>;
  }

  return (
    <div className="space-y-3 max-h-72 overflow-y-auto">
      {insights.slice(0, 10).map((i: any) => (
        <div key={i.id} className={`flex items-start gap-3 p-3 rounded-lg border ${i.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' : i.severity === 'warning' ? 'border-warning/30 bg-warning/5' : 'border-border'}`}>
          <span className={`mt-0.5 inline-block h-2.5 w-2.5 rounded-full shrink-0 ${i.severity === 'critical' ? 'bg-destructive' : i.severity === 'warning' ? 'bg-warning' : 'bg-info'}`} />
          <div className="min-w-0">
            <p className="text-sm text-card-foreground leading-snug">{i.descricao}</p>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-muted-foreground">{i.insight_type}</span>
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
