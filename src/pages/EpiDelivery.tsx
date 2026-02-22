/**
 * EPI Delivery Page — Registro formal de entrega de EPIs com assinatura digital
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Plus, Search, Package, AlertTriangle,
  FileSignature, CheckCircle2, XCircle, Send,
} from 'lucide-react';
import { format, isPast, parseISO, differenceInDays } from 'date-fns';
import {
  sendEpiDeliveryForSignature,
  quickSignEpiDelivery,
  getSignedDocumentUrl,
} from '@/domains/epi-lifecycle/epi-signature.integration';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface DeliveryRow {
  id: string;
  tenant_id: string;
  employee_id: string;
  epi_catalog_id: string;
  data_entrega: string;
  data_validade: string | null;
  quantidade: number;
  status: string;
  assinatura_status: string;
  hash_documento: string | null;
  storage_path: string | null;
  lote: string | null;
  ca_numero: string | null;
  motivo: string;
  observacoes: string | null;
  created_at: string;
  employees?: { name: string; email: string | null } | null;
  epi_catalog?: { nome: string; ca_numero: string | null; ca_validade: string | null } | null;
}

interface DeliveryForm {
  employee_id: string;
  epi_catalog_id: string;
  data_entrega: string;
  quantidade: number;
  motivo: string;
  lote: string;
  observacoes: string;
}

const MOTIVOS = [
  { value: 'entrega_inicial', label: 'Entrega Inicial' },
  { value: 'substituicao_desgaste', label: 'Substituição por Desgaste' },
  { value: 'substituicao_dano', label: 'Substituição por Dano' },
  { value: 'substituicao_vencimento', label: 'Substituição por Vencimento' },
  { value: 'novo_risco', label: 'Novo Risco Identificado' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  entregue: { label: 'Ativo', variant: 'default' },
  devolvido: { label: 'Devolvido', variant: 'secondary' },
  vencido: { label: 'Vencido', variant: 'destructive' },
  substituido: { label: 'Substituído', variant: 'outline' },
  extraviado: { label: 'Extraviado', variant: 'destructive' },
};

const SIGNATURE_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  sent: { label: 'Enviado', variant: 'secondary' },
  signed: { label: 'Assinado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  expired: { label: 'Expirado', variant: 'destructive' },
};

const emptyForm: DeliveryForm = {
  employee_id: '',
  epi_catalog_id: '',
  data_entrega: new Date().toISOString().split('T')[0],
  quantidade: 1,
  motivo: 'entrega_inicial',
  lote: '',
  observacoes: '',
};

export default function EpiDelivery() {
  const { currentTenant } = useTenant();
  const currentTenantId = currentTenant?.id;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<DeliveryForm>({ ...emptyForm });

  // ── Fetch deliveries ──
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['epi-deliveries', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from('epi_deliveries' as 'epi_deliveries' & string)
        .select(`*, employees:employee_id(name, email), epi_catalog:epi_catalog_id(nome, ca_numero, ca_validade)`)
        .eq('tenant_id', currentTenantId)
        .order('data_entrega', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DeliveryRow[];
    },
    enabled: !!currentTenantId,
  });

  // ── Fetch employees ──
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-select', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase
        .from('employees')
        .select('id, name, email')
        .eq('tenant_id', currentTenantId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('name');
      return data ?? [];
    },
    enabled: !!currentTenantId,
  });

  // ── Fetch EPI catalog ──
  const { data: epiItems = [] } = useQuery({
    queryKey: ['epi-catalog-select', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase
        .from('epi_catalog' as 'epi_catalog' & string)
        .select('id, nome, ca_numero, ca_validade, validade_meses')
        .eq('tenant_id', currentTenantId)
        .eq('is_active', true)
        .order('nome');
      return (data ?? []) as { id: string; nome: string; ca_numero: string | null; ca_validade: string | null; validade_meses: number | null }[];
    },
    enabled: !!currentTenantId,
  });

  // ── Create delivery mutation (auto-sends for signature) ──
  const createMutation = useMutation({
    mutationFn: async (input: DeliveryForm) => {
      const selectedEpi = epiItems.find((e: { id: string }) => e.id === input.epi_catalog_id);
      const selectedEmployee = employees.find((e: { id: string }) => e.id === input.employee_id);
      const validadeMeses = selectedEpi?.validade_meses ?? 12;
      const dataValidade = new Date(input.data_entrega);
      dataValidade.setMonth(dataValidade.getMonth() + validadeMeses);

      // 1. Create delivery
      const { data: delivery, error } = await supabase
        .from('epi_deliveries')
        .insert([{
          tenant_id: currentTenantId!,
          employee_id: input.employee_id,
          epi_catalog_id: input.epi_catalog_id,
          data_entrega: input.data_entrega,
          data_validade: dataValidade.toISOString().split('T')[0],
          quantidade: input.quantidade,
          motivo: input.motivo,
          lote: input.lote || null,
          ca_numero: selectedEpi?.ca_numero ?? null,
          observacoes: input.observacoes || null,
          status: 'entregue',
          assinatura_status: 'pending',
        }])
        .select()
        .single();

      if (error) throw error;
      const deliveryData = delivery as { id: string; [key: string]: unknown };

      // 2. Auto-send for digital signature
      try {
        await sendEpiDeliveryForSignature({
          deliveryId: deliveryData.id,
          tenantId: currentTenantId!,
          employeeName: selectedEmployee?.name ?? '',
          employeeEmail: selectedEmployee?.email ?? '',
          epiNome: selectedEpi?.nome ?? '',
          caNumero: selectedEpi?.ca_numero ?? '',
          dataEntrega: input.data_entrega,
          quantidade: input.quantidade,
          lote: input.lote || undefined,
          motivo: input.motivo,
        });
      } catch {
        // Signature sending is non-blocking; delivery was already created
        console.warn('Assinatura não enviada automaticamente');
      }

      return deliveryData;
    },
    onSuccess: () => {
      toast.success('Entrega registrada e termo enviado para assinatura');
      qc.invalidateQueries({ queryKey: ['epi-deliveries'] });
      setDialogOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Quick sign mutation ──
  const quickSignMutation = useMutation({
    mutationFn: async (delivery: DeliveryRow) => {
      const success = await quickSignEpiDelivery(delivery.id, delivery.tenant_id, delivery.employee_id);
      if (!success) throw new Error('Falha ao registrar assinatura');
    },
    onSuccess: () => {
      toast.success('Assinatura registrada com sucesso');
      qc.invalidateQueries({ queryKey: ['epi-deliveries'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Send for signature mutation ──
  const sendSignatureMutation = useMutation({
    mutationFn: async (delivery: DeliveryRow) => {
      const result = await sendEpiDeliveryForSignature({
        deliveryId: delivery.id,
        tenantId: delivery.tenant_id,
        employeeName: delivery.employees?.name ?? '',
        employeeEmail: delivery.employees?.email ?? '',
        epiNome: delivery.epi_catalog?.nome ?? '',
        caNumero: delivery.ca_numero ?? '',
        dataEntrega: delivery.data_entrega,
        quantidade: delivery.quantidade,
        lote: delivery.lote ?? undefined,
        motivo: delivery.motivo,
      });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      toast.success('Termo enviado para assinatura digital');
      qc.invalidateQueries({ queryKey: ['epi-deliveries'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── View signed document ──
  const handleViewDocument = async (deliveryId: string) => {
    const url = await getSignedDocumentUrl(deliveryId);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('Documento não encontrado');
    }
  };

  // ── Update status mutation ──
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: Record<string, string> = { status };
      if (status === 'devolvido') {
        updateData.data_devolucao = new Date().toISOString().split('T')[0];
      }
      const { error } = await supabase
        .from('epi_deliveries' as 'epi_deliveries' & string)
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['epi-deliveries'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Filter ──
  const filtered = deliveries.filter((d) => {
    const matchSearch =
      !search ||
      (d.employees?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.epi_catalog?.nome ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.ca_numero ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── KPIs ──
  const totalActive = deliveries.filter((d) => d.status === 'entregue').length;
  const totalExpired = deliveries.filter(
    (d) => d.status === 'entregue' && d.data_validade && isPast(parseISO(d.data_validade)),
  ).length;
  const pendingSignatures = deliveries.filter(
    (d) => d.assinatura_status === 'pending' || d.assinatura_status === 'sent',
  ).length;
  const nearExpiry = deliveries.filter((d) => {
    if (d.status !== 'entregue' || !d.data_validade) return false;
    const days = differenceInDays(parseISO(d.data_validade), new Date());
    return days > 0 && days <= 30;
  }).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Entrega de EPI</h1>
          <p className="text-sm text-muted-foreground">Registro formal com assinatura digital obrigatória</p>
        </div>
        <Button onClick={() => { setForm({ ...emptyForm }); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nova Entrega
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">EPIs Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span className="text-2xl font-bold">{totalActive}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assinaturas Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{pendingSignatures}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold">{totalExpired}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencendo em 30 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{nearExpiry}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por colaborador, EPI ou CA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="entregue">Ativos</SelectItem>
            <SelectItem value="devolvido">Devolvidos</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
            <SelectItem value="substituido">Substituídos</SelectItem>
            <SelectItem value="extraviado">Extraviados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>EPI</TableHead>
                <TableHead>CA</TableHead>
                <TableHead>Data Entrega</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma entrega encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d) => {
                  const isExpired = d.data_validade && isPast(parseISO(d.data_validade));
                  const daysToExpiry = d.data_validade
                    ? differenceInDays(parseISO(d.data_validade), new Date())
                    : null;
                  const statusCfg = STATUS_CONFIG[d.status] ?? { label: d.status, variant: 'outline' as const };
                  const sigCfg = SIGNATURE_CONFIG[d.assinatura_status] ?? { label: d.assinatura_status, variant: 'outline' as const };

                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.employees?.name ?? '—'}</TableCell>
                      <TableCell>{d.epi_catalog?.nome ?? '—'}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{d.ca_numero ?? '—'}</span>
                      </TableCell>
                      <TableCell>{format(parseISO(d.data_entrega), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        {d.data_validade ? (
                          <div className="flex items-center gap-1">
                            <span className={isExpired ? 'text-destructive font-medium' : ''}>
                              {format(parseISO(d.data_validade), 'dd/MM/yyyy')}
                            </span>
                            {d.status === 'entregue' && isExpired && (
                              <Badge variant="destructive" className="text-[10px] px-1">VENCIDO</Badge>
                            )}
                            {d.status === 'entregue' && !isExpired && daysToExpiry !== null && daysToExpiry <= 30 && (
                              <Badge variant="outline" className="text-[10px] px-1 text-amber-600 border-amber-400">
                                {daysToExpiry}d
                              </Badge>
                            )}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{d.quantidade}</TableCell>
                      <TableCell>
                        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant={sigCfg.variant} className="cursor-help">
                              {d.assinatura_status === 'signed' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                              {sigCfg.label}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {d.hash_documento
                              ? `Hash: ${d.hash_documento.substring(0, 16)}...`
                              : 'Aguardando assinatura'}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {/* Signature actions */}
                          {d.assinatura_status === 'pending' && d.status === 'entregue' && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => sendSignatureMutation.mutate(d)}
                                    disabled={sendSignatureMutation.isPending}
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Enviar para assinatura digital</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => quickSignMutation.mutate(d)}
                                    disabled={quickSignMutation.isPending}
                                  >
                                    <FileSignature className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Assinatura presencial (rápida)</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                          {d.assinatura_status === 'signed' && d.storage_path && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => handleViewDocument(d.id)}
                            >
                              Ver PDF
                            </Button>
                          )}
                          {/* Delivery actions */}
                          {d.status === 'entregue' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => updateStatusMutation.mutate({ id: d.id, status: 'devolvido' })}
                              >
                                Devolver
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-destructive"
                                onClick={() => updateStatusMutation.mutate({ id: d.id, status: 'extraviado' })}
                              >
                                Extravio
                              </Button>
                            </>
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

      {/* New Delivery Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Entrega de EPI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              <FileSignature className="inline-block mr-2 h-4 w-4 text-primary" />
              O Termo de Entrega será gerado automaticamente e enviado para assinatura digital do colaborador.
            </div>
            <div>
              <Label>Colaborador *</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>EPI *</Label>
              <Select value={form.epi_catalog_id} onValueChange={(v) => setForm({ ...form, epi_catalog_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o EPI" /></SelectTrigger>
                <SelectContent>
                  {epiItems.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome} {e.ca_numero ? `(CA: ${e.ca_numero})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Entrega *</Label>
                <Input
                  type="date"
                  value={form.data_entrega}
                  onChange={(e) => setForm({ ...form, data_entrega: e.target.value })}
                />
              </div>
              <div>
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div>
              <Label>Motivo *</Label>
              <Select value={form.motivo} onValueChange={(v) => setForm({ ...form, motivo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lote</Label>
              <Input
                value={form.lote}
                onChange={(e) => setForm({ ...form, lote: e.target.value })}
                placeholder="Número do lote (opcional)"
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.employee_id || !form.epi_catalog_id || createMutation.isPending}
            >
              {createMutation.isPending ? 'Registrando...' : 'Registrar e Enviar Termo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
