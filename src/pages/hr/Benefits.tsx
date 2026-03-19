import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useBenefitPlans, useCreateBenefitPlan, useUpdateBenefitPlan, useDeleteBenefitPlan } from '@/domains/hooks';
import { usePermissions } from '@/domains/security';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type BenefitType = Database['public']['Enums']['benefit_type'];

const TYPE_LABELS: Record<string, string> = {
  va: 'Vale Alimentação', vr: 'Vale Refeição', vt: 'Vale Transporte',
  health: 'Plano de Saúde', dental: 'Plano Odontológico',
};

const BENEFIT_TYPES: { value: BenefitType; label: string }[] = [
  { value: 'va', label: 'Vale Alimentação' },
  { value: 'vr', label: 'Vale Refeição' },
  { value: 'vt', label: 'Vale Transporte' },
  { value: 'health', label: 'Plano de Saúde' },
  { value: 'dental', label: 'Plano Odontológico' },
];

export default function Benefits() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { toast } = useToast();
  const { data: plans = [], isLoading } = useBenefitPlans();
  const createMutation = useCreateBenefitPlan();
  const updateMutation = useUpdateBenefitPlan();
  const deleteMutation = useDeleteBenefitPlan();
  const { canManageEmployees } = usePermissions();

  const [open, setOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<BenefitType>('va');
  const [formValue, setFormValue] = useState('');
  const [formProvider, setFormProvider] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editProvider, setEditProvider] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!tenantId || !formName) return;
    createMutation.mutate({
      tenant_id: tenantId, name: formName, benefit_type: formType,
      base_value: parseFloat(formValue) || 0, provider: formProvider || null,
    }, {
      onSuccess: () => { toast({ title: 'Benefício criado!' }); setOpen(false); setFormName(''); setFormValue(''); setFormProvider(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleUpdate = () => {
    if (!editId) return;
    updateMutation.mutate({ id: editId, name: editName, base_value: parseFloat(editValue) || 0, provider: editProvider || null }, {
      onSuccess: () => { toast({ title: 'Benefício atualizado!' }); setEditId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => { toast({ title: 'Benefício removido!' }); setDeleteId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const openEdit = (plan: typeof plans[0]) => {
    setEditId(plan.id); setEditName(plan.name); setEditValue(String(plan.base_value));
    setEditProvider(plan.provider || '');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Benefícios</h1>
          <p className="text-muted-foreground">{plans.length} planos cadastrados</p>
        </div>
        {canManageEmployees && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Novo Benefício</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Plano de Benefício</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-4">
                <div className="space-y-2"><Label>Nome *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} required /></div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={formType} onValueChange={(v) => setFormType(v as BenefitType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BENEFIT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Valor Base</Label><Input type="number" value={formValue} onChange={e => setFormValue(e.target.value)} placeholder="0.00" /></div>
                <div className="space-y-2"><Label>Operadora</Label><Input value={formProvider} onChange={e => setFormProvider(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Criando...' : 'Criar'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : plans.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum plano de benefício cadastrado.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map(plan => (
            <Card key={plan.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{plan.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[plan.benefit_type] || plan.benefit_type}</Badge>
                    {canManageEmployees && (
                      <>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(plan)}><Pencil className="h-3 w-3 text-muted-foreground" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(plan.id)}><Trash2 className="h-3 w-3" /></Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                {plan.provider && <p>Operadora: {plan.provider}</p>}
                <p>Valor base: R$ {Number(plan.base_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p>Empresa paga: {plan.employer_percentage ?? 100}% | Desconto func.: {plan.employee_discount_percentage ?? 0}%</p>
                {plan.has_coparticipation && <Badge variant="secondary" className="text-[10px]">Coparticipação</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editId} onOpenChange={(v) => !v && setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Benefício</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleUpdate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={editName} onChange={e => setEditName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Valor Base</Label><Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} /></div>
            <div className="space-y-2"><Label>Operadora</Label><Input value={editProvider} onChange={e => setEditProvider(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja desativar este plano de benefício?</AlertDialogDescription>
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
