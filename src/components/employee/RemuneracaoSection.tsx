/**
 * Remuneração Section — Compensation Summary
 *
 * Displays salary, active additionals, benefits, and runs
 * payroll simulation via Labor Rules + Simulation Engine.
 */
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, Calculator, TrendingUp, Shield } from 'lucide-react';
import {
  useActiveSalaryContract,
  useSalaryAdditionals,
  useEmployeeBenefits,
} from '@/domains/hooks';
import { simulatePayroll } from '@/domains/payroll-simulation';
import { buildStandardRuleDTOs } from '@/domains/labor-rules';
import type { PayrollSimulationOutput } from '@/domains/payroll-simulation';
import type { LaborRuleDefinition } from '@/domains/labor-rules';

function buildRules(): LaborRuleDefinition[] {
  return buildStandardRuleDTOs('t1', 'rs1').map((dto, i) => ({
    ...dto,
    id: `rule-${i}`,
    is_active: true,
    deleted_at: null,
    effective_from: '2024-01-01',
    effective_until: null,
    integra_salario: true,
    integra_dsr: dto.integra_dsr ?? false,
    aplica_reflexos: dto.aplica_reflexos ?? false,
    base_calculo: null,
    formula_expression: null,
    tiered_config: null,
    limite_horas: null,
    percentual_sobre_hora: null,
    oncall_tipo: null,
    created_at: '',
    updated_at: '',
  })) as unknown as LaborRuleDefinition[];
}

interface Props {
  employeeId: string;
  tenantId: string;
}

export function RemuneracaoSection({ employeeId, tenantId }: Props) {
  const { data: contract, isLoading: loadingContract } = useActiveSalaryContract(employeeId);
  const { data: additionals = [], isLoading: loadingAdditionals } = useSalaryAdditionals(employeeId);
  const { data: benefits = [], isLoading: loadingBenefits } = useEmployeeBenefits(employeeId);
  const [simulation, setSimulation] = useState<PayrollSimulationOutput | null>(null);
  const [simulating, setSimulating] = useState(false);

  const salarioBase = contract?.base_salary ?? 0;
  const activeAdditionals = useMemo(() =>
    (additionals as any[]).filter((a: any) => a.is_active !== false),
    [additionals]
  );

  const isLoading = loadingContract || loadingAdditionals || loadingBenefits;

  const runSimulation = () => {
    if (!salarioBase) return;
    setSimulating(true);
    try {
      const rules = buildRules();
      const output = simulatePayroll(
        {
          salario_base: salarioBase,
          jornada_mensal_horas: 220,
        },
        rules,
        { tenantId, employeeId },
      );
      setSimulation(output);
    } finally {
      setSimulating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Salário Base ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-card-foreground">Salário Base</h4>
        </div>
        {salarioBase > 0 ? (
          <p className="text-2xl font-bold text-card-foreground">
            R$ {salarioBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum contrato salarial ativo encontrado.</p>
        )}
      </div>

      {/* ── Adicionais Ativos ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-card-foreground">Adicionais Ativos</h4>
          <Badge variant="secondary" className="ml-auto">{activeAdditionals.length}</Badge>
        </div>
        {activeAdditionals.length > 0 ? (
          <div className="space-y-2">
            {activeAdditionals.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{a.name || a.additional_type}</p>
                  {a.legal_basis && <p className="text-xs text-muted-foreground">{a.legal_basis}</p>}
                </div>
                <span className="text-sm font-semibold text-card-foreground">
                  {a.percentage ? `${a.percentage}%` : `R$ ${Number(a.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum adicional ativo.</p>
        )}
      </div>

      {/* ── Benefícios ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-card-foreground">Benefícios</h4>
          <Badge variant="secondary" className="ml-auto">{(benefits as any[]).length}</Badge>
        </div>
        {(benefits as any[]).length > 0 ? (
          <div className="space-y-2">
            {(benefits as any[]).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{b.benefit_name || b.plan?.name || 'Benefício'}</p>
                  <p className="text-xs text-muted-foreground">{b.benefit_type || b.plan?.benefit_type || '—'}</p>
                </div>
                <span className="text-sm font-semibold text-card-foreground">
                  R$ {Number(b.employee_value || b.plan?.base_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum benefício vinculado.</p>
        )}
      </div>

      {/* ── Simulação Trabalhista ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-card-foreground">Simulação Trabalhista</h4>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={!salarioBase || simulating}
            onClick={runSimulation}
          >
            {simulating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            {simulation ? 'Recalcular' : 'Simular'}
          </Button>
        </div>

        {!salarioBase && (
          <p className="text-sm text-muted-foreground">Defina um salário base para rodar a simulação.</p>
        )}

        {simulation && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground italic">
              ⚠️ SIMULAÇÃO — valores estimados, NÃO substitui cálculos oficiais de folha.
            </p>

            {/* Summary grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <SimCard label="Proventos" value={simulation.summary.totalProventos} />
              <SimCard label="Descontos" value={simulation.summary.totalDescontos} negative />
              <SimCard label="Líquido" value={simulation.summary.liquido} highlight />
            </div>

            {/* Encargos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <SimCard label="INSS (empregado)" value={simulation.encargos.valor_inss_estimado} negative />
              <SimCard label="IRRF" value={simulation.encargos.valor_irrf_estimado} negative />
              <SimCard label="FGTS" value={simulation.encargos.valor_fgts_estimado} />
            </div>

            {/* Employer cost */}
            <div className="grid grid-cols-2 gap-3">
              <SimCard label="Custo Total Empregador" value={simulation.employerCost.custo_total_empregador} highlight />
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Fator Custo</p>
                <p className="text-lg font-bold text-card-foreground">{simulation.employerCost.fator_custo.toFixed(2)}x</p>
              </div>
            </div>

            {/* Provisions */}
            <div className="grid grid-cols-3 gap-3">
              <SimCard label="Férias (1/3)" value={simulation.reflections.ferias_terco} />
              <SimCard label="13º Salário" value={simulation.reflections.decimo_terceiro} />
              <SimCard label="Prov. Multa FGTS" value={simulation.reflections.provisao_multa_fgts} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SimCard({ label, value, negative, highlight }: { label: string; value: number; negative?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? 'border-primary bg-primary/5' : 'border-border'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${negative ? 'text-destructive' : 'text-card-foreground'}`}>
        R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}
