import { useState, useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useCompanies, useEmployeesSimple, useCreateCompany, useUpdateCompany, useDeleteCompany, useCompanyCnaeProfiles } from '@/domains/hooks';
import { usePermissions } from '@/domains/security';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, ShieldCheck, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/core/use-toast';
import { CnpjConsultaPanel } from '@/components/company/CnpjConsultaPanel';
import { occupationalComplianceGenerator } from '@/domains/occupational-intelligence/occupational-compliance-generator';
import { getApplicableNrs } from '@/domains/occupational-intelligence/nr-training-mapper';
import type { GrauRisco } from '@/domains/occupational-intelligence/types';

export default function Companies() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [cnaeConsulted, setCnaeConsulted] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDocument, setEditDocument] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: companies = [] } = useCompanies();
  const { data: employees = [] } = useEmployeesSimple();
  const { data: cnaeProfiles = [] } = useCompanyCnaeProfiles();
  const createMutation = useCreateCompany();
  const updateMutation = useUpdateCompany();
  const deleteMutation = useDeleteCompany();
  const { isTenantAdmin } = usePermissions();

  const RISK_COLORS: Record<number, string> = {
    1: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    2: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    3: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    4: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  const cnaeByCompany = useMemo(() => {
    const map = new Map<string, typeof cnaeProfiles[0]>();
    for (const p of cnaeProfiles) map.set(p.company_id, p);
    return map;
  }, [cnaeProfiles]);

  const handleCreate = async () => {
    if (!tenantId) return;
    createMutation.mutate({ tenant_id: tenantId, name, document: document || null }, {
      onSuccess: async (company) => {
        toast({ title: 'Empresa criada!' });
        const cleanedCnpj = document.replace(/\D/g, '');
        if (cnaeConsulted && cleanedCnpj.length === 14 && company?.id) {
          try {
            const result = await occupationalComplianceGenerator.generateFromCnpj(tenantId, company.id, null, cleanedCnpj);
            toast({ title: 'Análise ocupacional gerada', description: `Risco ${result.summary.grau_risco} · ${result.summary.total_cbos_suggested} cargos · ${result.summary.total_trainings_generated} treinamentos` });
          } catch (err) { console.error('[Companies] Occupational compliance failed:', err); }
        }
        setOpen(false); setName(''); setDocument(''); setCnaeConsulted(false);
      },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleUpdate = () => {
    if (!editId) return;
    updateMutation.mutate({ id: editId, name: editName, document: editDocument || null }, {
      onSuccess: () => { toast({ title: 'Empresa atualizada!' }); setEditId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => { toast({ title: 'Empresa removida!' }); setDeleteId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const openEdit = (c: typeof companies[0]) => {
    setEditId(c.id); setEditName(c.name); setEditDocument(c.document || '');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Empresas</h1>
          <p className="text-muted-foreground mt-1">{companies.length} empresas cadastradas</p>
        </div>
        {isTenantAdmin && (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setName(''); setDocument(''); setCnaeConsulted(false); } }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Nova Empresa</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Empresa</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <CnpjConsultaPanel cnpj={document} onCnpjChange={setDocument} onResultReady={() => setCnaeConsulted(true)} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Criando...' : 'Criar Empresa'}</Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {companies.map((c, i) => {
          const compEmployees = employees.filter(e => e.company_id === c.id && e.status === 'active');
          const payroll = compEmployees.reduce((sum, e) => sum + (e.current_salary || 0), 0);
          return (
            <div key={c.id} className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent"><Building2 className="h-5 w-5 text-accent-foreground" /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-card-foreground">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">{c.document || 'Sem CNPJ'}</p>
                </div>
                {isTenantAdmin && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
              {c.company_groups?.name && <p className="text-xs text-muted-foreground mb-3">Grupo: {c.company_groups.name}</p>}
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Funcionários ativos</span><span className="font-medium text-card-foreground">{compEmployees.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Folha mensal</span><span className="font-medium text-primary">R$ {payroll.toLocaleString('pt-BR')}</span></div>
              </div>
              {(() => {
                const profile = cnaeByCompany.get(c.id);
                if (!profile) return null;
                const nrs = getApplicableNrs(profile.grau_risco_sugerido as GrauRisco);
                return (
                  <div className="space-y-2 border-t border-border pt-4 mt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> NRs Aplicáveis</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${RISK_COLORS[profile.grau_risco_sugerido] || ''}`}>Risco {profile.grau_risco_sugerido}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">CNAE {profile.cnae_principal} · {profile.descricao_atividade}</p>
                    <div className="flex flex-wrap gap-1">
                      {nrs.slice(0, 10).map(nr => (<Badge key={nr.nr_number} variant={nr.priority === 'obrigatoria' ? 'default' : 'secondary'} className="text-[10px]">NR-{nr.nr_number}</Badge>))}
                      {nrs.length > 10 && <Badge variant="outline" className="text-[10px]">+{nrs.length - 10}</Badge>}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
        {companies.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhuma empresa cadastrada.</div>}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editId} onOpenChange={(v) => !v && setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Empresa</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleUpdate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={editName} onChange={e => setEditName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>CNPJ</Label><Input value={editDocument} onChange={e => setEditDocument(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover esta empresa? Os funcionários vinculados não serão excluídos.</AlertDialogDescription>
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
