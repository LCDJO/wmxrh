/**
 * EmployeeEventsSection — Extracted events list from EmployeeDetail.
 */
import { useEmployeeEvents } from '@/domains/hooks';

const eventTypeLabels: Record<string, string> = {
  company_transfer: 'Transferência', position_change: 'Mudança de Cargo', department_change: 'Mudança de Depto',
  status_change: 'Mudança de Status', manager_change: 'Mudança de Gestor', salary_change: 'Alteração Salarial',
  employee_hired: 'Contratação', salary_contract_started: 'Novo Contrato', salary_adjusted: 'Ajuste Salarial',
  additional_added: 'Adicional', job_changed: 'Mudança de Função',
};

interface Props {
  employeeId: string;
}

export function EmployeeEventsSection({ employeeId }: Props) {
  const { data: events = [] } = useEmployeeEvents(employeeId);

  return (
    <div>
      <h4 className="text-sm font-semibold text-card-foreground mb-3">Eventos Recentes</h4>
      {events.length > 0 ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {events.slice(0, 10).map(ev => (
            <div key={ev.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
              <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                    {eventTypeLabels[ev.event_type] || ev.event_type}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(ev.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                {ev.reason && <p className="text-xs text-muted-foreground mt-0.5">{ev.reason}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>}
    </div>
  );
}
