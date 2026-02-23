/**
 * AddRiskExposureDialog — Form to register a new risk exposure for an employee.
 */
import { useState } from 'react';
import { useCreateRiskExposure, useRiskFactors } from '@/domains/hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  employeeId: string;
  tenantId: string;
  companyId?: string;
  onSuccess?: () => void;
}

export function AddRiskExposureDialog({ employeeId, tenantId, companyId, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createMutation = useCreateRiskExposure();
  const { data: riskFactors = [] } = useRiskFactors();

  const [riskFactorId, setRiskFactorId] = useState('');
  const [riskLevel, setRiskLevel] = useState('medio');
  const [requiresEpi, setRequiresEpi] = useState(true);
  const [epiDescription, setEpiDescription] = useState('');
  const [generatesHazardPay, setGeneratesHazardPay] = useState(false);
  const [hazardPayType, setHazardPayType] = useState('');
  const [hazardPayPct, setHazardPayPct] = useState('');
  const [notes, setNotes] = useState('');

  function resetForm() {
    setRiskFactorId('');
    setRiskLevel('medio');
    setRequiresEpi(true);
    setEpiDescription('');
    setGeneratesHazardPay(false);
    setHazardPayType('');
    setHazardPayPct('');
    setNotes('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate(
      {
        employee_id: employeeId,
        risk_factor_id: riskFactorId,
        risk_level: riskLevel,
        requires_epi: requiresEpi,
        epi_description: epiDescription || undefined,
        generates_hazard_pay: generatesHazardPay,
        hazard_pay_type: generatesHazardPay ? hazardPayType || undefined : undefined,
        hazard_pay_percentage: generatesHazardPay ? parseFloat(hazardPayPct) || undefined : undefined,
        notes: notes || undefined,
        start_date: new Date().toISOString().split('T')[0],
        is_active: true,
        company_id: companyId,
      } as any,
      {
        onSuccess: () => {
          toast({ title: 'Exposição registrada', description: 'Exposição a risco registrada com sucesso.' });
          resetForm();
          setOpen(false);
          onSuccess?.();
        },
        onError: (err: any) => {
          toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Registrar Exposição
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Exposição a Risco</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Fator de Risco *</Label>
            <Select value={riskFactorId} onValueChange={setRiskFactorId}>
              <SelectTrigger><SelectValue placeholder="Selecione o fator" /></SelectTrigger>
              <SelectContent>
                {(riskFactors as any[]).map((rf: any) => (
                  <SelectItem key={rf.id} value={rf.id}>{rf.name || rf.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nível de Risco</Label>
            <Select value={riskLevel} onValueChange={setRiskLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="critico">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Requer EPI</Label>
            <Switch checked={requiresEpi} onCheckedChange={setRequiresEpi} />
          </div>

          {requiresEpi && (
            <div className="space-y-2">
              <Label>Descrição do EPI</Label>
              <Input value={epiDescription} onChange={e => setEpiDescription(e.target.value)} placeholder="Ex: Luvas, Óculos, Capacete" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>Gera Adicional de Periculosidade/Insalubridade</Label>
            <Switch checked={generatesHazardPay} onCheckedChange={setGeneratesHazardPay} />
          </div>

          {generatesHazardPay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={hazardPayType} onValueChange={setHazardPayType}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="insalubridade">Insalubridade</SelectItem>
                    <SelectItem value="periculosidade">Periculosidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Percentual (%)</Label>
                <Input type="number" min="0" max="100" value={hazardPayPct} onChange={e => setHazardPayPct(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={!riskFactorId || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Exposição
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
