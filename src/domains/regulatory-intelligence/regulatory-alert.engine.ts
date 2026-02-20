/**
 * Regulatory Alert Generation Engine — Pure (no I/O)
 *
 * Transforms impacts into actionable alerts for users.
 *
 * Integrations:
 *  - Safety Automation Engine (trigger playbooks)
 *  - Workforce Intelligence (strategic risk signals)
 *  - Security Kernel (alert routing by role)
 */

import type {
  RegulatoryImpact,
  RegulatoryAlert,
  CreateRegulatoryAlertDTO,
  ImpactSeverity,
  RegulatoryAlertType,
} from './types';

function inferAlertType(normCodigo: string): RegulatoryAlertType {
  if (/^NR-/i.test(normCodigo)) return 'NR_UPDATED';
  if (/^CCT/i.test(normCodigo)) return 'CCT_UPDATED';
  if (/esocial/i.test(normCodigo)) return 'ESOCIAL_LAYOUT_CHANGED';
  return 'LEGISLATION_UPDATED';
}

export interface AlertGenerationResult {
  alerts: CreateRegulatoryAlertDTO[];
  total: number;
  urgent_count: number;
}

/**
 * Generates alert DTOs from a list of impacts.
 */
export function generateAlerts(
  tenantId: string,
  impacts: Omit<RegulatoryImpact, 'id' | 'tenant_id' | 'created_at'>[],
  options?: { assignToUserId?: string }
): AlertGenerationResult {
  const alerts: CreateRegulatoryAlertDTO[] = [];

  for (const impact of impacts) {
    const affectedCount = impact.entidades_afetadas.length;
    const entityNames = impact.entidades_afetadas
      .slice(0, 5)
      .map(e => e.name)
      .join(', ');
    const suffix = affectedCount > 5 ? ` e mais ${affectedCount - 5}` : '';

    alerts.push({
      tenant_id: tenantId,
      alert_type: inferAlertType(impact.norm_codigo),
      norm_codigo: impact.norm_codigo,
      titulo: buildAlertTitle(impact.norm_codigo, impact.area_impactada, impact.severidade),
      mensagem: `${impact.descricao}\n\nEntidades afetadas: ${entityNames}${suffix}.\n\n${impact.acao_recomendada ?? ''}`,
      severidade: impact.severidade,
      area: impact.area_impactada,
      acao_requerida: impact.severidade === 'urgente' || impact.severidade === 'critico' || impact.severidade === 'acao_requerida',
      prazo_acao: computeDeadline(impact.severidade),
      destinatario_user_id: options?.assignToUserId ?? null,
      metadata: {
        affected_entity_count: affectedCount,
        norm_version_id: impact.norm_version_id,
      },
    });
  }

  return {
    alerts,
    total: alerts.length,
    urgent_count: alerts.filter(a => a.severidade === 'urgente' || a.severidade === 'critico').length,
  };
}

// ── Helpers ──

function buildAlertTitle(codigo: string, area: string, severity: ImpactSeverity): string {
  const prefix = severity === 'urgente' || severity === 'critico' ? '⚠️ ' : '';
  const areaLabels: Record<string, string> = {
    career_positions: 'Cargos',
    salary_floor: 'Piso Salarial',
    training_requirements: 'Treinamentos',
    medical_exams: 'Exames Médicos',
    epi_requirements: 'EPI',
    risk_mapping: 'Mapeamento de Risco',
    working_hours: 'Jornada',
    additionals: 'Adicionais',
    esocial: 'eSocial',
  };
  return `${prefix}Atualização ${codigo} — ${areaLabels[area] ?? area}`;
}

function computeDeadline(severity: ImpactSeverity): string | null {
  const now = new Date();
  switch (severity) {
    case 'critico':
      now.setDate(now.getDate() + 7);
      return now.toISOString();
    case 'urgente':
      now.setDate(now.getDate() + 15);
      return now.toISOString();
    case 'acao_requerida':
      now.setDate(now.getDate() + 30);
      return now.toISOString();
    default:
      return null;
  }
}
