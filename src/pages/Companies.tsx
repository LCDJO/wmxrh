import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useCompanies, useEmployeesSimple, useCreateCompany } from '@/domains/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Companies() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');

  const { data: companies = [] } = useCompanies();
  const { data: employees = [] } = useEmployeesSimple();
  const createMutation = useCreateCompany();

  const handleCreate = () => {
    if (!tenantId) return;
    createMutation.mutate({ tenant_id: tenantId, name, document: document || null }, {
      onSuccess: () => { toast({ title: 'Empresa criada!' }); setOpen(false); setName(''); setDocument(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Empresas</h1>
          <p className="text-muted-foreground mt-1">{companies.length} empresas cadastradas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Nova Empresa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Empresa</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>CNPJ</Label><Input value={document} onChange={e => setDocument(e.target.value)} placeholder="00.000.000/0000-00" /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Criando...' : 'Criar Empresa'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {companies.map((c, i) => {
          const compEmployees = employees.filter(e => e.company_id === c.id && e.status === 'active');
          const payroll = compEmployees.reduce((sum, e) => sum + (e.current_salary || 0), 0);
          return (
            <div key={c.id} className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent"><Building2 className="h-5 w-5 text-accent-foreground" /></div>
                <div>
                  <h3 className="font-semibold text-card-foreground">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">{c.document || 'Sem CNPJ'}</p>
                </div>
              </div>
              {c.company_groups?.name && <p className="text-xs text-muted-foreground mb-3">Grupo: {c.company_groups.name}</p>}
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Funcionários ativos</span><span className="font-medium text-card-foreground">{compEmployees.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Folha mensal</span><span className="font-medium text-primary">R$ {payroll.toLocaleString('pt-BR')}</span></div>
              </div>
            </div>
          );
        })}
        {companies.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhuma empresa cadastrada.</div>}
      </div>
    </div>
  );
}
