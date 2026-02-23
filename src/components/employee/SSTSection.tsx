/**
 * SST Section — Saúde e Segurança do Trabalho
 *
 * Read-only view integrating:
 * - Risk Exposures (grau_risco, agentes_risco, EPI)
 * - NR Training assignments (NRs obrigatórias)
 * - Health Exams / PCMSO (exames pendentes e realizados)
 */
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, GraduationCap, Stethoscope, AlertTriangle } from 'lucide-react';
import {
  useEmployeeRiskExposures,
  useNrTrainingByEmployee,
  useHealthExams,
} from '@/domains/hooks';

interface Props {
  employeeId: string;
  tenantId: string;
}

export function SSTSection({ employeeId, tenantId }: Props) {
  const { data: risks = [], isLoading: loadingRisks } = useEmployeeRiskExposures(employeeId);
  const { data: trainings = [], isLoading: loadingTrainings } = useNrTrainingByEmployee(employeeId);
  const { data: exams = [], isLoading: loadingExams } = useHealthExams(employeeId);

  const isLoading = loadingRisks || loadingTrainings || loadingExams;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const riskList = risks as any[];
  const trainingList = trainings as any[];
  const examList = exams as any[];

  const pendingExams = examList.filter((e) => !e.result || e.status === 'pendente');
  const completedExams = examList.filter((e) => e.result || e.status === 'realizado');

  // Extract unique agents and EPIs from risk exposures
  const agentesRisco = [...new Set(riskList.flatMap((r) => r.risk_agents ?? r.agentes_risco ?? []))];
  const episObrigatorios = [...new Set(riskList.flatMap((r) => r.required_epi ?? r.epi_list ?? []))];
  const grauRisco = riskList.length > 0
    ? Math.max(...riskList.map((r) => r.risk_level ?? r.grau_risco ?? 1))
    : null;

  const nrsObrigatorias = [...new Set(trainingList.map((t) => `NR-${t.nr_number}`))];

  return (
    <div className="space-y-6">
      {/* ── Grau de Risco & Agentes ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-card-foreground">Perfil de Risco</h4>
          {grauRisco != null && (
            <Badge variant={grauRisco >= 3 ? 'destructive' : 'secondary'} className="ml-auto">
              Grau {grauRisco}
            </Badge>
          )}
        </div>

        {riskList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma exposição de risco registrada.</p>
        ) : (
          <div className="space-y-3">
            {agentesRisco.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Agentes de Risco</p>
                <div className="flex flex-wrap gap-1">
                  {agentesRisco.map((a) => (
                    <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </div>
            )}
            {episObrigatorios.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">EPI Obrigatório</p>
                <div className="flex flex-wrap gap-1">
                  {episObrigatorios.map((e) => (
                    <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── NR Obrigatórias ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-card-foreground">NRs Obrigatórias / Treinamentos</h4>
          <Badge variant="secondary" className="ml-auto">{trainingList.length}</Badge>
        </div>

        {trainingList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum treinamento NR atribuído.</p>
        ) : (
          <div className="space-y-2">
            {trainingList.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-card-foreground">NR-{t.nr_number}</p>
                  {t.training_name && <p className="text-xs text-muted-foreground">{t.training_name}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {t.expires_at && new Date(t.expires_at) < new Date() && (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <Badge
                    variant={t.status === 'completed' || t.status === 'concluido' ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {t.status === 'completed' || t.status === 'concluido' ? 'Concluído' :
                     t.status === 'overdue' || t.status === 'vencido' ? 'Vencido' :
                     t.status === 'pending' || t.status === 'pendente' ? 'Pendente' : t.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Exames Pendentes ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-card-foreground">Exames Pendentes</h4>
          <Badge variant={pendingExams.length > 0 ? 'destructive' : 'secondary'} className="ml-auto">
            {pendingExams.length}
          </Badge>
        </div>
        {pendingExams.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum exame pendente.</p>
        ) : (
          <div className="space-y-2">
            {pendingExams.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{e.exam_type || e.tipo_exame || 'Exame'}</p>
                  {e.due_date && <p className="text-xs text-muted-foreground">Vencimento: {new Date(e.due_date).toLocaleDateString('pt-BR')}</p>}
                </div>
                <Badge variant="outline" className="text-xs">Pendente</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Exames Realizados ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-semibold text-card-foreground">Exames Realizados</h4>
          <Badge variant="secondary" className="ml-auto">{completedExams.length}</Badge>
        </div>
        {completedExams.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum exame registrado.</p>
        ) : (
          <div className="space-y-2">
            {completedExams.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{e.exam_type || e.tipo_exame || 'Exame'}</p>
                  {e.exam_date && <p className="text-xs text-muted-foreground">Realizado: {new Date(e.exam_date).toLocaleDateString('pt-BR')}</p>}
                </div>
                <Badge variant="secondary" className="text-xs">{e.result || 'Apto'}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
