/**
 * AddEpiDeliveryDialog — Form to register a new EPI delivery for an employee.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/core/use-toast';

interface Props {
  employeeId: string;
  tenantId: string;
  companyId?: string;
  onSuccess?: () => void;
}

export function AddEpiDeliveryDialog({ employeeId, tenantId, companyId, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [catalogId, setCatalogId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [motivo, setMotivo] = useState('entrega_inicial');
  const [caNumero, setCaNumero] = useState('');
  const [lote, setLote] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const { data: catalog = [] } = useQuery({
    queryKey: ['epi_catalog', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('epi_catalog' as any)
        .select('id, nome, ca_numero, validade_meses')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open && !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const selectedEpi = catalog.find((c: any) => c.id === catalogId);
      const validadeMeses = selectedEpi?.validade_meses;
      const dataEntrega = new Date().toISOString().split('T')[0];
      let dataValidade: string | null = null;
      if (validadeMeses) {
        const d = new Date();
        d.setMonth(d.getMonth() + validadeMeses);
        dataValidade = d.toISOString().split('T')[0];
      }

      const { error } = await supabase.from('epi_deliveries' as any).insert({
        tenant_id: tenantId,
        company_id: companyId ?? null,
        employee_id: employeeId,
        epi_catalog_id: catalogId,
        quantidade: parseInt(quantidade) || 1,
        motivo,
        data_entrega: dataEntrega,
        data_validade: dataValidade,
        ca_numero: caNumero || selectedEpi?.ca_numero || null,
        lote: lote || null,
        observacoes: observacoes || null,
        status: 'entregue',
        assinatura_status: 'pendente',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'EPI registrado', description: 'Entrega de EPI registrada com sucesso.' });
      qc.invalidateQueries({ queryKey: ['employee-epis', employeeId] });
      resetForm();
      setOpen(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  function resetForm() {
    setCatalogId('');
    setQuantidade('1');
    setMotivo('entrega_inicial');
    setCaNumero('');
    setLote('');
    setObservacoes('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Registrar Entrega
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Entrega de EPI</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>EPI *</Label>
            <Select value={catalogId} onValueChange={setCatalogId}>
              <SelectTrigger><SelectValue placeholder="Selecione o EPI" /></SelectTrigger>
              <SelectContent>
                {catalog.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.ca_numero ? `(CA ${c.ca_numero})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrega_inicial">Entrega Inicial</SelectItem>
                  <SelectItem value="substituicao_desgaste">Desgaste</SelectItem>
                  <SelectItem value="substituicao_dano">Dano</SelectItem>
                  <SelectItem value="substituicao_vencimento">Vencimento</SelectItem>
                  <SelectItem value="novo_risco">Novo Risco</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>CA Número</Label>
              <Input value={caNumero} onChange={e => setCaNumero(e.target.value)} placeholder="Auto do catálogo" />
            </div>
            <div className="space-y-2">
              <Label>Lote</Label>
              <Input value={lote} onChange={e => setLote(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={!catalogId || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Entrega
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
