/**
 * Treinamentos NR Tab — Employee Profile
 *
 * Sections: Obrigatórios, Em Andamento, Concluídos, Vencidos
 */

import { useMemo } from 'react';
import { GraduationCap, Clock, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNrTrainingByEmployee } from '@/domains/hooks';

interface TreinamentosNrTabProps {
  employeeId: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof GraduationCap; className: string }> = {
  assigned: { label: 'Obrigatório', icon: GraduationCap, className: 'bg-accent text-accent-foreground' },
  in_progress: { label: 'Em Andamento', icon: Clock, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  completed: { label: 'Concluído', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  expired: { label: 'Vencido', icon: AlertTriangle, className: 'bg-destructive/10 text-destructive' },
  overdue: { label: 'Em Atraso', icon: ShieldAlert, className: 'bg-destructive/10 text-destructive' },
};

const BLOCKING_CONFIG: Record<string, { label: string; className: string }> = {
  hard_block: { label: 'Bloqueio Total', className: 'bg-destructive/10 text-destructive' },
  soft_block: { label: 'Restrição', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  warning: { label: 'Alerta', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function TreinamentosNrTab({ employeeId }: TreinamentosNrTabProps) {
  const { data: trainings = [], isLoading } = useNrTrainingByEmployee(employeeId);

  const sections = useMemo(() => {
    const assigned = (trainings as any[]).filter(t => t.status === 'assigned');
    const inProgress = (trainings as any[]).filter(t => t.status === 'in_progress');
    const completed = (trainings as any[]).filter(t => t.status === 'completed');
    const expired = (trainings as any[]).filter(t => t.status === 'expired' || t.status === 'overdue');
    return { assigned, inProgress, completed, expired };
  }, [trainings]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl shadow-card p-6 flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const total = (trainings as any[]).length;

  return (
    <div className="bg-card rounded-xl shadow-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold font-display text-card-foreground flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Treinamentos NR
        </h3>
        <Badge variant="secondary" className="text-xs">
          {total} treinamento{total !== 1 ? 's' : ''}
        </Badge>
      </div>

      {total === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum treinamento NR atribuído.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <TrainingSection title="Vencidos / Em Atraso" items={sections.expired} emptyText="Nenhum treinamento vencido" icon={AlertTriangle} iconClass="text-destructive" />
          <TrainingSection title="Obrigatórios (Pendentes)" items={sections.assigned} emptyText="Nenhum pendente" icon={GraduationCap} iconClass="text-muted-foreground" />
          <TrainingSection title="Em Andamento" items={sections.inProgress} emptyText="Nenhum em andamento" icon={Clock} iconClass="text-blue-600" />
          <TrainingSection title="Concluídos" items={sections.completed} emptyText="Nenhum concluído" icon={CheckCircle2} iconClass="text-emerald-600" />
        </div>
      )}
    </div>
  );
}

function TrainingSection({ title, items, emptyText, icon: Icon, iconClass }: {
  title: string;
  items: any[];
  emptyText: string;
  icon: typeof GraduationCap;
  iconClass: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        {title} ({items.length})
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground pl-6">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((t: any) => {
            const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.assigned;
            const blocking = BLOCKING_CONFIG[t.blocking_level];
            const days = t.data_validade ? daysUntil(t.data_validade) : null;

            return (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-medium text-card-foreground">
                    NR-{t.nr_number} · {t.training_name}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                    {blocking && (
                      <Badge className={`text-[10px] ${blocking.className}`}>{blocking.label}</Badge>
                    )}
                    {t.data_validade && (
                      <span className={`text-[10px] ${days != null && days <= 30 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {t.status === 'completed' && days != null && days > 0
                          ? `Válido até ${new Date(t.data_validade).toLocaleDateString('pt-BR')} (${days}d)`
                          : `Expirou ${new Date(t.data_validade).toLocaleDateString('pt-BR')}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
