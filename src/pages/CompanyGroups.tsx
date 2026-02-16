import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useCompanyGroups, useCompaniesSimple, useCreateCompanyGroup } from '@/domains/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CompanyGroups() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: groups = [] } = useCompanyGroups();
  const { data: companies = [] } = useCompaniesSimple();
  const createMutation = useCreateCompanyGroup();

  const handleCreate = () => {
    if (!tenantId) return;
    createMutation.mutate({ tenant_id: tenantId, name, description: description || null }, {
      onSuccess: () => { toast({ title: 'Grupo criado!' }); setOpen(false); setName(''); setDescription(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Grupos de Empresas</h1>
          <p className="text-muted-foreground mt-1">{groups.length} grupos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Novo Grupo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Grupo de Empresas</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição opcional" /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Criando...' : 'Criar Grupo'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {groups.map((g, i) => {
          const groupCompanies = companies.filter(c => 'company_group_id' in c ? false : false); // Simple list doesn't have group_id
          return (
            <div key={g.id} className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent"><Layers className="h-5 w-5 text-accent-foreground" /></div>
                <div>
                  <h3 className="font-semibold text-card-foreground">{g.name}</h3>
                  <p className="text-xs text-muted-foreground">{companies.length} empresas no tenant</p>
                </div>
              </div>
              {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
            </div>
          );
        })}
        {groups.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum grupo cadastrado.</div>}
      </div>
    </div>
  );
}
