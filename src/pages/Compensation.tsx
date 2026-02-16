import { employees, salaryHistory } from '@/data/mock-data';
import { TrendingUp, DollarSign } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';

export default function Compensation() {
  const activeEmployees = employees.filter(e => e.status === 'active');
  const totalPayroll = activeEmployees.reduce((sum, e) => sum + e.currentSalary, 0);
  const avgSalary = Math.round(totalPayroll / activeEmployees.length);
  const maxSalary = Math.max(...activeEmployees.map(e => e.currentSalary));
  const recentChanges = [...salaryHistory].sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Remuneração</h1>
        <p className="text-muted-foreground mt-1">Gestão de salários e aumentos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatsCard title="Folha Total" value={`R$ ${(totalPayroll / 1000).toFixed(0)}k`} icon={DollarSign} />
        <StatsCard title="Salário Médio" value={`R$ ${avgSalary.toLocaleString('pt-BR')}`} icon={TrendingUp} />
        <StatsCard title="Maior Salário" value={`R$ ${maxSalary.toLocaleString('pt-BR')}`} icon={TrendingUp} />
      </div>

      <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
        <h2 className="text-lg font-semibold font-display text-card-foreground mb-5">Histórico de Alterações</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funcionário</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Anterior</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Novo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motivo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody>
              {recentChanges.map(h => {
                const emp = employees.find(e => e.id === h.employeeId);
                const increase = (((h.newSalary - h.previousSalary) / h.previousSalary) * 100).toFixed(1);
                return (
                  <tr key={h.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 px-4 text-sm font-medium text-card-foreground">{emp?.name || '—'}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">R$ {h.previousSalary.toLocaleString('pt-BR')}</td>
                    <td className="py-3 px-4 text-sm font-medium text-primary">R$ {h.newSalary.toLocaleString('pt-BR')}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{h.reason} <span className="text-accent-foreground font-semibold">(+{increase}%)</span></td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(h.effectiveDate).toLocaleDateString('pt-BR')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
