import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import { useHealthPrograms, useHealthExams, useCreateHealthProgram, useUpdateHealthProgram, useDeleteHealthProgram } from '@/domains/hooks';
import { usePermissions } from '@/domains/security';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PROGRAM_LABELS: Record<string, string> = { pcmso: 'PCMSO', pgr: 'PGR', ltcat: 'LTCAT', ppra: 'PPRA' };
const EXAM_LABELS: Record<string, string> = { admissional: 'Admissional', periodico: 'Periódico', demissional: 'Demissional', mudanca_funcao: 'Mudança Função', retorno_trabalho: 'Retorno' };
const RESULT_LABELS: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' }> = {
  apto: { label: 'Apto', variant: 'default' },
  inapto: { label: 'Inapto', variant: 'destructive' },
  apto_restricao: { label: 'Apto c/ Restrição', variant: 'secondary' },
};

const PROGRAM_TYPES = [
  { value: 'pcmso', label: 'PCMSO' },
  { value: 'pgr', label: 'PGR' },
  { value: 'ltcat', label: 'LTCAT' },
  { value: 'ppra', label: 'PPRA' },
];

export default function Health() {
  const { currentTenant } = useTenant();
  const { scope } = useScope();
  const tenantId = currentTenant?.id;
  const { toast } = useToast();
  const { data: programs = [], isLoading: loadingPrograms } = useHealthPrograms();
  const { data: exams = [], isLoading: loadingExams } = useHealthExams();
  const createProgram = useCreateHealthProgram();
  const updateProgram = useUpdateHealthProgram();
  const deleteProgram = useDeleteHealthProgram();
  const { canManageEmployees } = usePermissions();

  const [open, setOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('pcmso');
  const [formValidFrom, setFormValidFrom] = useState('');
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formResponsible, setFormResponsible] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editResponsible, setEditResponsible] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!tenantId || !formName || !formValidFrom || !formValidUntil) return;
    if (!scope.companyId) {
      toast({ title: 'Selecione uma empresa no seletor de escopo antes de criar o programa.', variant: 'destructive' });
      return;
    }
    createProgram.mutate({
      tenant_id: tenantId, company_id: scope.companyId, name: formName, program_type: formType as any,
      valid_from: formValidFrom, valid_until: formValidUntil,
      responsible_name: formResponsible || null,
    }, {
      onSuccess: () => { toast({ title: 'Programa criado!' }); setOpen(false); setFormName(''); setFormValidFrom(''); setFormValidUntil(''); setFormResponsible(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleUpdate = () => {
    if (!editId) return;
    updateProgram.mutate({ id: editId, name: editName, valid_until: editValidUntil, responsible_name: editResponsible || null }, {
      onSuccess: () => { toast({ title: 'Programa atualizado!' }); setEditId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteProgram.mutate(deleteId, {
      onSuccess: () => { toast({ title: 'Programa removido!' }); setDeleteId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const openEdit = (p: typeof programs[0]) => {
    setEditId(p.id); setEditName(p.name); setEditValidUntil(p.valid_until?.split('T')[0] || '');
    setEditResponsible(p.responsible_name || '');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Saúde Ocupacional</h1>
          <p className="text-muted-foreground">Programas, exames e controle de ASOs</p>
        </div>
        {canManageEmployees && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Novo Programa</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Programa de Saúde</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-4">
                <div className="space-y-2"><Label>Nome *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} required /></div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PROGRAM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Válido desde *</Label><Input type="date" value={formValidFrom} onChange={e => setFormValidFrom(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Válido até *</Label><Input type="date" value={formValidUntil} onChange={e => setFormValidUntil(e.target.value)} required /></div>
                </div>
                <div className="space-y-2"><Label>Responsável</Label><Input value={formResponsible} onChange={e => setFormResponsible(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={createProgram.isPending}>{createProgram.isPending ? 'Criando...' : 'Criar'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">Programas ({programs.length})</TabsTrigger>
          <TabsTrigger value="exams">Exames / ASOs ({exams.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="mt-4">
          {loadingPrograms ? <p className="text-muted-foreground">Carregando...</p> : programs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum programa cadastrado.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {programs.map(p => {
                const isExpired = new Date(p.valid_until) < new Date();
                return (
                  <Card key={p.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{p.name}</CardTitle>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">{PROGRAM_LABELS[p.program_type]}</Badge>
                          <Badge variant={isExpired ? 'destructive' : 'default'} className="text-[10px]">{isExpired ? 'Vencido' : 'Vigente'}</Badge>
                          {canManageEmployees && (
                            <>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(p)}><Pencil className="h-3 w-3 text-muted-foreground" /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3 w-3" /></Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <p>Validade: {new Date(p.valid_from).toLocaleDateString('pt-BR')} — {new Date(p.valid_until).toLocaleDateString('pt-BR')}</p>
                      {p.responsible_name && <p>Responsável: {p.responsible_name} ({p.responsible_registration})</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="exams" className="mt-4">
          {loadingExams ? <p className="text-muted-foreground">Carregando...</p> : exams.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum exame registrado.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {exams.map(e => {
                const r = RESULT_LABELS[e.result] || { label: e.result, variant: 'secondary' as const };
                return (
                  <Card key={e.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{EXAM_LABELS[e.exam_type] || e.exam_type}</CardTitle>
                        <Badge variant={r.variant} className="text-[10px]">{r.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <p>Data: {new Date(e.exam_date).toLocaleDateString('pt-BR')}</p>
                      {e.expiry_date && <p>Validade: {new Date(e.expiry_date).toLocaleDateString('pt-BR')}</p>}
                      {e.physician_name && <p>Médico: {e.physician_name} — CRM {e.physician_crm}</p>}
                      {e.cbo_code && <p>CBO: {e.cbo_code}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editId} onOpenChange={(v) => !v && setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Programa</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleUpdate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={editName} onChange={e => setEditName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Válido até</Label><Input type="date" value={editValidUntil} onChange={e => setEditValidUntil(e.target.value)} /></div>
            <div className="space-y-2"><Label>Responsável</Label><Input value={editResponsible} onChange={e => setEditResponsible(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={updateProgram.isPending}>{updateProgram.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover este programa de saúde?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteProgram.isPending ? 'Removendo...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
