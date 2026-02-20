/**
 * Regulatory Impact Analysis Engine — Pure analysis (no I/O)
 *
 * Given a norm change, identifies which positions, companies,
 * trainings, and agreements are affected.
 *
 * Integrations:
 *  - Career & Legal Intelligence (positions, legal mappings)
 *  - Occupational Intelligence (CNAE risk mappings)
 *  - Labor Rules Engine (CCT/CLT rules)
 *  - PCMSO / PGR (medical exam requirements)
 *  - NR Training Lifecycle (training compliance)
 */

import type {
  ImpactAnalysisInput,
  RegulatoryImpact,
  ImpactArea,
  ImpactSeverity,
  AffectedEntity,
} from './types';

export interface ImpactAnalysisResult {
  impacts: Omit<RegulatoryImpact, 'id' | 'tenant_id' | 'created_at'>[];
  summary: ImpactSummary;
}

export interface ImpactSummary {
  total_impacts: number;
  by_severity: Record<ImpactSeverity, number>;
  by_area: Record<string, number>;
  total_affected_positions: number;
  total_affected_companies: number;
  requires_immediate_action: boolean;
}

// ── NR → Impact Area mapping ──
const NR_IMPACT_MAP: Record<number, { areas: ImpactArea[]; severity: ImpactSeverity }> = {
  1: { areas: ['risk_mapping', 'training_requirements'], severity: 'acao_requerida' },
  5: { areas: ['training_requirements'], severity: 'atencao' },
  6: { areas: ['epi_requirements'], severity: 'acao_requerida' },
  7: { areas: ['medical_exams'], severity: 'urgente' },
  9: { areas: ['risk_mapping', 'epi_requirements'], severity: 'acao_requerida' },
  10: { areas: ['training_requirements', 'epi_requirements'], severity: 'acao_requerida' },
  12: { areas: ['training_requirements', 'epi_requirements'], severity: 'acao_requerida' },
  15: { areas: ['additionals', 'salary_floor'], severity: 'urgente' },
  16: { areas: ['additionals', 'salary_floor'], severity: 'urgente' },
  17: { areas: ['training_requirements', 'risk_mapping'], severity: 'atencao' },
  18: { areas: ['training_requirements', 'epi_requirements', 'risk_mapping'], severity: 'acao_requerida' },
  35: { areas: ['training_requirements', 'epi_requirements'], severity: 'acao_requerida' },
};

/**
 * Analyzes the impact of a norm change across the tenant's data.
 */
