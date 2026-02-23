/**
 * HealthExamsSection — Extracted occupational health tab from EmployeeDetail.
 */
import { Heart } from 'lucide-react';
import { useHealthExams } from '@/domains/hooks';

const examTypeLabels: Record<string, string> = {
  admissional: 'Admissional', periodico: 'Periódico', demissional: 'Demissional',
  mudanca_funcao: 'Mudança Função', retorno_trabalho: 'Retorno',
};
const examResultLabels: Record<string, string> = { apto: 'Apto', inapto: 'Inapto', apto_restricao: 'Apto c/ Restrição' };

interface Props {
  employeeId: string;
}

export function HealthExamsSection({ employeeId }: Props) {
  const { data: exams = [] } = useHealthExams(employeeId);

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Heart className="h-5 w-5 text-primary" />
        <h4 className="text-sm font-semibold text-card-foreground">Exames Ocupacionais ({exams.length})</h4>
      </div>
      {exams.length > 0 ? (
        <div className="space-y-3">
          {(exams as any[]).map(ex => {
            const isOverdue = ex.next_exam_date && new Date(ex.next_exam_date) < new Date();
            return (
              <div key={ex.id} className={`p-4 rounded-lg border ${isOverdue ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                      {examTypeLabels[ex.exam_type] || ex.exam_type}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      ex.result === 'apto' ? 'bg-primary/10 text-primary' :
                      ex.result === 'inapto' ? 'bg-destructive/10 text-destructive' :
                      'bg-accent text-accent-foreground'
                    }`}>
                      {examResultLabels[ex.result] || ex.result}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(ex.exam_date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  {ex.physician_name && <span>Médico: {ex.physician_name}</span>}
                  {ex.physician_crm && <span>CRM: {ex.physician_crm}</span>}
                  {ex.next_exam_date && (
                    <span className={isOverdue ? 'text-destructive font-semibold' : ''}>
                      Próximo: {new Date(ex.next_exam_date).toLocaleDateString('pt-BR')}
                      {isOverdue && ' (VENCIDO)'}
                    </span>
                  )}
                </div>
                {ex.observations && <p className="text-xs text-muted-foreground mt-1">{ex.observations}</p>}
              </div>
            );
          })}
        </div>
      ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum exame registrado.</p>}
    </div>
  );
}
