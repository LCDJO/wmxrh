/**
 * Career Compliance Engine — Pure analysis engine
 * 
 * Analyzes career positions against legal requirements,
 * integrating with Occupational Intelligence and Labor Rules.
 * No I/O — receives snapshots, returns analysis.
 */
import type {
  CareerPosition,
  CareerLegalRequirement,
  CareerSalaryBenchmark,
  CareerComplianceAnalysis,
  SalaryPositioningResult,
  RiscoNivel,
} from './types';

/**
 * Analyzes compliance of a career position against its legal requirements.
 */
export function analyzePositionCompliance(
  position: CareerPosition,
  requirements: CareerLegalRequirement[],
  metRequirementIds: Set<string>
): CareerComplianceAnalysis {
  const total = requirements.length;
  const met = requirements.filter(r => metRequirementIds.has(r.id)).length;
  const pending = total - met;
  const score = total > 0 ? Math.round((met / total) * 100) : 100;

  const criticalGaps = requirements
    .filter(r => !metRequirementIds.has(r.id) && r.risco_nao_conformidade === 'critico')
    .map(r => r.descricao);

  const riskLevel: RiscoNivel =
    score >= 90 ? 'baixo' :
    score >= 70 ? 'medio' :
    score >= 50 ? 'alto' : 'critico';

  return {
    position_id: position.id,
    position_name: position.nome,
    total_requirements: total,
    met_requirements: met,
    pending_requirements: pending,
    compliance_score: score,
    critical_gaps: criticalGaps,
    risk_level: riskLevel,
  };
}

/**
 * Analyzes salary positioning against benchmarks.
 */
export function analyzeSalaryPositioning(
  position: CareerPosition,
  benchmarks: CareerSalaryBenchmark[]
): SalaryPositioningResult {
  const latestBenchmark = benchmarks.sort(
    (a, b) => new Date(b.referencia_data).getTime() - new Date(a.referencia_data).getTime()
  )[0];

  const benchmarkMedian = latestBenchmark?.valor_mediano || 0;
  const currentMid = (position.faixa_salarial_min + position.faixa_salarial_max) / 2;
  const gap = benchmarkMedian > 0 ? ((currentMid - benchmarkMedian) / benchmarkMedian) * 100 : 0;

  const positioning: 'abaixo' | 'adequado' | 'acima' =
    gap < -10 ? 'abaixo' :
    gap > 10 ? 'acima' : 'adequado';

  return {
    position_id: position.id,
    position_name: position.nome,
    current_min: position.faixa_salarial_min,
    current_max: position.faixa_salarial_max,
    benchmark_median: benchmarkMedian,
    gap_percentage: Math.round(gap * 100) / 100,
    positioning,
    alert: positioning === 'abaixo',
  };
}

/**
 * Auto-generates legal requirements based on CBO code and CNAE risk profile.
 */
export function suggestLegalRequirements(
  cboCode: string | null,
  grauRisco: number,
  applicableNrs: number[]
): Omit<CareerLegalRequirement, 'id' | 'tenant_id' | 'career_position_id' | 'created_at' | 'updated_at'>[] {
  const suggestions: Omit<CareerLegalRequirement, 'id' | 'tenant_id' | 'career_position_id' | 'created_at' | 'updated_at'>[] = [];

  // ASO obrigatório para todos
  suggestions.push({
    tipo: 'exame_medico',
    codigo_referencia: 'NR-7',
    descricao: 'ASO — Atestado de Saúde Ocupacional (admissional, periódico, demissional)',
    obrigatorio: true,
    periodicidade_meses: grauRisco >= 3 ? 12 : 24,
    base_legal: 'NR-7 / CLT Art. 168',
    risco_nao_conformidade: 'critico',
  });

  // NR trainings
  for (const nr of applicableNrs) {
    suggestions.push({
      tipo: 'nr_training',
      codigo_referencia: `NR-${nr}`,
      descricao: `Treinamento obrigatório NR-${nr}`,
      obrigatorio: true,
      periodicidade_meses: nr === 35 ? 24 : 12,
      base_legal: `NR-${nr}`,
      risco_nao_conformidade: 'alto',
    });
  }

  // EPI for risk >= 3
  if (grauRisco >= 3) {
    suggestions.push({
      tipo: 'epi',
      codigo_referencia: 'NR-6',
      descricao: 'Fornecimento e controle de EPI conforme PGR',
      obrigatorio: true,
      periodicidade_meses: null,
      base_legal: 'NR-6 / CLT Art. 166',
      risco_nao_conformidade: 'critico',
    });
  }

  return suggestions;
}
