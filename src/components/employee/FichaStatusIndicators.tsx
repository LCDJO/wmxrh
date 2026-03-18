/**
 * Status Indicators for Ficha do Trabalhador
 *
 * Shows eSocial status, SST status, and pending legal items.
 */
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle, Clock, Shield, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EmployeeMasterRecord } from '@/domains/employee-master-record';

interface Props {
  record: EmployeeMasterRecord | null | undefined;
  employeeId: string;
  exams: any[];
}

interface StatusItem {
  label: string;
  status: 'ok' | 'warning' | 'error' | 'pending';
  detail: string;
}

const STATUS_ICON = {
  ok: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  pending: Clock,
} as const;

const STATUS_COLORS = {
  ok: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-destructive',
  pending: 'text-muted-foreground',
} as const;

const STATUS_BADGE_VARIANT = {
  ok: 'default' as const,
  warning: 'outline' as const,
  error: 'destructive' as const,
  pending: 'secondary' as const,
};

export function FichaStatusIndicators({ record, employeeId, exams }: Props) {
  // eSocial status from envelope events
  const { data: esocialEvents = [] } = useQuery({
    queryKey: ['esocial_status_indicator', employeeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('esocial_events')
        .select('event_type, status')
        .eq('source_entity_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
    staleTime: 30000,
  });

  const currentContract = record?.contracts
    ?.filter((c) => !c.deleted_at && c.is_current)
    .sort((a, b) => b.admission_date.localeCompare(a.admission_date))[0] ?? null;

  // Compute statuses
  const indicators: StatusItem[] = [];

  // 1. eSocial Status
  const hasAdmissionEvent = esocialEvents.some((e: any) => e.event_type === 'S-2200' || e.event_type === 'S-2300');
  const hasRejected = esocialEvents.some((e: any) => e.status === 'rejected' || e.status === 'error');
  if (hasRejected) {
    indicators.push({ label: 'eSocial', status: 'error', detail: 'Evento rejeitado' });
  } else if (hasAdmissionEvent) {
    indicators.push({ label: 'eSocial', status: 'ok', detail: 'Admissão transmitida' });
  } else if (record?.record?.status === 'ativo') {
    indicators.push({ label: 'eSocial', status: 'warning', detail: 'Admissão pendente' });
  } else {
    indicators.push({ label: 'eSocial', status: 'pending', detail: 'Aguardando' });
  }

  // 2. SST Status
  const hasAdmissionalExam = exams.some(
    (e: any) => (e.exam_type === 'admissional' || e.tipo_exame === 'admissional') && (e.result || e.status === 'realizado'),
  );
  const hasExpiredExam = exams.some((e: any) => {
    if (!e.next_exam_date) return false;
    return new Date(e.next_exam_date) < new Date();
  });
  
  if (hasExpiredExam) {
    indicators.push({ label: 'SST', status: 'error', detail: 'Exame vencido' });
  } else if (hasAdmissionalExam) {
    indicators.push({ label: 'SST', status: 'ok', detail: 'Exames em dia' });
  } else {
    indicators.push({ label: 'SST', status: 'warning', detail: 'Admissional pendente' });
  }

  // 3. Pendências Legais
  const pendencias: string[] = [];
  if (!currentContract?.cbo_code) pendencias.push('CBO');
  if (!record?.personalData?.pis_pasep_nit) pendencias.push('PIS/PASEP');
  if (!record?.personalData?.cpf) pendencias.push('CPF');
  if (record?.personalData?.cpf_lookup_status && !['resolved', 'not_attempted'].includes(record.personalData.cpf_lookup_status)) pendencias.push('Consulta CPF');
  if (!currentContract?.esocial_category) pendencias.push('Cat. eSocial');
  if ((record?.documents?.length ?? 0) === 0) pendencias.push('Documentos');

  if (pendencias.length === 0) {
    indicators.push({ label: 'Pendências', status: 'ok', detail: 'Nenhuma' });
  } else if (pendencias.length <= 2) {
    indicators.push({ label: 'Pendências', status: 'warning', detail: pendencias.join(', ') });
  } else {
    indicators.push({ label: 'Pendências', status: 'error', detail: `${pendencias.length} itens` });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {indicators.map((item) => {
        const Icon = STATUS_ICON[item.status];
        return (
          <div
            key={item.label}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5"
          >
            <Icon className={`h-3.5 w-3.5 ${STATUS_COLORS[item.status]}`} />
            <span className="text-xs font-medium text-card-foreground">{item.label}</span>
            <Badge variant={STATUS_BADGE_VARIANT[item.status]} className="text-[10px] px-1.5 py-0">
              {item.detail}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
