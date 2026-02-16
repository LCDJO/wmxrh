import { positions } from '@/data/mock-data';
import { Button } from '@/components/ui/button';
import { Plus, Users } from 'lucide-react';

export default function Positions() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Cargos</h1>
          <p className="text-muted-foreground mt-1">{positions.length} cargos cadastrados</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" />Novo Cargo</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {positions.map((pos, i) => (
          <div
            key={pos.id}
            className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in cursor-pointer"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">{pos.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{pos.department} · {pos.level}</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                <Users className="h-3 w-3" />{pos.employeeCount}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Faixa Salarial</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-card-foreground">R$ {pos.baseSalary.toLocaleString('pt-BR')}</span>
                <span className="text-xs text-muted-foreground">—</span>
                <span className="text-sm font-medium text-primary">R$ {pos.maxSalary.toLocaleString('pt-BR')}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary mt-2">
                <div className="h-full rounded-full gradient-primary" style={{ width: `${(pos.baseSalary / pos.maxSalary) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
