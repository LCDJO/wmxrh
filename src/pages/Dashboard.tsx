import { Users, Briefcase, TrendingUp, Building2 } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { useEmployees, usePositions, useDepartments, useCompanies } from '@/domains/hooks';
import type { EmployeeWithRelations, CompanyWithRelations } from '@/domains/shared';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();

  const { data: employees = [] } = useEmployees();
  const { data: positions = [] } = usePositions();
  const { data: departments = [] } = useDepartments();
  const { data: companies = [] } = useCompanies();

  const activeEmployees = employees.filter((e) => e.status === 'active');
  const totalPayroll = activeEmployees.reduce((sum, e) => sum + (e.current_salary || 0), 0);
  const recentEmployees = [...employees]
    .sort((a, b) => new Date(b.hire_date || b.created_at).getTime() - new Date(a.hire_date || a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral — {currentTenant?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard title="Funcionários" value={employees.length} subtitle={`${activeEmployees.length} ativos`} icon={Users} />
        <StatsCard title="Empresas" value={companies.length} icon={Building2} />
        <StatsCard title="Folha Mensal" value={totalPayroll > 0 ? `R$ ${(totalPayroll / 1000).toFixed(0)}k` : 'R$ 0'} icon={TrendingUp} />
        <StatsCard title="Cargos" value={positions.length} subtitle={`${departments.length} departamentos`} icon={Briefcase} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold font-display text-card-foreground">Contratações Recentes</h2>
            <button onClick={() => navigate('/employees')} className="text-sm text-primary hover:underline font-medium">Ver todos</button>
          </div>
          {recentEmployees.length > 0 ? (
            <div className="space-y-4">
              {recentEmployees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between py-2">
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
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum funcionário cadastrado ainda.</p>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <h2 className="text-lg font-semibold font-display text-card-foreground mb-5">Empresas</h2>
          {companies.length > 0 ? (
            <div className="space-y-4">
              {companies.map((c) => {
                const empCount = employees.filter(e => e.company_id === c.id).length;
                return (
                  <div key={c.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                        <Building2 className="h-4 w-4 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.document || 'Sem CNPJ'}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{empCount} func.</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma empresa cadastrada ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
