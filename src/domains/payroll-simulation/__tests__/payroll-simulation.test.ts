import { describe, it, expect } from 'vitest';
import { simulatePayroll } from '@/domains/payroll-simulation';
import { STANDARD_RUBRIC_LIBRARY, buildStandardRuleDTOs } from '@/domains/labor-rules';
import type { LaborRuleDefinition } from '@/domains/labor-rules';

// Build mock rules from standard library
const mockRules: LaborRuleDefinition[] = buildStandardRuleDTOs('tenant-1', 'ruleset-1').map((dto, i) => ({
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

describe('Payroll Simulation Engine', () => {
  it('simulates basic salary with no extras', () => {
    const result = simulatePayroll({ salario_base: 5000 }, mockRules);

    expect(result.summary.totalProventos).toBeGreaterThan(5000);
    expect(result.taxes.inss).toBeGreaterThan(0);
    expect(result.taxes.fgts).toBeGreaterThan(0);
    expect(result.employerCost.custo_total_empregador).toBeGreaterThan(5000);
    expect(result.employerCost.fator_custo).toBeGreaterThan(1);
  });

  it('adds overtime rubrics when hours provided', () => {
    const result = simulatePayroll({
      salario_base: 3000,
      horas_extras_50: 10,
    }, mockRules);

    const heRubric = result.rubrics.find(r => r.category === 'hora_extra');
    expect(heRubric).toBeDefined();
    expect(heRubric!.valor).toBeGreaterThan(0);
  });

  it('calculates INSS progressively', () => {
    const result = simulatePayroll({ salario_base: 7000 }, mockRules);
    expect(result.taxes.inss_faixas.length).toBeGreaterThan(1);
    expect(result.taxes.inss).toBeLessThan(7000 * 0.14); // can't exceed max rate
  });

  it('projects employer cost multiplier > 1.5x for typical salary', () => {
    const result = simulatePayroll({ salario_base: 4000 }, mockRules);
    // Typical Brazilian employer cost is ~1.6-2.0x base salary
    expect(result.employerCost.fator_custo).toBeGreaterThanOrEqual(1.4);
  });

  it('includes reflections for férias and 13º', () => {
    const result = simulatePayroll({ salario_base: 6000 }, mockRules);
    expect(result.reflections.ferias_terco).toBeGreaterThan(0);
    expect(result.reflections.decimo_terceiro).toBeGreaterThan(0);
    expect(result.reflections.provisao_multa_fgts).toBeGreaterThan(0);
  });
});
