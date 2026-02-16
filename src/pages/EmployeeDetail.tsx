import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Phone, Calendar, TrendingUp, Building2 } from 'lucide-react';

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();

  const { data: employee } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*, positions(title), departments(name), companies(name)').eq('id', id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['salary_history', id],
    queryFn: async () => {
      const { data } = await supabase.from('salary_history').select('*').eq('employee_id', id!).order('effective_date', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Carregando...</p>
        <Button variant="ghost" onClick={() => navigate('/employees')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const initials = employee.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('');
  const salaryIncrease = (employee.current_salary || 0) - (employee.base_salary || 0);
  const salaryIncreasePercent = employee.base_salary ? ((salaryIncrease / employee.base_salary) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate('/employees')} className="gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl shadow-card p-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold font-display text-card-foreground">{employee.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{employee.positions?.title || '—'}</p>
            <div className="mt-3"><StatusBadge status={employee.status} /></div>
          </div>
          <div className="mt-6 space-y-3 border-t border-border pt-5">
            {employee.email && <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">{employee.email}</span></div>}
            {employee.phone && <div className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">{employee.phone}</span></div>}
            {employee.hire_date && <div className="flex items-center gap-3 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">Admissão: {new Date(employee.hire_date).toLocaleDateString('pt-BR')}</span></div>}
            {employee.companies?.name && <div className="flex items-center gap-3 text-sm"><Building2 className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">{employee.companies.name}</span></div>}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl shadow-card p-5">
              <p className="text-xs text-muted-foreground font-medium">Salário Base</p>
              <p className="text-2xl font-bold font-display text-card-foreground mt-1">R$ {(employee.base_salary || 0).toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-5">
              <p className="text-xs text-muted-foreground font-medium">Salário Atual</p>
              <p className="text-2xl font-bold font-display text-primary mt-1">R$ {(employee.current_salary || 0).toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-5">
              <p className="text-xs text-muted-foreground font-medium">Evolução</p>
              <p className="text-2xl font-bold font-display text-accent-foreground mt-1">+{salaryIncreasePercent}%</p>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold font-display text-card-foreground">Histórico Salarial</h3>
            </div>
            {history.length > 0 ? (
              <div className="space-y-4">
                {history.map((h: any) => (
                  <div key={h.id} className="flex items-start gap-4 py-3 border-b border-border/50 last:border-0">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-card-foreground">{h.reason || 'Alteração salarial'}</p>
                        <span className="text-xs text-muted-foreground">{new Date(h.effective_date).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        R$ {h.previous_salary.toLocaleString('pt-BR')} → <span className="text-primary font-medium">R$ {h.new_salary.toLocaleString('pt-BR')}</span>
                      </p>
                      {h.approved_by && <p className="text-xs text-muted-foreground mt-1">Aprovado por: {h.approved_by}</p>}
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
