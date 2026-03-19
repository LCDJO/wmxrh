/**
 * AddNrTrainingDialog — Form to assign an NR training to an employee.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

const NR_LIST = [
  { nr: 1, name: 'Disposições Gerais e Gerenciamento de Riscos' },
  { nr: 5, name: 'CIPA' },
  { nr: 6, name: 'EPI' },
  { nr: 7, name: 'PCMSO' },
  { nr: 10, name: 'Segurança em Instalações Elétricas' },
  { nr: 11, name: 'Transporte e Movimentação de Cargas' },
  { nr: 12, name: 'Segurança no Trabalho em Máquinas' },
  { nr: 17, name: 'Ergonomia' },
  { nr: 18, name: 'Segurança na Construção' },
  { nr: 20, name: 'Líquidos Combustíveis e Inflamáveis' },
  { nr: 23, name: 'Proteção Contra Incêndios' },
  { nr: 33, name: 'Espaços Confinados' },
  { nr: 35, name: 'Trabalho em Altura' },
];

export function AddNrTrainingDialog({ employeeId, tenantId, companyId, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [nrNumber, setNrNumber] = useState('');
  const [trainingName, setTrainingName] = useState('');
  const [requiredHours, setRequiredHours] = useState('8');
  const [blockingLevel, setBlockingLevel] = useState('warning');
  const [validityMonths, setValidityMonths] = useState('24');
  const [instrutor, setInstrutor] = useState('');
  const [legalBasis, setLegalBasis] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const selectedNr = NR_LIST.find(n => n.nr === parseInt(nrNumber));
      const name = trainingName || selectedNr?.name || `NR-${nrNumber}`;
      
      const { error } = await supabase.from('nr_training_assignments' as any).insert({
        tenant_id: tenantId,
        company_id: companyId ?? null,
        employee_id: employeeId,
        nr_number: parseInt(nrNumber),
        training_name: name,
        status: 'assigned',
        trigger: 'manual',
        required_hours: parseFloat(requiredHours) || 8,
        blocking_level: blockingLevel,
        is_renewal: false,
        renewal_number: 0,
        validity_months: parseInt(validityMonths) || null,
        instrutor: instrutor || null,
        legal_basis: legalBasis || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Treinamento atribuído', description: 'Treinamento NR registrado com sucesso.' });
      qc.invalidateQueries({ queryKey: ['nr_training_by_employee', employeeId] });
      resetForm();
      setOpen(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  function resetForm() {
    setNrNumber('');
    setTrainingName('');
    setRequiredHours('8');
    setBlockingLevel('warning');
    setValidityMonths('24');
    setInstrutor('');
    setLegalBasis('');
  }

  function handleNrChange(val: string) {
    setNrNumber(val);
    const found = NR_LIST.find(n => n.nr === parseInt(val));
    if (found && !trainingName) setTrainingName(found.name);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Atribuir Treinamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Treinamento NR</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Norma Regulamentadora *</Label>
            <Select value={nrNumber} onValueChange={handleNrChange}>
              <SelectTrigger><SelectValue placeholder="Selecione a NR" /></SelectTrigger>
              <SelectContent>
                {NR_LIST.map(nr => (
                  <SelectItem key={nr.nr} value={String(nr.nr)}>
                    NR-{nr.nr} — {nr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nome do Treinamento</Label>
            <Input value={trainingName} onChange={e => setTrainingName(e.target.value)} placeholder="Auto-preenchido pela NR" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Horas</Label>
              <Input type="number" min="1" value={requiredHours} onChange={e => setRequiredHours(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Validade (meses)</Label>
              <Input type="number" min="1" value={validityMonths} onChange={e => setValidityMonths(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nível Bloqueio</Label>
              <Select value={blockingLevel} onValueChange={setBlockingLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hard_block">Bloqueio Total</SelectItem>
                  <SelectItem value="soft_block">Restrição</SelectItem>
                  <SelectItem value="warning">Alerta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Instrutor</Label>
            <Input value={instrutor} onChange={e => setInstrutor(e.target.value)} placeholder="Nome do instrutor" />
          </div>

          <div className="space-y-2">
            <Label>Base Legal</Label>
            <Textarea value={legalBasis} onChange={e => setLegalBasis(e.target.value)} rows={2} placeholder="Ex: NR-35 item 35.3.2" />
          </div>

          <Button type="submit" className="w-full" disabled={!nrNumber || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Atribuir Treinamento
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
