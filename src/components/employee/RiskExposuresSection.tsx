/**
 * RiskExposuresSection — Extracted risk exposures tab from EmployeeDetail.
 */
import { ShieldAlert } from 'lucide-react';
import { useEmployeeRiskExposures } from '@/domains/hooks';

interface Props {
  employeeId: string;
}

export function RiskExposuresSection({ employeeId }: Props) {
  const { data: riskExposures = [] } = useEmployeeRiskExposures(employeeId);

  const levelColors: Record<string, string> = {
    critico: 'bg-destructive/10 text-destructive',
    alto: 'bg-chart-2/10 text-chart-2',
    medio: 'bg-chart-3/10 text-chart-3',
    baixo: 'bg-primary/10 text-primary',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <ShieldAlert className="h-5 w-5 text-primary" />
        <h4 className="text-sm font-semibold text-card-foreground">Exposições a Risco ({riskExposures.length})</h4>
      </div>
      {riskExposures.length > 0 ? (
        <div className="space-y-3">
          {(riskExposures as any[]).map(re => (
            <div key={re.id} className={`p-4 rounded-lg border ${re.is_active ? 'border-border' : 'border-border opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${levelColors[re.risk_level] || 'bg-accent text-accent-foreground'}`}>
                    {re.risk_level?.charAt(0).toUpperCase() + re.risk_level?.slice(1)}
                  </span>
                  {re.generates_hazard_pay && <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">Periculosidade</span>}
                  {!re.is_active && <span className="text-xs text-muted-foreground">(Inativo)</span>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(re.start_date).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                {re.hazard_pay_type && <span>Tipo: {re.hazard_pay_type}</span>}
                {re.hazard_pay_percentage && <span>Percentual: {re.hazard_pay_percentage}%</span>}
                {re.requires_epi && <span>Requer EPI</span>}
                {re.epi_description && <span>EPI: {re.epi_description}</span>}
              </div>
              {re.notes && <p className="text-xs text-muted-foreground mt-1">{re.notes}</p>}
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhuma exposição registrada.</p>}
    </div>
  );
}
