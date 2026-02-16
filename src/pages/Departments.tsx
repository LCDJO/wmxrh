import { departments, employees } from '@/data/mock-data';
import { Building2 } from 'lucide-react';

export default function Departments() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Departamentos</h1>
        <p className="text-muted-foreground mt-1">{departments.length} departamentos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map((dept, i) => {
          const deptEmployees = employees.filter(e => e.department === dept.name && e.status === 'active');
          const totalSalary = deptEmployees.reduce((sum, e) => sum + e.currentSalary, 0);

          return (
            <div
              key={dept.id}
              className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <Building2 className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground">{dept.name}</h3>
                  <p className="text-xs text-muted-foreground">{dept.employeeCount} funcionários</p>
                </div>
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Orçamento</span>
                  <span className="font-medium text-card-foreground">R$ {dept.budget.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Folha Atual</span>
                  <span className="font-medium text-primary">R$ {totalSalary.toLocaleString('pt-BR')}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full gradient-primary transition-all duration-500"
                    style={{ width: `${Math.min((totalSalary / dept.budget) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">{((totalSalary / dept.budget) * 100).toFixed(0)}% utilizado</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