export function analyzeImpact(input: ImpactAnalysisInput): ImpactAnalysisResult {
  const { norm, version, positions, companies, active_agreements } = input;
  const impacts: Omit<RegulatoryImpact, 'id' | 'tenant_id' | 'created_at'>[] = [];

  // Parse NR number if applicable
  const nrMatch = norm.codigo.match(/^NR-(\d+)/);
  const nrNumber = nrMatch ? parseInt(nrMatch[1], 10) : null;

  if (norm.tipo === 'NR' && nrNumber) {
    const impactDef = NR_IMPACT_MAP[nrNumber];
    const areas = impactDef?.areas ?? ['training_requirements'];
    const baseSeverity = impactDef?.severity ?? 'atencao';

    // Find affected positions (those that have this NR in their applicable list)
    const affectedPositions = positions.filter(p =>
      p.nrs_aplicaveis.includes(nrNumber)
    );

    for (const area of areas) {
      const entities: AffectedEntity[] = affectedPositions.map(p => ({
        type: 'career_position' as const,
        id: p.id,
        name: p.nome,
      }));

      if (entities.length > 0) {
        impacts.push({
          norm_version_id: version.id,
          norm_codigo: norm.codigo,
          area_impactada: area,
          severidade: baseSeverity,
          descricao: buildImpactDescription(norm.codigo, area, entities.length),
          detalhes: `Alteração na ${norm.codigo} (${version.resumo_alteracoes}) afeta ${entities.length} cargo(s) na área de ${areaLabel(area)}.`,
          entidades_afetadas: entities,
          acao_recomendada: buildRecommendation(area, norm.codigo),
          resolvido: false,
          resolvido_em: null,
          resolvido_por: null,
        });
      }
    }

    // Check companies by risk grade for NRs that affect risk mapping
    if (areas.includes('risk_mapping')) {
      const affectedCompanies = companies.filter(c => c.grau_risco >= 3);
      if (affectedCompanies.length > 0) {
        impacts.push({
          norm_version_id: version.id,
          norm_codigo: norm.codigo,
          area_impactada: 'risk_mapping',
          severidade: baseSeverity,
          descricao: `${norm.codigo}: ${affectedCompanies.length} empresa(s) com grau de risco ≥ 3 podem ser impactadas.`,
          detalhes: null,
          entidades_afetadas: affectedCompanies.map(c => ({
            type: 'company',
            id: c.id,
            name: c.name,
          })),
          acao_recomendada: 'Revisar PGR e mapeamento de riscos das empresas afetadas.',
          resolvido: false,
          resolvido_em: null,
          resolvido_por: null,
        });
      }
    }
  }

  // CLT changes affecting salary/working hours
  if (norm.tipo === 'CLT') {
    const allPositionEntities: AffectedEntity[] = positions.map(p => ({
      type: 'career_position',
      id: p.id,
      name: p.nome,
    }));

    impacts.push({
      norm_version_id: version.id,
      norm_codigo: norm.codigo,
      area_impactada: 'working_hours',
      severidade: 'acao_requerida',
      descricao: `Alteração CLT (${norm.codigo}) pode afetar jornada de trabalho e cálculos de folha.`,
      detalhes: version.resumo_alteracoes,
      entidades_afetadas: allPositionEntities.slice(0, 50), // cap for readability
      acao_recomendada: 'Revisar regras de jornada e rubricas de folha de pagamento.',
      resolvido: false,
      resolvido_em: null,
      resolvido_por: null,
    });
  }

  // CCT changes
  if (norm.tipo === 'CCT') {
    const affectedAgreements = active_agreements.map(a => ({
      type: 'agreement' as const,
      id: a.id,
      name: a.union_name,
    }));

    if (affectedAgreements.length > 0) {
      impacts.push({
        norm_version_id: version.id,
        norm_codigo: norm.codigo,
        area_impactada: 'salary_floor',
        severidade: 'urgente',
        descricao: `Nova CCT pode alterar piso salarial de ${affectedAgreements.length} convenção(ões) ativa(s).`,
        detalhes: version.resumo_alteracoes,
        entidades_afetadas: affectedAgreements,
        acao_recomendada: 'Atualizar pisos salariais e verificar conformidade das faixas de cargo.',
        resolvido: false,
        resolvido_em: null,
        resolvido_por: null,
      });
    }
  }

  // Build summary
  const bySeverity: Record<ImpactSeverity, number> = {
    informativo: 0, atencao: 0, acao_requerida: 0, urgente: 0, critico: 0,
  };
  const byArea: Record<string, number> = {};
  const affectedPosIds = new Set<string>();
  const affectedCompanyIds = new Set<string>();

  for (const imp of impacts) {
    bySeverity[imp.severidade]++;
    byArea[imp.area_impactada] = (byArea[imp.area_impactada] ?? 0) + 1;
    for (const e of imp.entidades_afetadas) {
      if (e.type === 'career_position') affectedPosIds.add(e.id);
      if (e.type === 'company') affectedCompanyIds.add(e.id);
    }
  }

  return {
    impacts,
    summary: {
      total_impacts: impacts.length,
      by_severity: bySeverity,
      by_area: byArea,
      total_affected_positions: affectedPosIds.size,
      total_affected_companies: affectedCompanyIds.size,
      requires_immediate_action: bySeverity.urgente > 0 || bySeverity.critico > 0,
    },
  };
}

// ── Helpers ──

function areaLabel(area: ImpactArea): string {
  const labels: Record<ImpactArea, string> = {
    career_positions: 'Cargos',
    salary_floor: 'Piso Salarial',
    training_requirements: 'Treinamentos',
    medical_exams: 'Exames Médicos',
    epi_requirements: 'EPI',
    risk_mapping: 'Mapeamento de Risco',
    working_hours: 'Jornada de Trabalho',
    additionals: 'Adicionais Legais',
    esocial: 'eSocial',
  };
  return labels[area] ?? area;
}

function buildImpactDescription(codigo: string, area: ImpactArea, count: number): string {
  return `${codigo}: ${count} cargo(s) afetado(s) na área de ${areaLabel(area)}.`;
}

function buildRecommendation(area: ImpactArea, codigo: string): string {
  const recs: Record<ImpactArea, string> = {
    career_positions: `Revisar requisitos legais dos cargos afetados pela ${codigo}.`,
    salary_floor: `Verificar se pisos salariais estão em conformidade com a ${codigo}.`,
    training_requirements: `Atualizar programa de treinamentos conforme nova ${codigo}.`,
    medical_exams: `Revisar PCMSO e periodicidade de exames conforme ${codigo}.`,
    epi_requirements: `Atualizar catálogo de EPI e entregas conforme ${codigo}.`,
    risk_mapping: `Revisar PGR e mapeamento de riscos conforme ${codigo}.`,
    working_hours: `Verificar jornadas e escalas conforme ${codigo}.`,
    additionals: `Revisar adicionais de insalubridade/periculosidade conforme ${codigo}.`,
    esocial: `Verificar eventos eSocial impactados pela ${codigo}.`,
  };
  return recs[area] ?? `Avaliar impacto da ${codigo}.`;
}
