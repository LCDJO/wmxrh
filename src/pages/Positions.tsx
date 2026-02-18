import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { usePositions, useCompaniesSimple, useEmployeesSimple, useCreatePosition, useUpdatePosition, useDeletePosition } from '@/domains/hooks';
import { usePermissions } from '@/domains/security';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, Pencil, Trash2 } from 'lucide-react';
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
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editBaseSalary, setEditBaseSalary] = useState('');
  const [editMaxSalary, setEditMaxSalary] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: positions = [] } = usePositions();
  const { data: companies = [] } = useCompaniesSimple();
  const { data: employees = [] } = useEmployeesSimple();
  const createMutation = useCreatePosition();
  const updateMutation = useUpdatePosition();
  const deleteMutation = useDeletePosition();
  const { canManageEmployees } = usePermissions();

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

  const handleUpdate = () => {
    if (!editId) return;
    updateMutation.mutate({ id: editId, title: editTitle, level: editLevel || null, base_salary: parseFloat(editBaseSalary) || 0, max_salary: parseFloat(editMaxSalary) || 0 }, {
      onSuccess: () => { toast({ title: 'Cargo atualizado!' }); setEditId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => { toast({ title: 'Cargo removido!' }); setDeleteId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const openEdit = (pos: typeof positions[0]) => {
    setEditId(pos.id); setEditTitle(pos.title); setEditLevel(pos.level || '');
    setEditBaseSalary(String(pos.base_salary || '')); setEditMaxSalary(String(pos.max_salary || ''));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Cargos</h1>
          <p className="text-muted-foreground mt-1">{positions.length} cargos</p>
        </div>
        {canManageEmployees && (
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
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {positions.map((pos, i) => {
          const empCount = employees.filter(e => e.position_id === pos.id).length;
          return (
            <div key={pos.id} className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-card-foreground">{pos.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{pos.companies?.name} · {pos.level || '—'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full"><Users className="h-3 w-3" />{empCount}</span>
                  {canManageEmployees && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(pos)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(pos.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </>
                  )}
                </div>
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

      <Dialog open={!!editId} onOpenChange={(v) => !v && setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Cargo</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleUpdate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Nível</Label><Input value={editLevel} onChange={e => setEditLevel(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Salário Base</Label><Input type="number" value={editBaseSalary} onChange={e => setEditBaseSalary(e.target.value)} /></div>
              <div className="space-y-2"><Label>Salário Máx</Label><Input type="number" value={editMaxSalary} onChange={e => setEditMaxSalary(e.target.value)} /></div>
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover este cargo?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? 'Removendo...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
