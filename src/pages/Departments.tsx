import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useDepartments, useCompaniesSimple, useEmployeesSimple, useCreateDepartment } from '@/domains/hooks';
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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [companyId, setCompanyId] = useState('');

  const { data: departments = [] } = useDepartments();
  const { data: companies = [] } = useCompaniesSimple();
  const { data: employees = [] } = useEmployeesSimple();
  const createMutation = useCreateDepartment();

  const handleCreate = () => {
    if (!tenantId || !companyId) { toast({ title: 'Erro', description: 'Campos obrigatórios', variant: 'destructive' }); return; }
    createMutation.mutate({ tenant_id: tenantId, company_id: companyId, name, budget: parseFloat(budget) || 0 }, {
      onSuccess: () => { toast({ title: 'Departamento criado!' }); setOpen(false); setName(''); setBudget(''); setCompanyId(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

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
            <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Orçamento</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0.00" /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Criando...' : 'Criar'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map((dept, i) => {
          const deptEmployees = employees.filter(e => e.department_id === dept.id && e.status === 'active');
          const totalSalary = deptEmployees.reduce((sum, e) => sum + (e.current_salary || 0), 0);
          const budgetUsed = (dept.budget || 0) > 0 ? ((totalSalary / (dept.budget || 1)) * 100).toFixed(0) : '0';

          return (
            <div key={dept.id} className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent"><Building2 className="h-5 w-5 text-accent-foreground" /></div>
                <div>
                  <h3 className="font-semibold text-card-foreground">{dept.name}</h3>
                  <p className="text-xs text-muted-foreground">{dept.companies?.name} · {deptEmployees.length} func.</p>
                </div>
              </div>
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Orçamento</span><span className="font-medium text-card-foreground">R$ {(dept.budget || 0).toLocaleString('pt-BR')}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Folha</span><span className="font-medium text-primary">R$ {totalSalary.toLocaleString('pt-BR')}</span></div>
                {(dept.budget || 0) > 0 && (
                  <>
                    <div className="h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full gradient-primary" style={{ width: `${Math.min(Number(budgetUsed), 100)}%` }} /></div>
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
