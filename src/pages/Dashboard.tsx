import { useMemo } from 'react';
import { Users, Briefcase, TrendingUp, Building2, Layers, Calendar } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
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

  const { data: employees = [] } = useEmployees();
  const { data: employeesSimple = [] } = useEmployeesSimple();
  const { data: positions = [] } = usePositions();
  const { data: departments = [] } = useDepartments();
  const { data: companies = [] } = useCompanies();
  const { data: groups = [] } = useCompanyGroups();
  const { data: adjustments = [] } = useSalaryAdjustmentsByTenant();

  const activeEmployees = employees.filter((e) => e.status === 'active');
  const totalPayroll = activeEmployees.reduce((sum, e) => sum + (e.current_salary || 0), 0);

  const recentEmployees = useMemo(() =>
    [...employees]
      .sort((a, b) => new Date(b.hire_date || b.created_at).getTime() - new Date(a.hire_date || a.created_at).getTime())
      .slice(0, 5),
    [employees]
  );

  // Employees by group chart data
  const employeesByGroup = useMemo(() => {
    const groupMap = new Map<string, { name: string; count: number }>();
    // Group companies by group
    const companyGroupMap = new Map<string, string>();
    companies.forEach(c => {
      if (c.company_group_id) companyGroupMap.set(c.id, c.company_group_id);
    });

    groups.forEach(g => groupMap.set(g.id, { name: g.name, count: 0 }));
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
    if (noGroup > 0) result.push({ name: 'Sem grupo', count: noGroup });
    return result;
  }, [employeesSimple, companies, groups]);

  // Cost by company chart data
  const costByCompany = useMemo(() => {
    return companies.map(c => {
      const compEmployees = employeesSimple.filter(e => e.company_id === c.id && e.status === 'active');
      const cost = compEmployees.reduce((sum, e) => sum + (e.current_salary || 0), 0);
      return { name: c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name, custo: cost };
    }).filter(c => c.custo > 0);
  }, [companies, employeesSimple]);

  // Recent adjustments
  const recentAdjustments = useMemo(() => adjustments.slice(0, 5), [adjustments]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral — {currentTenant?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard title="Funcionários" value={employees.length} subtitle={`${activeEmployees.length} ativos`} icon={Users} />
        <StatsCard title="Empresas" value={companies.length} subtitle={`${groups.length} grupos`} icon={Building2} />
        <StatsCard title="Folha Mensal" value={totalPayroll > 0 ? `R$ ${(totalPayroll / 1000).toFixed(0)}k` : 'R$ 0'} icon={TrendingUp} />
        <StatsCard title="Cargos" value={positions.length} subtitle={`${departments.length} departamentos`} icon={Briefcase} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employees by Group - Pie Chart */}
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
                  <div key={g.name} className="flex items-center gap-2 text-sm">
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

        {/* Cost by Company - Bar Chart */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Custo por Empresa</h2>
          </div>
          {costByCompany.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={costByCompany}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Custo']} />
                <Bar dataKey="custo" fill="hsl(160, 84%, 29%)" radius={[6, 6, 0, 0]} />
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
