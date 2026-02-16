import { Users, Briefcase, TrendingUp, Building2 } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { employees, departments, positions } from '@/data/mock-data';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const activeCount = employees.filter(e => e.status === 'active').length;
  const totalPayroll = employees.filter(e => e.status === 'active').reduce((sum, e) => sum + e.currentSalary, 0);
  const avgSalary = Math.round(totalPayroll / activeCount);
  const recentEmployees = [...employees].sort((a, b) => new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime()).slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral dos recursos humanos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard title="Total Funcionários" value={employees.length} subtitle={`${activeCount} ativos`} icon={Users} trend={{ value: 8, label: 'vs mês anterior' }} />
        <StatsCard title="Cargos" value={positions.length} subtitle="Em 5 departamentos" icon={Briefcase} />
        <StatsCard title="Folha Mensal" value={`R$ ${(totalPayroll / 1000).toFixed(0)}k`} subtitle="Funcionários ativos" icon={TrendingUp} trend={{ value: 3.2, label: 'vs mês anterior' }} />
        <StatsCard title="Salário Médio" value={`R$ ${avgSalary.toLocaleString('pt-BR')}`} icon={Building2} trend={{ value: 5, label: 'vs ano anterior' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Employees */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold font-display text-card-foreground">Contratações Recentes</h2>
            <button onClick={() => navigate('/employees')} className="text-sm text-primary hover:underline font-medium">Ver todos</button>
          </div>
          <div className="space-y-4">
            {recentEmployees.map(emp => (
              <div key={emp.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                      {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.positionTitle}</p>
                  </div>
                </div>
                <StatusBadge status={emp.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Department Overview */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <h2 className="text-lg font-semibold font-display text-card-foreground mb-5">Departamentos</h2>
          <div className="space-y-4">
            {departments.map(dept => {
              const maxCount = Math.max(...departments.map(d => d.employeeCount));
              return (
                <div key={dept.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-card-foreground">{dept.name}</span>
                    <span className="text-sm text-muted-foreground">{dept.employeeCount} pessoas</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full gradient-primary transition-all duration-500"
                      style={{ width: `${(dept.employeeCount / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
