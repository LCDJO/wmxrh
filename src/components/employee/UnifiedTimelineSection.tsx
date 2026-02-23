/**
 * UnifiedTimelineSection — Extracted timeline tab from EmployeeDetail.
 */
import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useCompensationTimeline, useHealthExams } from '@/domains/hooks';

const examTypeLabels: Record<string, string> = {
  admissional: 'Admissional', periodico: 'Periódico', demissional: 'Demissional',
  mudanca_funcao: 'Mudança Função', retorno_trabalho: 'Retorno',
};
const examResultLabels: Record<string, string> = { apto: 'Apto', inapto: 'Inapto', apto_restricao: 'Apto c/ Restrição' };

const TIMELINE_COLORS: Record<string, string> = {
  contract: 'bg-primary', adjustment: 'bg-chart-2', additional: 'bg-chart-3',
  history: 'bg-chart-4', exam: 'bg-chart-5',
};
const TIMELINE_LABELS: Record<string, string> = {
  contract: 'Contrato', adjustment: 'Ajuste', additional: 'Adicional',
  history: 'Histórico', exam: 'Exame',
};

interface Props {
  employeeId: string;
}

export function UnifiedTimelineSection({ employeeId }: Props) {
  const { data: timeline = [] } = useCompensationTimeline(employeeId);
  const { data: exams = [] } = useHealthExams(employeeId);

  const unifiedTimeline = useMemo(() => {
    const items: { id: string; type: string; date: string; description: string; amount?: number }[] = [];
    timeline.forEach(t => items.push({ id: t.id, type: t.type, date: t.date, description: t.description, amount: t.amount }));
    (exams as any[]).forEach(ex => {
      items.push({
        id: ex.id, type: 'exam', date: ex.exam_date,
        description: `Exame ${examTypeLabels[ex.exam_type] || ex.exam_type} — ${examResultLabels[ex.result] || ex.result}`,
      });
    });
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [timeline, exams]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-5 w-5 text-primary" />
        <h4 className="text-sm font-semibold text-card-foreground">Timeline Unificada</h4>
      </div>
      <p className="text-xs text-muted-foreground mb-5">Salários, rubricas, exames e adicionais em ordem cronológica.</p>

      <div className="flex flex-wrap gap-3 mb-5">
        {Object.entries(TIMELINE_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`h-2.5 w-2.5 rounded-full ${TIMELINE_COLORS[key]}`} />
            {label}
          </div>
        ))}
      </div>

      {unifiedTimeline.length > 0 ? (
        <div className="relative">
          <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {unifiedTimeline.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-start gap-4 relative">
                <div className={`h-4 w-4 rounded-full ${TIMELINE_COLORS[item.type] || 'bg-muted'} shrink-0 z-10 ring-2 ring-card`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                      {TIMELINE_LABELS[item.type] || item.type}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(item.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-sm text-card-foreground mt-1">{item.description}</p>
                  {item.amount != null && (
                    <p className="text-sm font-semibold text-primary mt-0.5">R$ {item.amount.toLocaleString('pt-BR')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro na timeline.</p>}
    </div>
  );
}
