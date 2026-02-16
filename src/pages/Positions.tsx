import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { usePositions, useCompaniesSimple, useEmployeesSimple, useCreatePosition } from '@/domains/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Positions() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [maxSalary, setMaxSalary] = useState('');
  const [companyId, setCompanyId] = useState('');

  const { data: positions = [] } = usePositions();
  const { data: companies = [] } = useCompaniesSimple();
  const { data: employees = [] } = useEmployeesSimple();
  const createMutation = useCreatePosition();

  const handleCreate = () => {
    if (!tenantId || !companyId) { toast({ title: 'Erro', description: 'Campos obrigatórios', variant: 'destructive' }); return; }
    createMutation.mutate({
      tenant_id: tenantId, company_id: companyId, title, level: level || null,
      base_salary: parseFloat(baseSalary) || 0, max_salary: parseFloat(maxSalary) || 0,
    }, {
      onSuccess: () => { toast({ title: 'Cargo criado!' }); setOpen(false); setTitle(''); setLevel(''); setBaseSalary(''); setMaxSalary(''); setCompanyId(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Cargos</h1>
          <p className="text-muted-foreground mt-1">{positions.length} cargos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Novo Cargo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Cargo</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Título *</Label><Input value={title} onChange={e => setTitle(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Nível</Label><Input value={level} onChange={e => setLevel(e.target.value)} placeholder="Júnior, Pleno, Sênior..." /></div>
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Salário Base</Label><Input type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} /></div>
                <div className="space-y-2"><Label>Salário Máx</Label><Input type="number" value={maxSalary} onChange={e => setMaxSalary(e.target.value)} /></div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Criando...' : 'Criar Cargo'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {positions.map((pos, i) => {
          const empCount = employees.filter(e => e.position_id === pos.id).length;
          return (
            <div key={pos.id} className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground">{pos.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{pos.companies?.name} · {pos.level || '—'}</p>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full"><Users className="h-3 w-3" />{empCount}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-card-foreground">R$ {(pos.base_salary || 0).toLocaleString('pt-BR')}</span>
                  <span className="text-xs text-muted-foreground">—</span>
                  <span className="text-sm font-medium text-primary">R$ {(pos.max_salary || 0).toLocaleString('pt-BR')}</span>
                </div>
                {(pos.max_salary || 0) > 0 && (
                  <div className="h-1.5 rounded-full bg-secondary">
                    <div className="h-full rounded-full gradient-primary" style={{ width: `${((pos.base_salary || 0) / (pos.max_salary || 1)) * 100}%` }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {positions.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum cargo cadastrado.</div>}
      </div>
    </div>
  );
}
