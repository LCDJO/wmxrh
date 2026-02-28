/**
 * StartHiringDialog — Modal to kick off an automated hiring workflow
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Rocket, AlertTriangle } from 'lucide-react';
import { HIRING_STEPS, type HiringStepState } from '@/domains/automated-hiring/types';
import { useEmployeeLimit } from '@/hooks/use-employee-limit';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  companies: { id: string; name: string }[];
}

export function StartHiringDialog({ open, onOpenChange, tenantId, companies }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { canAddMore, remaining, maxAllowed, currentCount, loading: limitLoading } = useEmployeeLimit();

  const [candidateName, setCandidateName] = useState('');
  const [candidateCpf, setCandidateCpf] = useState('');
  const [companyId, setCompanyId] = useState('');

  const resetForm = () => {
    setCandidateName('');
    setCandidateCpf('');
    setCompanyId('');
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleSubmit = async () => {
    if (!canAddMore) {
      toast({ title: `Limite de ${maxAllowed} colaboradores atingido`, description: 'Faça upgrade do plano para adicionar mais.', variant: 'destructive' });
      return;
    }
    if (!candidateName.trim()) {
      toast({ title: 'Nome do candidato é obrigatório', variant: 'destructive' });
      return;
    }
    if (!candidateCpf.replace(/\D/g, '') || candidateCpf.replace(/\D/g, '').length < 11) {
      toast({ title: 'CPF inválido', variant: 'destructive' });
      return;
    }
    if (!companyId) {
      toast({ title: 'Selecione a empresa', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const initialSteps: HiringStepState[] = HIRING_STEPS.map((step, i) => ({
        step,
        status: i === 0 ? 'in_progress' : 'pending',
        started_at: i === 0 ? new Date().toISOString() : null,
        completed_at: null,
        error_message: null,
        metadata: {},
      }));

      const { error } = await supabase
        .from('hiring_processes' as any)
        .insert({
          tenant_id: tenantId,
          company_id: companyId,
          candidate_name: candidateName.trim(),
          candidate_cpf: candidateCpf.replace(/\D/g, ''),
          status: 'draft',
          current_step: 'personal_data',
          steps: initialSteps,
          created_by: user.id,
          data_inicio: new Date().toISOString(),
        });

      if (error) throw error;

      toast({ title: 'Admissão iniciada com sucesso!', description: `Workflow para ${candidateName.trim()} criado.` });
      queryClient.invalidateQueries({ queryKey: ['hiring_workflows'] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao iniciar admissão', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Rocket className="h-5 w-5 text-primary" />
            Nova Admissão Automatizada
          </DialogTitle>
          <DialogDescription>
            Inicie o fluxo de admissão com validações legais, SST e compliance integrados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {!canAddMore && maxAllowed !== null && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Limite de colaboradores atingido</p>
                <p className="text-xs text-muted-foreground">
                  Seu plano permite até {maxAllowed} colaboradores ({currentCount} ativos). Faça upgrade para continuar.
                </p>
              </div>
            </div>
          )}
          {canAddMore && remaining !== null && remaining <= 3 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Restam apenas <strong>{remaining}</strong> vaga(s) no seu plano ({currentCount}/{maxAllowed}).
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="hire-name">Nome do Candidato *</Label>
            <Input
              id="hire-name"
              placeholder="Nome completo"
              value={candidateName}
              onChange={e => setCandidateName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hire-cpf">CPF *</Label>
            <Input
              id="hire-cpf"
              placeholder="000.000.000-00"
              value={candidateCpf}
              onChange={e => setCandidateCpf(formatCpf(e.target.value))}
              maxLength={14}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Empresa *</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Etapas que serão executadas:</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Dados Pessoais', 'Documentos', 'Endereço', 'Dependentes',
                'Cargo', 'Perfil Ocupacional', 'Contrato', 'Exame Admissional',
                'Treinamentos NR', 'EPIs', 'Termos', 'Compliance Gate',
                'eSocial', 'Ativação',
              ].map(label => (
                <span key={label} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !canAddMore} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Rocket className="h-4 w-4" />
            Iniciar Admissão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
