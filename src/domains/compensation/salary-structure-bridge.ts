/**
 * Salary Structure ↔ Labor Rules Engine Bridge
 *
 * Connects SalaryStructure (composition model) with LaborRulesEngine
 * so rubrics are NEVER created manually — they are generated from
 * evaluateLaborRules() and synced into salary_rubrics.
 *
 * Flow:
 *   1. compensationEngineService.calculate() → CalculatedRubric[]
 *   2. This bridge maps CalculatedRubric → CreateSalaryRubricDTO
 *   3. Syncs into the employee's active SalaryStructure
 */

import { salaryStructureService } from './salary-structure.service';
import { compensationEngineService, type CompensationInput, type CompensationResult } from './compensation-engine.service';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { CalculatedRubric } from '@/domains/labor-rules';
import type { CreateSalaryRubricDTO, SalaryStructureWithRubrics } from '@/domains/shared/types';

// ── Mapper ──

function mapRubricToDTO(
  rubric: CalculatedRubric,
  structureId: string,
  tenantId: string,
): CreateSalaryRubricDTO {
  return {
    tenant_id: tenantId,
    salary_structure_id: structureId,
    rubric_code: rubric.codigo_rubrica ?? `AUTO_${rubric.category.toUpperCase()}`,
    name: rubric.rule_name,
    item_type: rubric.category === 'vale_transporte' ? 'desconto' : 'provento',
    nature: 'variable',
    base_calculo: rubric.percentual_aplicado ? 'percentual' : 'manual',
    amount: rubric.valor,
    percentage: rubric.percentual_aplicado,
    integra_fgts: rubric.integra_fgts,
    integra_inss: rubric.integra_inss,
    integra_irrf: rubric.integra_irrf,
    esocial_code: rubric.codigo_rubrica,
  };
}

// ── Bridge Service ──

export const salaryStructureBridge = {
  /**
   * Calculate rubrics via LaborRulesEngine and sync them into the
   * employee's active SalaryStructure.
   *
   * Returns the full CompensationResult + updated structure.
   */
  async calculateAndSync(
    input: CompensationInput,
    scope: QueryScope,
  ): Promise<{
    result: CompensationResult;
    structure: SalaryStructureWithRubrics | null;
    syncedCount: number;
  }> {
    // 1. Calculate via LaborRulesEngine (delegated through compensationEngine)
    const result = await compensationEngineService.calculate(input, scope);

    // 2. Get or skip active structure
    const structure = await salaryStructureService.getActive(input.employeeId, scope);
    if (!structure) {
      return { result, structure: null, syncedCount: 0 };
    }

    // 3. Remove existing auto-generated rubrics (variable nature)
    const existingAutoRubrics = (structure.salary_rubrics ?? [])
      .filter(r => r.nature === 'variable' && r.is_active);
    for (const rubric of existingAutoRubrics) {
      await salaryStructureService.removeRubric(rubric.id);
    }

    // 4. Map CalculatedRubrics → SalaryRubric DTOs and insert
    const dtos = result.rubrics.map(r =>
      mapRubricToDTO(r, structure.id, scope.tenantId)
    );
    for (const dto of dtos) {
      await salaryStructureService.addRubric(dto);
    }

    // 5. Reload structure
    const updated = await salaryStructureService.getActive(input.employeeId, scope);

    return {
      result,
      structure: updated,
      syncedCount: dtos.length,
    };
  },

  /**
   * Preview rubrics without persisting — useful for simulation UI.
   */
  async preview(
    input: CompensationInput,
    scope: QueryScope,
  ): Promise<CompensationResult> {
    return compensationEngineService.calculate(input, scope);
  },
};
