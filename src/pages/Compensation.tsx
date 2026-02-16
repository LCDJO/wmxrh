import { useEmployeesSimple, useSalaryHistoryByTenant } from '@/domains/hooks';
import { TrendingUp, DollarSign } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';

export default function Compensation() {
  const { data: employees = [] } = useEmployeesSimple();
  const { data: history = [] } = useSalaryHistoryByTenant();

  const active = employees.filter(e => e.status === 'active');
  const totalPayroll = active.reduce((sum, e) => sum + (e.current_salary || 0), 0);
  const avgSalary = active.length > 0 ? Math.round(totalPayroll / active.length) : 0;
  const maxSalary = active.length > 0 ? Math.max(...active.map(e => e.current_salary || 0)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Remuneração</h1>
        <p className="text-muted-foreground mt-1">Gestão de salários e aumentos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatsCard title="Folha Total" value={`R$ ${totalPayroll > 0 ? (totalPayroll / 1000).toFixed(0) + 'k' : '0'}`} icon={DollarSign} />
        <StatsCard title="Salário Médio" value={`R$ ${avgSalary.toLocaleString('pt-BR')}`} icon={TrendingUp} />
        <StatsCard title="Maior Salário" value={`R$ ${maxSalary.toLocaleString('pt-BR')}`} icon={TrendingUp} />
      </div>

      <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
        <h2 className="text-lg font-semibold font-display text-card-foreground mb-5">Histórico de Alterações</h2>
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Funcionário</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Anterior</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Novo</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Motivo</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Data</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const increase = (((h.new_salary - h.previous_salary) / h.previous_salary) * 100).toFixed(1);
                  return (
                    <tr key={h.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 px-4 text-sm font-medium text-card-foreground">{h.employees?.name || '—'}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">R$ {h.previous_salary.toLocaleString('pt-BR')}</td>
                      <td className="py-3 px-4 text-sm font-medium text-primary">R$ {h.new_salary.toLocaleString('pt-BR')}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{h.reason || '—'} <span className="text-accent-foreground font-semibold">(+{increase}%)</span></td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(h.effective_date).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum histórico de alteração salarial.</p>
        )}
      </div>
    </div>
  );
}
