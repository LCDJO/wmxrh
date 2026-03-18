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
import { CpfLookupDisabledError, externalDataService } from '@/domains/occupational-intelligence/external-data.service';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  companies: { id: string; name: string }[];
}

type CpfLookupStatus = 'resolved' | 'pending_manual' | 'integration_off' | 'lookup_failed' | 'not_attempted';

export function StartHiringDialog({ open, onOpenChange, tenantId, companies }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { canAddMore, remaining, maxAllowed, currentCount } = useEmployeeLimit();

  const [candidateName, setCandidateName] = useState('');
  const [candidateCpf, setCandidateCpf] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [cpfLookupLoading, setCpfLookupLoading] = useState(false);
  const [lastResolvedCpf, setLastResolvedCpf] = useState<string | null>(null);
  const [cpfLookupStatus, setCpfLookupStatus] = useState<CpfLookupStatus>('not_attempted');
  const [cpfLookupPendingReason, setCpfLookupPendingReason] = useState<string | null>(null);
  const [cpfLookupSource, setCpfLookupSource] = useState<string | null>(null);

  const resetForm = () => {
    setCandidateName('');
    setCandidateCpf('');
    setCompanyId('');
    setLastResolvedCpf(null);
    setCpfLookupStatus('not_attempted');
    setCpfLookupPendingReason(null);
    setCpfLookupSource(null);
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const resolveCpf = async (cpfValue: string) => {
    const cleanedCpf = cpfValue.replace(/\D/g, '').slice(0, 11);
    if (cleanedCpf.length !== 11 || cleanedCpf === lastResolvedCpf || cpfLookupLoading) {
      return null;
    }

    setCpfLookupLoading(true);
    try {
      const result = await externalDataService.resolveCpf(cleanedCpf, tenantId);
      if (result.nome) {
        setCandidateName((prev) => prev.trim() || result.nome || '');
      }
      setLastResolvedCpf(cleanedCpf);
      setCpfLookupStatus('resolved');
      setCpfLookupPendingReason(null);
      setCpfLookupSource(result.source);
      return result;
    } catch (error) {
      const isIntegrationOff = error instanceof CpfLookupDisabledError;
      setCpfLookupStatus(isIntegrationOff ? 'integration_off' : 'lookup_failed');
      setCpfLookupPendingReason(
        isIntegrationOff
          ? 'Consulta automática de CPF desativada; validação manual pendente.'
          : 'Consulta automática de CPF não concluída; validação manual pendente.'
      );
      setCpfLookupSource(null);
      return null;
    } finally {
      setCpfLookupLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canAddMore) {
      toast({ title: `Limite de ${maxAllowed} colaboradores atingido`, description: 'Faça upgrade do plano para adicionar mais.', variant: 'destructive' });
      return;
    }

    const cleanedCpf = candidateCpf.replace(/\D/g, '');
    if (!cleanedCpf || cleanedCpf.length < 11) {
      toast({ title: 'CPF inválido', variant: 'destructive' });
      return;
    }
    if (!companyId) {
      toast({ title: 'Selecione a empresa', variant: 'destructive' });
      return;
    }

    let resolvedName = candidateName.trim();
    let nextCpfLookupStatus = cpfLookupStatus;
    let nextCpfLookupPendingReason = cpfLookupPendingReason;
    let nextCpfLookupSource = cpfLookupSource;

    if (cleanedCpf.length === 11 && cpfLookupStatus !== 'resolved') {
      const result = await resolveCpf(cleanedCpf);
      if (result?.nome) {
        resolvedName = resolvedName || result.nome;
      }
      nextCpfLookupStatus = result ? 'resolved' : (cpfLookupStatus === 'not_attempted' ? 'pending_manual' : cpfLookupStatus);
      nextCpfLookupPendingReason = result ? null : (cpfLookupPendingReason ?? 'Consulta automática de CPF ainda não concluída.');
      nextCpfLookupSource = result?.source ?? cpfLookupSource;
    }

    if (!resolvedName) {
      toast({ title: 'Nome do candidato é obrigatório', description: 'Informe manualmente caso a consulta automática não preencha o nome.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const now = new Date().toISOString();
      const initialSteps: HiringStepState[] = HIRING_STEPS.map((step, i) => ({
        step,
        status: i === 0 ? 'in_progress' : 'pending',
        started_at: i === 0 ? now : null,
        completed_at: null,
        error_message: null,
        metadata: i === 0
          ? {
              cpf_lookup_status: nextCpfLookupStatus,
              cpf_lookup_pending_reason: nextCpfLookupPendingReason,
              cpf_lookup_checked_at: nextCpfLookupStatus === 'not_attempted' ? null : now,
              cpf_lookup_source: nextCpfLookupSource,
            }
          : {},
      }));

      const { error } = await supabase
        .from('hiring_processes' as any)
        .insert({
          tenant_id: tenantId,
          company_id: companyId,
          candidate_name: resolvedName,
          candidate_cpf: cleanedCpf,
          status: 'draft',
          current_step: 'personal_data',
          steps: initialSteps,
          created_by: user.id,
          data_inicio: now,
        });

      if (error) throw error;

      toast({
        title: 'Admissão iniciada com sucesso!',
        description: nextCpfLookupStatus === 'resolved'
          ? `Workflow para ${resolvedName} criado com CPF validado.`
          : `Workflow para ${resolvedName} criado com pendência de validação do CPF.`,
      });
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
            <Label htmlFor="hire-cpf">CPF *</Label>
            <div className="relative">
              <Input
                id="hire-cpf"
                placeholder="000.000.000-00"
                value={candidateCpf}
                onChange={(e) => {
                  const formatted = formatCpf(e.target.value);
                  const cleaned = formatted.replace(/\D/g, '').slice(0, 11);
                  setCandidateCpf(formatted);
                  if (cleaned !== lastResolvedCpf) {
                    setLastResolvedCpf(null);
                  }
                  setCpfLookupStatus(cleaned.length === 11 ? 'pending_manual' : 'not_attempted');
                  setCpfLookupPendingReason(cleaned.length === 11 ? 'Consulta automática de CPF ainda não concluída.' : null);
                  setCpfLookupSource(null);
                }}
                onBlur={() => void resolveCpf(candidateCpf)}
                maxLength={14}
              />
              {cpfLookupLoading && <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground">
              A consulta do CPF acontece já no início da admissão; se a integração estiver indisponível, o fluxo segue com pendência.
            </p>
            {cpfLookupStatus !== 'resolved' && cpfLookupStatus !== 'not_attempted' && cpfLookupPendingReason && (
              <p className="text-xs text-muted-foreground">{cpfLookupPendingReason}</p>
            )}
          </div>

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
                'Consulta CPF', 'Dados Pessoais', 'Documentos', 'Endereço', 'Dependentes',
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
          <Button onClick={handleSubmit} disabled={saving || !canAddMore || cpfLookupLoading} className="gap-2">
            {(saving || cpfLookupLoading) && <Loader2 className="h-4 w-4 animate-spin" />}
            <Rocket className="h-4 w-4" />
            Iniciar Admissão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
