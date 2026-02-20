/**
 * Career Alert Engine — Pure analysis (no I/O)
 *
 * Scans career positions and their related data to detect:
 *  1. Cargo sem CBO definido
 *  2. Salário abaixo do piso
 *  3. Cargo exige NR não cadastrada (mapping without matching requirement)
 *  4. Cargo com risco sem PCMSO vinculado (risk mappings without medical requirements)
 *
 * Returns CreateCareerRiskAlertDTO[] ready for persistence.
 */
import type {
  CareerPosition,
  CareerLegalMapping,
  CareerLegalRequirement,
  CreateCareerRiskAlertDTO,
} from './types';

export interface AlertEngineInput {
  positions: CareerPosition[];
  /** Keyed by position id */
  mappingsByPosition: Record<string, CareerLegalMapping[]>;
  /** Keyed by position id */
  requirementsByPosition: Record<string, CareerLegalRequirement[]>;
  /** CCT / national minimum wage floor */
  pisoSalarial: number;
  tenantId: string;
}

export function runCareerAlertEngine(input: AlertEngineInput): CreateCareerRiskAlertDTO[] {
  const alerts: CreateCareerRiskAlertDTO[] = [];
  const { positions, mappingsByPosition, requirementsByPosition, pisoSalarial, tenantId } = input;

  for (const pos of positions) {
    if (!pos.ativo) continue;

    // 1. Cargo sem CBO
    if (!pos.cbo_codigo) {
      alerts.push({
        tenant_id: tenantId,
        career_position_id: pos.id,
        tipo_alerta: 'desvio_funcao',
        severidade: 'alto',
        descricao: `Cargo "${pos.nome}" não possui código CBO definido. Necessário para conformidade eSocial e PCMSO.`,
        metadata: { rule: 'missing_cbo' },
      });
    }

    // 2. Salário abaixo do piso
    if (pos.faixa_salarial_min > 0 && pos.faixa_salarial_min < pisoSalarial) {
      alerts.push({
        tenant_id: tenantId,
        career_position_id: pos.id,
        tipo_alerta: 'salario_abaixo_piso',
        severidade: 'critico',
        descricao: `Cargo "${pos.nome}" possui faixa mínima (R$ ${pos.faixa_salarial_min.toFixed(2)}) abaixo do piso (R$ ${pisoSalarial.toFixed(2)}).`,
        metadata: { rule: 'salary_below_floor', current: pos.faixa_salarial_min, floor: pisoSalarial },
      });
    }

    const mappings = mappingsByPosition[pos.id] || [];
    const requirements = requirementsByPosition[pos.id] || [];

    // 3. NR exigida no mapping mas sem requisito legal cadastrado
    for (const m of mappings) {
      if (!m.nr_codigo) continue;
      const hasRequirement = requirements.some(
        r => r.tipo === 'nr_training' && r.codigo_referencia === m.nr_codigo
      );
      if (!hasRequirement) {
        alerts.push({
          tenant_id: tenantId,
          career_position_id: pos.id,
          tipo_alerta: 'treinamento_vencido',
          severidade: 'alto',
          descricao: `Cargo "${pos.nome}" exige ${m.nr_codigo} mas não há requisito de treinamento cadastrado.`,
          metadata: { rule: 'nr_without_requirement', nr_codigo: m.nr_codigo },
        });
      }
    }

    // 4. Cargo com risco sem PCMSO vinculado
    const hasRiskMapping = mappings.some(
      m => m.exige_exame_medico || m.adicional_aplicavel != null
    );
    if (hasRiskMapping) {
      const hasMedicalReq = requirements.some(r => r.tipo === 'exame_medico');
      if (!hasMedicalReq) {
        alerts.push({
          tenant_id: tenantId,
          career_position_id: pos.id,
          tipo_alerta: 'exame_vencido',
          severidade: 'critico',
          descricao: `Cargo "${pos.nome}" possui risco ocupacional mas não tem exame médico (ASO/PCMSO) vinculado.`,
          metadata: { rule: 'risk_without_pcmso' },
        });
      }
    }
  }

  return alerts;
}
