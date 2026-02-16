import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Departments() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [companyId, setCompanyId] = useState('');

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from('departments').select('*, companies(name)').eq('tenant_id', tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from('companies').select('id, name').eq('tenant_id', tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-dept', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from('employees').select('id, department_id, current_salary, status').eq('tenant_id', tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !companyId) throw new Error('Campos obrigatórios');
      const { error } = await supabase.from('departments').insert({
        tenant_id: tenantId,
        company_id: companyId,
        name,
        budget: parseFloat(budget) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', tenantId] });
      toast({ title: 'Departamento criado!' });
      setOpen(false);
      setName(''); setBudget(''); setCompanyId('');
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Departamentos</h1>
          <p className="text-muted-foreground mt-1">{departments.length} departamentos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Novo Departamento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Departamento</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Orçamento</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0.00" /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Criando...' : 'Criar'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map((dept: any, i: number) => {
          const deptEmployees = employees.filter((e: any) => e.department_id === dept.id && e.status === 'active');
          const totalSalary = deptEmployees.reduce((sum: number, e: any) => sum + (e.current_salary || 0), 0);
          const budgetUsed = dept.budget > 0 ? ((totalSalary / dept.budget) * 100).toFixed(0) : 0;

          return (
            <div key={dept.id} className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <Building2 className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground">{dept.name}</h3>
                  <p className="text-xs text-muted-foreground">{dept.companies?.name} · {deptEmployees.length} func.</p>
                </div>
              </div>
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Orçamento</span>
                  <span className="font-medium text-card-foreground">R$ {(dept.budget || 0).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Folha</span>
                  <span className="font-medium text-primary">R$ {totalSalary.toLocaleString('pt-BR')}</span>
                </div>
                {dept.budget > 0 && (
                  <>
                    <div className="h-1.5 rounded-full bg-secondary">
                      <div className="h-full rounded-full gradient-primary" style={{ width: `${Math.min(Number(budgetUsed), 100)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">{budgetUsed}% utilizado</p>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {departments.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum departamento cadastrado.</div>}
      </div>
    </div>
  );
}
