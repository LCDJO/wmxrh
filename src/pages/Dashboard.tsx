import { useMemo } from 'react';
import { Users, Briefcase, TrendingUp, Building2, Layers, Calendar } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import {
  useEmployees, useEmployeesSimple, usePositions, useDepartments,
  useCompanies, useCompanyGroups, useSalaryAdjustmentsByTenant
} from '@/domains/hooks';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = [
  'hsl(160, 84%, 29%)',
  'hsl(210, 100%, 52%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(160, 84%, 45%)',
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { scope, setGroupScope, setCompanyScope } = useScope();

  const { data: employees = [] } = useEmployees();
  const { data: employeesSimple = [] } = useEmployeesSimple();
  const { data: positions = [] } = usePositions();
  const { data: departments = [] } = useDepartments();
  const { data: companies = [] } = useCompanies();
  const { data: groups = [] } = useCompanyGroups();
  const { data: adjustments = [] } = useSalaryAdjustmentsByTenant();

  // Filter data based on scope
  const scopedEmployeesSimple = useMemo(() => {
    if (scope.level === 'tenant') return employeesSimple;
    if (scope.level === 'company' && scope.companyId) {
      return employeesSimple.filter(e => e.company_id === scope.companyId);
    }
    if (scope.level === 'group' && scope.groupId) {
      const groupCompanyIds = companies.filter(c => c.company_group_id === scope.groupId).map(c => c.id);
      return employeesSimple.filter(e => groupCompanyIds.includes(e.company_id));
    }
    return employeesSimple;
  }, [employeesSimple, scope, companies]);

  const scopedEmployees = useMemo(() => {
    if (scope.level === 'tenant') return employees;
    if (scope.level === 'company' && scope.companyId) {
      return employees.filter(e => e.company_id === scope.companyId);
    }
    if (scope.level === 'group' && scope.groupId) {
      const groupCompanyIds = companies.filter(c => c.company_group_id === scope.groupId).map(c => c.id);
      return employees.filter(e => groupCompanyIds.includes(e.company_id));
    }
    return employees;
  }, [employees, scope, companies]);

  const scopedCompanies = useMemo(() => {
    if (scope.level === 'tenant') return companies;
    if (scope.level === 'group' && scope.groupId) {
      return companies.filter(c => c.company_group_id === scope.groupId);
    }
    if (scope.level === 'company' && scope.companyId) {
      return companies.filter(c => c.id === scope.companyId);
    }
    return companies;
  }, [companies, scope]);

  const activeEmployees = scopedEmployees.filter((e) => e.status === 'active');
  const totalPayroll = activeEmployees.reduce((sum, e) => sum + (e.current_salary || 0), 0);

  const recentEmployees = useMemo(() =>
    [...scopedEmployees]
      .sort((a, b) => new Date(b.hire_date || b.created_at).getTime() - new Date(a.hire_date || a.created_at).getTime())
      .slice(0, 5),
    [scopedEmployees]
  );

  // Scope title
  const scopeTitle = scope.level === 'company' ? scope.companyName
    : scope.level === 'group' ? scope.groupName
    : currentTenant?.name;

  const scopeSubtitle = scope.level === 'company' ? 'Visão empresa'
    : scope.level === 'group' ? 'Visão grupo'
    : 'Visão geral';

  // Employees by group chart data (only at tenant level)
  const employeesByGroup = useMemo(() => {
    if (scope.level !== 'tenant') return [];
    const groupMap = new Map<string, { name: string; count: number; id: string }>();
    const companyGroupMap = new Map<string, string>();
    companies.forEach(c => {
      if (c.company_group_id) companyGroupMap.set(c.id, c.company_group_id);
    });

    groups.forEach(g => groupMap.set(g.id, { name: g.name, count: 0, id: g.id }));
    let noGroup = 0;

    employeesSimple.forEach(e => {
      const groupId = companyGroupMap.get(e.company_id);
      if (groupId && groupMap.has(groupId)) {
        groupMap.get(groupId)!.count++;
      } else {
        noGroup++;
      }
    });

    const result = Array.from(groupMap.values()).filter(g => g.count > 0);
    if (noGroup > 0) result.push({ name: 'Sem grupo', count: noGroup, id: '' });
    return result;
  }, [employeesSimple, companies, groups, scope.level]);

  // Cost by company chart data
  const costByCompany = useMemo(() => {
    return scopedCompanies.map(c => {
      const compEmployees = scopedEmployeesSimple.filter(e => e.company_id === c.id && e.status === 'active');
      const cost = compEmployees.reduce((sum, e) => sum + (e.current_salary || 0), 0);
      return { name: c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name, custo: cost, id: c.id, fullName: c.name };
    }).filter(c => c.custo > 0);
  }, [scopedCompanies, scopedEmployeesSimple]);

  // Recent adjustments
  const recentAdjustments = useMemo(() => adjustments.slice(0, 5), [adjustments]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">{scopeSubtitle} — {scopeTitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard title="Funcionários" value={scopedEmployees.length} subtitle={`${activeEmployees.length} ativos`} icon={Users} />
        <StatsCard title="Empresas" value={scopedCompanies.length} subtitle={scope.level === 'tenant' ? `${groups.length} grupos` : undefined} icon={Building2} />
        <StatsCard title="Folha Mensal" value={totalPayroll > 0 ? `R$ ${(totalPayroll / 1000).toFixed(0)}k` : 'R$ 0'} icon={TrendingUp} />
        <StatsCard title="Cargos" value={positions.length} subtitle={`${departments.length} departamentos`} icon={Briefcase} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employees by Group - Pie Chart (tenant level only) */}
        {scope.level === 'tenant' && (
          <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-5">
              <Layers className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Funcionários por Grupo</h2>
            </div>
            {employeesByGroup.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={employeesByGroup} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={2}>
                      {employeesByGroup.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} func.`, '']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {employeesByGroup.map((g, i) => (
                    <div
                      key={g.name}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/50 rounded px-2 py-1 -mx-2 transition-colors"
                      onClick={() => g.id && setGroupScope(g.id, g.name)}
                    >
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-card-foreground truncate">{g.name}</span>
                      <span className="text-muted-foreground ml-auto font-medium">{g.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum grupo com funcionários.</p>
            )}
          </div>
        )}

        {/* Companies in group (group level) */}
        {scope.level === 'group' && (
          <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-5">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Empresas do Grupo</h2>
            </div>
            {scopedCompanies.length > 0 ? (
              <div className="space-y-2">
                {scopedCompanies.map(c => {
                  const empCount = scopedEmployeesSimple.filter(e => e.company_id === c.id).length;
                  const cost = scopedEmployeesSimple.filter(e => e.company_id === c.id && e.status === 'active').reduce((s, e) => s + (e.current_salary || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border cursor-pointer hover:bg-secondary/50 transition-colors"
                      onClick={() => setCompanyScope(c.id, c.name)}
                    >
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{empCount} funcionários</p>
                      </div>
                      <p className="text-sm font-semibold text-primary">R$ {(cost / 1000).toFixed(0)}k</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma empresa neste grupo.</p>
            )}
          </div>
        )}

        {/* Cost by Company - Bar Chart */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">
              {scope.level === 'company' ? 'Custo por Departamento' : 'Custo por Empresa'}
            </h2>
          </div>
          {costByCompany.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={costByCompany}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Custo']} />
                <Bar
                  dataKey="custo"
                  fill="hsl(160, 84%, 29%)"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(data: any) => {
                    if (scope.level === 'tenant' || scope.level === 'group') {
                      setCompanyScope(data.id, data.fullName);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum dado de custo.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Hires */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold font-display text-card-foreground">Contratações Recentes</h2>
            <button onClick={() => navigate('/employees')} className="text-sm text-primary hover:underline font-medium">Ver todos</button>
          </div>
          {recentEmployees.length > 0 ? (
            <div className="space-y-4">
              {recentEmployees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between py-2 cursor-pointer hover:bg-secondary/50 rounded-lg px-2 -mx-2 transition-colors" onClick={() => navigate(`/employees/${emp.id}`)}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                        {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.positions?.title || '—'}</p>
                    </div>
                  </div>
                  <StatusBadge status={emp.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum funcionário cadastrado.</p>
          )}
        </div>

        {/* Recent Adjustments */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Últimos Reajustes</h2>
            </div>
            <button onClick={() => navigate('/compensation')} className="text-sm text-primary hover:underline font-medium">Ver todos</button>
          </div>
          {recentAdjustments.length > 0 ? (
            <div className="space-y-4">
              {recentAdjustments.map((adj) => {
                const pct = adj.percentage ? `+${adj.percentage}%` : `+${(((adj.new_salary - adj.previous_salary) / adj.previous_salary) * 100).toFixed(1)}%`;
                const typeLabels: Record<string, string> = {
                  annual: 'Anual', promotion: 'Promoção', adjustment: 'Ajuste', merit: 'Mérito', correction: 'Correção',
                };
                return (
                  <div key={adj.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{adj.employees?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{typeLabels[adj.adjustment_type] || adj.adjustment_type} · {new Date(adj.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">R$ {adj.new_salary.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-accent-foreground font-semibold">{pct}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum reajuste registrado.</p>
          )}
        </div>
      </div>
    </div>
  );
}
