/**
 * Compliance Recommender Engine
 *
 * Generates actionable compliance recommendations based on
 * CNAE profile, NR requirements, and risk analysis.
 */

import type {
  CnaeRiskProfile,
  ComplianceRecommendation,
  RecommendationSeverity,
  GrauRisco,
} from './types';

let _recommendationCounter = 0;
function nextId(): string {
  _recommendationCounter++;
  return `rec_${Date.now()}_${_recommendationCounter}`;
}

function grauToSeverity(grau: GrauRisco): RecommendationSeverity {
  if (grau >= 4) return 'critical';
  if (grau >= 3) return 'high';
  if (grau >= 2) return 'medium';
  return 'low';
}

export function generateRecommendations(profile: CnaeRiskProfile): ComplianceRecommendation[] {
  const recs: ComplianceRecommendation[] = [];
  const now = new Date().toISOString();
  const severity = grauToSeverity(profile.cnae.grau_risco);

  // 1) PGR obrigatório
  recs.push({
    id: nextId(),
    category: 'program',
    severity: 'critical',
    title: 'Elaborar Programa de Gerenciamento de Riscos (PGR)',
    description: 'Toda empresa com empregados deve possuir PGR conforme NR-1. Inventário de riscos e plano de ação.',
    legal_basis: 'NR-1, Capítulo 1.5',
    nr_reference: 1,
    deadline_days: 90,
    status: 'pending',
    created_at: now,
  });

  // 2) PCMSO obrigatório
  recs.push({
    id: nextId(),
    category: 'program',
    severity: 'critical',
    title: 'Implementar PCMSO',
    description: 'Programa de Controle Médico de Saúde Ocupacional com ASO admissional, periódico e demissional.',
    legal_basis: 'NR-7',
    nr_reference: 7,
    deadline_days: 60,
    status: 'pending',
    created_at: now,
  });

  // 3) SESMT se grau >= 3
  if (profile.cnae.requires_sesmt) {
    recs.push({
      id: nextId(),
      category: 'program',
      severity: 'high',
      title: 'Dimensionar SESMT conforme NR-4',
      description: `Grau de risco ${profile.cnae.grau_risco}: verificar obrigatoriedade de SESMT conforme Quadro II da NR-4.`,
      legal_basis: 'NR-4, Quadro II',
      nr_reference: 4,
      deadline_days: 30,
      status: 'pending',
      created_at: now,
    });
  }

  // 4) Treinamentos obrigatórios
  const mandatoryTrainings = profile.training_requirements.filter(t => t.priority === 'obrigatoria');
  if (mandatoryTrainings.length > 0) {
    recs.push({
      id: nextId(),
      category: 'training',
      severity,
      title: `Programar ${mandatoryTrainings.length} treinamento(s) obrigatório(s)`,
      description: mandatoryTrainings.map(t => `${t.training_name} (${t.workload_hours}h)`).join('; '),
      legal_basis: mandatoryTrainings.map(t => t.legal_basis).join('; '),
      nr_reference: null,
      deadline_days: 90,
      status: 'pending',
      created_at: now,
    });
  }

  // 5) EPI se riscos físicos/químicos/biológicos
  const highRiskCategories = profile.risk_categories.filter(rc =>
    ['fisico', 'quimico', 'biologico'].includes(rc.risk_type) && rc.probability >= 0.5
  );
  if (highRiskCategories.length > 0) {
    recs.push({
      id: nextId(),
      category: 'equipment',
      severity: 'high',
      title: 'Avaliar necessidade de EPIs por agente de risco',
      description: `Riscos identificados: ${highRiskCategories.map(r => r.risk_type).join(', ')}. Definir EPIs adequados e treinar colaboradores.`,
      legal_basis: 'NR-6',
      nr_reference: 6,
      deadline_days: 30,
      status: 'pending',
      created_at: now,
    });
  }

  // 6) Ergonomia para todos
  recs.push({
    id: nextId(),
    category: 'documentation',
    severity: profile.cnae.grau_risco >= 3 ? 'medium' : 'low',
    title: 'Realizar Análise Ergonômica do Trabalho (AET)',
    description: 'Avaliar postos de trabalho, mobiliário, equipamentos e organização do trabalho.',
    legal_basis: 'NR-17',
    nr_reference: 17,
    deadline_days: 120,
    status: 'pending',
    created_at: now,
  });

  // 7) Monitoramento de exames
  recs.push({
    id: nextId(),
    category: 'monitoring',
    severity: 'medium',
    title: 'Configurar alertas de vencimento de ASO',
    description: 'Monitorar validade dos Atestados de Saúde Ocupacional para evitar irregularidades.',
    legal_basis: 'NR-7, item 7.5.8',
    nr_reference: 7,
    deadline_days: 15,
    status: 'pending',
    created_at: now,
  });

  return recs.sort((a, b) => {
    const order: Record<RecommendationSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });
}
