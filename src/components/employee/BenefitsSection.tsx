/**
 * BenefitsSection — Extracted benefits tab content from EmployeeDetail.
 */
import { Gift } from 'lucide-react';
import { useEmployeeBenefits } from '@/domains/hooks';

interface Props {
  employeeId: string;
}

export function BenefitsSection({ employeeId }: Props) {
  const { data: benefits = [] } = useEmployeeBenefits(employeeId);

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Gift className="h-5 w-5 text-primary" />
        <h4 className="text-sm font-semibold text-card-foreground">Benefícios ({benefits.length})</h4>
      </div>
      {benefits.length > 0 ? (
        <div className="space-y-3">
          {benefits.map((b) => (
            <div key={b.id} className={`flex items-center justify-between p-4 rounded-lg border ${b.is_active ? 'border-primary/20 bg-accent/20' : 'border-border'}`}>
              <div>
                <p className="text-sm font-medium text-card-foreground">{b.benefit_plans?.name ?? 'Plano'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tipo: {b.benefit_plans?.benefit_type ?? '—'} · Matrícula: {new Date(b.enrollment_date).toLocaleDateString('pt-BR')}
                </p>
                {b.card_number && <p className="text-xs text-muted-foreground">Cartão: {b.card_number}</p>}
              </div>
              <div className="text-right">
                {b.monthly_value != null && <p className="text-sm font-semibold text-primary">R$ {b.monthly_value.toLocaleString('pt-BR')}/mês</p>}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.is_active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {b.is_active ? 'Ativo' : 'Cancelado'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum benefício vinculado.</p>}
    </div>
  );
}
