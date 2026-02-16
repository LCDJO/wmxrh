import { useBenefitPlans } from '@/domains/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TYPE_LABELS: Record<string, string> = {
  va: 'Vale Alimentação', vr: 'Vale Refeição', vt: 'Vale Transporte',
  health: 'Plano de Saúde', dental: 'Plano Odontológico',
};

export default function Benefits() {
  const { data: plans = [], isLoading } = useBenefitPlans();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Benefícios</h1>
          <p className="text-muted-foreground">{plans.length} planos cadastrados</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : plans.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum plano de benefício cadastrado.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map(plan => (
            <Card key={plan.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{plan.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[plan.benefit_type] || plan.benefit_type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                {plan.provider && <p>Operadora: {plan.provider}</p>}
                <p>Valor base: R$ {Number(plan.base_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p>Empresa paga: {plan.employer_percentage ?? 100}% | Desconto func.: {plan.employee_discount_percentage ?? 0}%</p>
                {plan.has_coparticipation && <Badge variant="secondary" className="text-[10px]">Coparticipação</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
