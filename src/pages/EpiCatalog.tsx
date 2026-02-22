/**
 * EPI Catalog Page — CRUD for EPI items with CA validation
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, ShieldCheck, AlertTriangle, Package, Pencil, Trash2 } from 'lucide-react';
import { format, isPast, parseISO, differenceInDays } from 'date-fns';

const EPI_TIPOS = [
  { value: 'protecao_cabeca', label: 'Proteção da Cabeça' },
  { value: 'protecao_olhos', label: 'Proteção dos Olhos' },
  { value: 'protecao_auditiva', label: 'Proteção Auditiva' },
  { value: 'protecao_respiratoria', label: 'Proteção Respiratória' },
  { value: 'protecao_maos', label: 'Proteção das Mãos' },
  { value: 'protecao_pes', label: 'Proteção dos Pés' },
  { value: 'protecao_corpo', label: 'Proteção do Corpo' },
  { value: 'protecao_queda', label: 'Proteção contra Quedas' },
  { value: 'protecao_individual', label: 'Proteção Individual (Geral)' },
];

const RISCOS = [
  'Ruído', 'Poeira', 'Químico', 'Biológico', 'Calor', 'Frio',
  'Radiação', 'Vibração', 'Eletricidade', 'Queda', 'Impacto', 'Corte',
];

interface EpiForm {
  nome: string;
  tipo: string;
  fabricante: string;
  ca_numero: string;
  ca_validade: string;
  categoria: string;
  descricao: string;
  modelo: string;
  validade_meses: number;
  periodicidade_substituicao_dias: number | null;
  requer_treinamento: boolean;
  exige_termo_assinatura: boolean;
  nr_referencia: number | null;
  risco_relacionado: string[];
  is_active: boolean;
}

const emptyForm: EpiForm = {
  nome: '', tipo: 'protecao_individual', fabricante: '', ca_numero: '',
  ca_validade: '', categoria: 'geral', descricao: '', modelo: '',
  validade_meses: 12, periodicidade_substituicao_dias: null,
  requer_treinamento: false, exige_termo_assinatura: true,
  nr_referencia: null, risco_relacionado: [], is_active: true,
};

export default function EpiCatalogPage() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EpiForm>(emptyForm);

  const tenantId = currentTenant?.id;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['epi-catalog', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('epi_catalog')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: EpiForm) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      if (!values.ca_numero.trim()) throw new Error('Número do CA é obrigatório');

      const payload = {
        tenant_id: tenantId,
        nome: values.nome.trim(),
        tipo: values.tipo,
        fabricante: values.fabricante.trim() || null,
        ca_numero: values.ca_numero.trim(),
        ca_validade: values.ca_validade || null,
        categoria: values.categoria,
        descricao: values.descricao.trim() || null,
        modelo: values.modelo.trim() || null,
        validade_meses: values.validade_meses,
        periodicidade_substituicao_dias: values.periodicidade_substituicao_dias,
        requer_treinamento: values.requer_treinamento,
        exige_termo_assinatura: values.exige_termo_assinatura,
        nr_referencia: values.nr_referencia,
        risco_relacionado: values.risco_relacionado,
        is_active: values.is_active,
      };

      if (editingId) {
        const { error } = await supabase.from('epi_catalog').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('epi_catalog').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epi-catalog'] });
      toast.success(editingId ? 'EPI atualizado' : 'EPI cadastrado');
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('epi_catalog').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epi-catalog'] });
      toast.success('EPI desativado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: EpiForm & { id: string }) => {
    setEditingId(item.id);
    setForm({
      nome: item.nome ?? '',
      tipo: item.tipo ?? 'protecao_individual',
      fabricante: item.fabricante ?? '',
      ca_numero: item.ca_numero ?? '',
      ca_validade: item.ca_validade ?? '',
      categoria: item.categoria ?? 'geral',
      descricao: item.descricao ?? '',
      modelo: item.modelo ?? '',
      validade_meses: item.validade_meses ?? 12,
      periodicidade_substituicao_dias: item.periodicidade_substituicao_dias ?? null,
      requer_treinamento: item.requer_treinamento ?? false,
      exige_termo_assinatura: item.exige_termo_assinatura ?? true,
      nr_referencia: item.nr_referencia ?? null,
      risco_relacionado: item.risco_relacionado ?? [],
      is_active: item.is_active ?? true,
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); };

  const toggleRisco = (r: string) => {
    setForm(prev => ({
      ...prev,
      risco_relacionado: prev.risco_relacionado.includes(r)
        ? prev.risco_relacionado.filter(x => x !== r)
        : [...prev.risco_relacionado, r],
    }));
  };

  const getCaStatus = (ca_validade: string | null) => {
    if (!ca_validade) return null;
    const date = parseISO(ca_validade);
    if (isPast(date)) return 'vencido';
    const days = differenceInDays(date, new Date());
    if (days <= 90) return 'proximo';
    return 'valido';
  };

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.nome?.toLowerCase().includes(q) ||
      item.ca_numero?.toLowerCase().includes(q) ||
      item.fabricante?.toLowerCase().includes(q)
    );
  });

  const activeCount = items.filter((i) => i.is_active).length;
  const expiredCaCount = items.filter((i) => i.is_active && getCaStatus(i.ca_validade) === 'vencido').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo de EPI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os equipamentos de proteção individual disponíveis
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo EPI
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">EPIs Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount - expiredCaCount}</p>
              <p className="text-xs text-muted-foreground">CA Válidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{expiredCaCount}</p>
              <p className="text-xs text-muted-foreground">CA Vencidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CA ou fabricante..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>CA</TableHead>
                <TableHead>Validade CA</TableHead>
                <TableHead>Fabricante</TableHead>
                <TableHead>Riscos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum EPI encontrado</TableCell></TableRow>
              ) : (
                filtered.map((item) => {
                  const caStatus = getCaStatus(item.ca_validade);
                  return (
                    <TableRow key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell className="text-sm">
                        {EPI_TIPOS.find(t => t.value === item.tipo)?.label ?? item.tipo}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.ca_numero ?? '—'}</TableCell>
                      <TableCell>
                        {item.ca_validade ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{format(parseISO(item.ca_validade), 'dd/MM/yyyy')}</span>
                            {caStatus === 'vencido' && <Badge variant="destructive" className="text-[10px]">Vencido</Badge>}
                            {caStatus === 'proximo' && <Badge className="bg-amber-500/15 text-amber-700 text-[10px]">Vence em breve</Badge>}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{item.fabricante ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(item.risco_relacionado ?? []).slice(0, 3).map((r: string) => (
                            <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                          ))}
                          {(item.risco_relacionado ?? []).length > 3 && (
                            <Badge variant="outline" className="text-[10px]">+{item.risco_relacionado.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.is_active ? 'default' : 'secondary'}>
                          {item.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {item.is_active && (
                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar EPI' : 'Cadastrar EPI'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Capacete de Segurança" />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EPI_TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fabricante</Label>
              <Input value={form.fabricante} onChange={e => setForm(f => ({ ...f, fabricante: e.target.value }))} />
            </div>
            <div>
              <Label>Número CA *</Label>
              <Input value={form.ca_numero} onChange={e => setForm(f => ({ ...f, ca_numero: e.target.value }))} placeholder="Ex: 12345" />
            </div>
            <div>
              <Label>Validade CA</Label>
              <Input type="date" value={form.ca_validade} onChange={e => setForm(f => ({ ...f, ca_validade: e.target.value }))} />
              {form.ca_validade && isPast(parseISO(form.ca_validade)) && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> CA vencido! Entregas serão bloqueadas.
                </p>
              )}
            </div>
            <div>
              <Label>Modelo</Label>
              <Input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} />
            </div>
            <div>
              <Label>Validade (meses)</Label>
              <Input type="number" value={form.validade_meses} onChange={e => setForm(f => ({ ...f, validade_meses: parseInt(e.target.value) || 12 }))} />
            </div>
            <div>
              <Label>Periodicidade Substituição (dias)</Label>
              <Input type="number" value={form.periodicidade_substituicao_dias ?? ''} onChange={e => setForm(f => ({ ...f, periodicidade_substituicao_dias: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Opcional" />
            </div>
            <div>
              <Label>NR Referência</Label>
              <Input type="number" value={form.nr_referencia ?? ''} onChange={e => setForm(f => ({ ...f, nr_referencia: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Ex: 6" />
            </div>

            {/* Toggles */}
            <div className="col-span-2 flex gap-8">
              <div className="flex items-center gap-2">
                <Switch checked={form.requer_treinamento} onCheckedChange={v => setForm(f => ({ ...f, requer_treinamento: v }))} />
                <Label>Exige Treinamento</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.exige_termo_assinatura} onCheckedChange={v => setForm(f => ({ ...f, exige_termo_assinatura: v }))} />
                <Label>Exige Termo de Assinatura</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Ativo</Label>
              </div>
            </div>

            {/* Riscos */}
            <div className="col-span-2">
              <Label>Riscos Relacionados</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {RISCOS.map(r => (
                  <Badge
                    key={r}
                    variant={form.risco_relacionado.includes(r) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleRisco(r)}
                  >
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.nome.trim() || !form.ca_numero.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
