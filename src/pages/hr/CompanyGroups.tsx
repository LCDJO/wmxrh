import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useCompanyGroups, useCompaniesSimple, useCreateCompanyGroup, useUpdateCompanyGroup, useDeleteCompanyGroup } from '@/domains/hooks';
import { usePermissions } from '@/domains/security';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Layers, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/core/use-toast';

export default function CompanyGroups() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: groups = [] } = useCompanyGroups();
  const { data: companies = [] } = useCompaniesSimple();
  const createMutation = useCreateCompanyGroup();
  const updateMutation = useUpdateCompanyGroup();
  const deleteMutation = useDeleteCompanyGroup();
  const { isTenantAdmin } = usePermissions();

  const handleCreate = () => {
    if (!tenantId) return;
    createMutation.mutate({ tenant_id: tenantId, name, description: description || null }, {
      onSuccess: () => { toast({ title: 'Grupo criado!' }); setOpen(false); setName(''); setDescription(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleUpdate = () => {
    if (!editId) return;
    updateMutation.mutate({ id: editId, name: editName, description: editDescription || null }, {
      onSuccess: () => { toast({ title: 'Grupo atualizado!' }); setEditId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => { toast({ title: 'Grupo removido!' }); setDeleteId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const openEdit = (g: typeof groups[0]) => {
    setEditId(g.id); setEditName(g.name); setEditDescription(g.description || '');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Grupos de Empresas</h1>
          <p className="text-muted-foreground mt-1">{groups.length} grupos</p>
        </div>
        {isTenantAdmin && (
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
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {groups.map((g, i) => (
          <div key={g.id} className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent"><Layers className="h-5 w-5 text-accent-foreground" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-card-foreground">{g.name}</h3>
                <p className="text-xs text-muted-foreground">{companies.length} empresas no tenant</p>
              </div>
              {isTenantAdmin && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
            {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
          </div>
        ))}
        {groups.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum grupo cadastrado.</div>}
      </div>

      <Dialog open={!!editId} onOpenChange={(v) => !v && setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Grupo</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleUpdate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={editName} onChange={e => setEditName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover este grupo? As empresas vinculadas não serão excluídas.</AlertDialogDescription>
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
