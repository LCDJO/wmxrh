import { useParams, useNavigate } from 'react-router-dom';
import { employees, salaryHistory } from '@/data/mock-data';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Phone, Calendar, TrendingUp } from 'lucide-react';

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const employee = employees.find(e => e.id === id);
  const history = salaryHistory.filter(s => s.employeeId === id).sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Funcionário não encontrado.</p>
        <Button variant="ghost" onClick={() => navigate('/employees')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const initials = employee.name.split(' ').map(n => n[0]).slice(0, 2).join('');
  const salaryIncrease = employee.currentSalary - employee.baseSalary;
  const salaryIncreasePercent = ((salaryIncrease / employee.baseSalary) * 100).toFixed(1);

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate('/employees')} className="gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-card rounded-xl shadow-card p-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold font-display text-card-foreground">{employee.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{employee.positionTitle}</p>
            <div className="mt-3"><StatusBadge status={employee.status} /></div>
          </div>
          <div className="mt-6 space-y-3 border-t border-border pt-5">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-card-foreground">{employee.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-card-foreground">{employee.phone}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-card-foreground">Admissão: {new Date(employee.hireDate).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>

        {/* Salary Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl shadow-card p-5">
              <p className="text-xs text-muted-foreground font-medium">Salário Base</p>
              <p className="text-2xl font-bold font-display text-card-foreground mt-1">R$ {employee.baseSalary.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-5">
              <p className="text-xs text-muted-foreground font-medium">Salário Atual</p>
              <p className="text-2xl font-bold font-display text-primary mt-1">R$ {employee.currentSalary.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-5">
              <p className="text-xs text-muted-foreground font-medium">Evolução</p>
              <p className="text-2xl font-bold font-display text-accent-foreground mt-1">+{salaryIncreasePercent}%</p>
            </div>
          </div>

          {/* Salary History */}
          <div className="bg-card rounded-xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold font-display text-card-foreground">Histórico Salarial</h3>
            </div>
            {history.length > 0 ? (
              <div className="space-y-4">
                {history.map(h => (
                  <div key={h.id} className="flex items-start gap-4 py-3 border-b border-border/50 last:border-0">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-card-foreground">{h.reason}</p>
                        <span className="text-xs text-muted-foreground">{new Date(h.effectiveDate).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        R$ {h.previousSalary.toLocaleString('pt-BR')} → <span className="text-primary font-medium">R$ {h.newSalary.toLocaleString('pt-BR')}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Aprovado por: {h.approvedBy}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum histórico salarial registrado.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
