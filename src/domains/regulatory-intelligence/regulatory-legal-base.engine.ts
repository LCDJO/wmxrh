/**
 * Legal Base Updater Engine — Pure analysis (no I/O)
 *
 * Determines which internal legal references need updating
 * when a regulatory norm changes. Produces update instructions
 * for the service layer.
 *
 * Integrations:
 *  - Career & Legal Intelligence (legal references, legal mappings)
 *  - Labor Rules Engine (rule definitions, CCT clauses)
 *  - NR Training Lifecycle (training catalog updates)
 */

import type {
  LegalBaseRefreshInput,
  LegalBaseUpdate,
  ImpactArea,
} from './types';

export interface LegalBaseRefreshResult {
  updates: Omit<LegalBaseUpdate, 'id' | 'tenant_id' | 'created_at'>[];
  auto_applicable: number;
  manual_review_required: number;
  summary: string;
}

/**
 * Produces a set of legal base update instructions from impacts.
 */
export function computeLegalBaseUpdates(input: LegalBaseRefreshInput): LegalBaseRefreshResult {
  const { norm, new_version, impacts } = input;
  const updates: Omit<LegalBaseUpdate, 'id' | 'tenant_id' | 'created_at'>[] = [];

  // Create base norm version update
  updates.push({
    norm_id: norm.id,
    norm_version_id: new_version.id,
    tipo_atualizacao: norm.status === 'revogada' ? 'revogacao' : 'alteracao',
    campo_alterado: 'versao',
    valor_anterior: String(norm.versao),
    valor_novo: String(new_version.versao),
    aplicado_automaticamente: true,
    aplicado_por: null,
  });

  // Per-area specific updates
  const impactedAreas = new Set(impacts.map(i => i.area_impactada));

  if (impactedAreas.has('training_requirements')) {
    updates.push({
      norm_id: norm.id,
      norm_version_id: new_version.id,
      tipo_atualizacao: 'alteracao',
      campo_alterado: 'treinamentos_obrigatorios',
      valor_anterior: null,
      valor_novo: `Atualizar catálogo de treinamentos conforme ${norm.codigo} v${new_version.versao}`,
      aplicado_automaticamente: false, // Requires manual review
      aplicado_por: null,
    });
  }

  if (impactedAreas.has('medical_exams')) {
    updates.push({
      norm_id: norm.id,
      norm_version_id: new_version.id,
      tipo_atualizacao: 'alteracao',
      campo_alterado: 'periodicidade_exames',
      valor_anterior: null,
      valor_novo: `Verificar periodicidade de exames PCMSO conforme ${norm.codigo} v${new_version.versao}`,
      aplicado_automaticamente: false,
      aplicado_por: null,
    });
  }

  if (impactedAreas.has('epi_requirements')) {
    updates.push({
      norm_id: norm.id,
      norm_version_id: new_version.id,
      tipo_atualizacao: 'alteracao',
      campo_alterado: 'epi_obrigatorios',
      valor_anterior: null,
      valor_novo: `Revisar catálogo de EPI conforme ${norm.codigo} v${new_version.versao}`,
      aplicado_automaticamente: false,
      aplicado_por: null,
    });
  }

  if (impactedAreas.has('salary_floor')) {
    updates.push({
      norm_id: norm.id,
      norm_version_id: new_version.id,
      tipo_atualizacao: 'alteracao',
      campo_alterado: 'piso_salarial',
      valor_anterior: null,
      valor_novo: `Atualizar pisos salariais das faixas de cargo conforme ${norm.codigo}`,
      aplicado_automaticamente: false,
      aplicado_por: null,
    });
  }

  if (impactedAreas.has('additionals')) {
    updates.push({
      norm_id: norm.id,
      norm_version_id: new_version.id,
      tipo_atualizacao: 'alteracao',
      campo_alterado: 'adicionais_legais',
      valor_anterior: null,
      valor_novo: `Revisar percentuais de insalubridade/periculosidade conforme ${norm.codigo}`,
      aplicado_automaticamente: false,
      aplicado_por: null,
    });
  }

  if (impactedAreas.has('risk_mapping')) {
    updates.push({
      norm_id: norm.id,
      norm_version_id: new_version.id,
      tipo_atualizacao: 'alteracao',
      campo_alterado: 'mapeamento_risco',
      valor_anterior: null,
      valor_novo: `Revisar PGR e mapeamento de riscos conforme ${norm.codigo} v${new_version.versao}`,
      aplicado_automaticamente: false,
      aplicado_por: null,
    });
  }

  const auto = updates.filter(u => u.aplicado_automaticamente).length;
  const manual = updates.filter(u => !u.aplicado_automaticamente).length;

  return {
    updates,
    auto_applicable: auto,
    manual_review_required: manual,
    summary: `${norm.codigo}: ${updates.length} atualizações identificadas (${auto} automáticas, ${manual} para revisão manual).`,
  };
}
