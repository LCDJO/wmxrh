import { useMemo } from 'react';
import { Building2, Clock, DollarSign, AlertTriangle, Phone, CheckCircle2 } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { useEmployees, useCompanies, useCollectiveAgreements, useLaborRuleSets } from '@/domains/hooks';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const CHART_COLORS = [
  'hsl(160, 84%, 29%)',
  'hsl(210, 100%, 52%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 60%, 50%)',
  'hsl(25, 95%, 53%)',
];

export default function LegalDashboard() {
  const { data: employees = [] } = useEmployees();
  const { data: companies = [] } = useCompanies();
  const { data: agreements = [] } = useCollectiveAgreements();
  const { data: ruleSets = [] } = useLaborRuleSets();

  // ── 1. Horas Extras por Empresa (estimated from salary additionals of type overtime) ──
  const overtimeByCompany = useMemo(() => {
    const map: Record<string, { name: string; count: number; cost: number }> = {};
    companies.forEach(c => {
      map[c.id] = { name: c.name, count: 0, cost: 0 };
    });

    // Count employees with overtime-type additionals per company
    employees.forEach(emp => {
      const companyEntry = map[emp.company_id];
      if (!companyEntry) return;
      // Employees with base vs current salary difference as proxy for overtime cost
      const diff = (emp.current_salary ?? 0) - (emp.base_salary ?? 0);
      if (diff > 0) {
        companyEntry.count += 1;
        companyEntry.cost += diff;
      }
    });

    return Object.values(map)
      .filter(c => c.count > 0)
      .sort((a, b) => b.cost - a.cost);
  }, [employees, companies]);

  const totalOvertimeCost = useMemo(
    () => overtimeByCompany.reduce((s, c) => s + c.cost, 0),
    [overtimeByCompany]
  );

  // ── 2. Custos Adicionais Legais (from labor rule sets — rules with active definitions) ──
  const additionalCosts = useMemo(() => {
    const categoryCosts: Record<string, number> = {};
    ruleSets.forEach(rs => {
      (rs.labor_rule_definitions ?? [])
        .filter(d => d.is_active && !d.deleted_at)
        .forEach(d => {
          const label = getCategoryLabel(d.category);
          categoryCosts[label] = (categoryCosts[label] ?? 0) + 1;
        });
    });
    return Object.entries(categoryCosts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [ruleSets]);

  // ── 3. Empresas fora do piso salarial ──
  const companiesBelowFloor = useMemo(() => {
    const results: { company: string; employees: number; floor: number; minSalary: number }[] = [];

    companies.forEach(c => {
      // Find active agreement for this company
      const agreement = agreements.find(
        a => (a.company_id === c.id || (!a.company_id && !a.company_group_id)) && a.status === 'active'
      );
      if (!agreement?.salary_floor) return;

      const companyEmployees = employees.filter(e => e.company_id === c.id && e.status === 'active');
      const belowFloor = companyEmployees.filter(
        e => (e.base_salary ?? 0) > 0 && (e.base_salary ?? 0) < agreement.salary_floor!
      );

      if (belowFloor.length > 0) {
        const minSalary = Math.min(...belowFloor.map(e => e.base_salary ?? 0));
        results.push({
          company: c.name,
          employees: belowFloor.length,
          floor: agreement.salary_floor!,
          minSalary,
        });
      }
    });

    return results;
  }, [companies, employees, agreements]);

  // ── 4. Exposição a Plantões ──
  const onCallExposure = useMemo(() => {
    // Analyze rule sets that have plantao or sobreaviso rules
    const onCallRules: { ruleSetName: string; type: string; ruleName: string; limit: number | null }[] = [];
    ruleSets.forEach(rs => {
      (rs.labor_rule_definitions ?? [])
        .filter(d => (d.category === 'plantao' || d.category === 'sobreaviso') && d.is_active && !d.deleted_at)
        .forEach(d => {
          onCallRules.push({
            ruleSetName: rs.name,
            type: d.category === 'plantao' ? 'Plantão' : 'Sobreaviso',
            ruleName: d.name,
            limit: d.limite_horas,
          });
        });
    });
    return onCallRules;
  }, [ruleSets]);

  // ── KPI counts ──
  const totalEmployeesWithOvertime = overtimeByCompany.reduce((s, c) => s + c.count, 0);
  const totalActiveRules = ruleSets.reduce(
    (s, rs) => s + (rs.labor_rule_definitions ?? []).filter(d => d.is_active && !d.deleted_at).length,
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Dashboard Legal</h1>
        <p className="text-muted-foreground mt-1">Indicadores trabalhistas · Horas Extras · Pisos · Plantões</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Custo Horas Extras"
          value={`R$ ${totalOvertimeCost.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
          subtitle={`${totalEmployeesWithOvertime} colaboradores`}
          icon={Clock}
          className={totalOvertimeCost > 0 ? 'border-l-4 border-l-warning' : ''}
        />
        <StatsCard
          title="Regras Ativas"
          value={totalActiveRules}
          subtitle={`${ruleSets.length} conjuntos de regras`}
          icon={DollarSign}
        />
        <StatsCard
          title="Empresas s/ Piso"
          value={companiesBelowFloor.length}
          subtitle={companiesBelowFloor.length > 0
            ? `${companiesBelowFloor.reduce((s, c) => s + c.employees, 0)} colaboradores afetados`
            : 'Todas dentro do piso'}
          icon={AlertTriangle}
          className={companiesBelowFloor.length > 0 ? 'border-l-4 border-l-destructive' : ''}
        />
        <StatsCard
          title="Regras Plantão"
          value={onCallExposure.length}
          subtitle={onCallExposure.length > 0 ? `${new Set(onCallExposure.map(r => r.ruleSetName)).size} conjuntos` : 'Nenhuma regra'}
          icon={Phone}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horas Extras por Empresa */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Horas Extras por Empresa</h2>
          </div>
          {overtimeByCompany.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(180, overtimeByCompany.length * 40)}>
              <BarChart data={overtimeByCompany} layout="vertical">
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }}
                  tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }}
                  width={120}
                />
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Custo estimado']}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="cost" radius={[0, 6, 6, 0]}>
                  {overtimeByCompany.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={CheckCircle2} message="Nenhuma hora extra detectada" />
          )}
        </div>

        {/* Custos Adicionais Legais por Categoria */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <DollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Adicionais Legais por Categoria</h2>
          </div>
          {additionalCosts.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie
                    data={additionalCosts}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    strokeWidth={2}
                  >
                    {additionalCosts.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} regras`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {additionalCosts.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-card-foreground truncate">{item.name}</span>
                    <span className="text-muted-foreground ml-auto font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} message="Nenhuma regra ativa" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Empresas fora do Piso Salarial */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Empresas Abaixo do Piso</h2>
          </div>
          {companiesBelowFloor.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {companiesBelowFloor.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <Building2 className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-card-foreground">{item.company}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.employees} colaborador{item.employees > 1 ? 'es' : ''} abaixo do piso
                    </p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Piso: <strong className="text-card-foreground">R$ {item.floor.toLocaleString('pt-BR')}</strong>
                      </span>
                      <span className="text-xs text-destructive">
                        Menor: <strong>R$ {item.minSalary.toLocaleString('pt-BR')}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} message="Todas as empresas dentro do piso salarial" />
          )}
        </div>

        {/* Exposição a Plantões */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <Phone className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Exposição a Plantões</h2>
          </div>
          {onCallExposure.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {onCallExposure.map((rule, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <div
                    className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: rule.type === 'Plantão' ? 'hsl(38, 92%, 50%)' : 'hsl(210, 100%, 52%)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-card-foreground">{rule.ruleName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rule.ruleSetName} · <span className="font-semibold">{rule.type}</span>
                    </p>
                    {rule.limit && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Limite: {rule.limit}h/mês
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Phone} message="Nenhuma regra de plantão/sobreaviso configurada" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──

function EmptyState({ icon: Icon, message }: { icon: typeof CheckCircle2; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <Icon className="h-10 w-10 mb-2 text-primary opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    hora_extra: 'Hora Extra',
    adicional_noturno: 'Ad. Noturno',
    insalubridade: 'Insalubridade',
    periculosidade: 'Periculosidade',
    sobreaviso: 'Sobreaviso',
    plantao: 'Plantão',
    dsr: 'DSR',
    fgts: 'FGTS',
    vale_transporte: 'Vale Transporte',
    ferias: 'Férias',
    decimo_terceiro: '13º Salário',
  };
  return labels[category] || category;
}
