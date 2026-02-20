/**
 * Career → Workforce Intelligence Integration Engine
 *
 * Synthesizes career-intelligence data into StrategicInsight[]
 * consumable by the Workforce Intelligence insight pipeline.
 *
 * Generates insights for:
 *  1. Cargos com alto risco jurídico (legal-mapping + missing requirements)
 *  2. Desalinhamento salarial (position salary vs benchmark/CCT floor)
 *  3. Progressões recomendadas (career tracks with unmet tenure)
 *
 * Pure function — no I/O.
 */

import type { StrategicInsight, InsightCategory } from '../workforce-intelligence/types';
import type {
  CareerPosition,
  CareerLegalMapping,
  CareerLegalRequirement,
  CareerSalaryBenchmark,
  CareerTrack,
} from './types';

// ── Input ──

export interface CareerWiIntegrationInput {
  positions: CareerPosition[];
  mappingsByPosition: Record<string, CareerLegalMapping[]>;
  requirementsByPosition: Record<string, CareerLegalRequirement[]>;
  benchmarksByPosition: Record<string, CareerSalaryBenchmark[]>;
  tracks: CareerTrack[];
  /** Employee tenure in months keyed by career_position_id (aggregated) */
  avgTenureByPosition?: Record<string, number>;
  pisoSalarial: number;
}

// ── Engine ──

export function generateCareerInsights(input: CareerWiIntegrationInput): StrategicInsight[] {
  const insights: StrategicInsight[] = [];
  let idCounter = 0;
  const iid = () => `CI-${String(++idCounter).padStart(3, '0')}`;

  const {
    positions,
    mappingsByPosition,
    requirementsByPosition,
    benchmarksByPosition,
    tracks,
    avgTenureByPosition,
    pisoSalarial,
  } = input;

  const active = positions.filter(p => p.ativo);

  // ── 1. Cargos com alto risco jurídico ──
  const highRiskPositions: { pos: CareerPosition; gaps: string[] }[] = [];

  for (const pos of active) {
    const gaps: string[] = [];
    const mappings = mappingsByPosition[pos.id] || [];
    const reqs = requirementsByPosition[pos.id] || [];

    // Missing CBO
    if (!pos.cbo_codigo) gaps.push('CBO ausente');

    // NR required but no training requirement
    for (const m of mappings) {
      if (m.nr_codigo && !reqs.some(r => r.tipo === 'nr_training' && r.codigo_referencia === m.nr_codigo)) {
        gaps.push(`${m.nr_codigo} sem treinamento`);
      }
    }

    // Risk mapping without medical requirement
    if (mappings.some(m => m.exige_exame_medico || m.adicional_aplicavel != null)) {
      if (!reqs.some(r => r.tipo === 'exame_medico')) {
        gaps.push('Risco sem PCMSO');
      }
    }

    // Salary below floor
    if (pos.faixa_salarial_min > 0 && pos.faixa_salarial_min < pisoSalarial) {
      gaps.push('Salário abaixo do piso');
    }

    if (gaps.length > 0) highRiskPositions.push({ pos, gaps });
  }

  if (highRiskPositions.length > 0) {
    const critical = highRiskPositions.filter(h => h.gaps.length >= 2);
    insights.push({
      insight_id: iid(),
      category: 'compliance_alert' as InsightCategory,
      priority: critical.length > 0 ? 'urgent' : 'high',
      title: 'Cargos com alto risco jurídico',
      summary: `${highRiskPositions.length} cargo(s) com gaps de conformidade legal detectados.`,
      detail: highRiskPositions
        .slice(0, 5)
        .map(h => `• ${h.pos.nome}: ${h.gaps.join(', ')}`)
        .join('\n'),
      recommended_actions: [
        'Priorizar regularização dos cargos com múltiplos gaps',
        'Vincular treinamentos NR obrigatórios aos cargos',
        'Cadastrar exames médicos (ASO) para cargos com risco',
      ],
      data_points: {
        total_risk_positions: highRiskPositions.length,
        critical_positions: critical.length,
        total_gaps: highRiskPositions.reduce((s, h) => s + h.gaps.length, 0),
      },
      audience: ['hr', 'legal'],
    });
  }

  // ── 2. Desalinhamento salarial (position vs benchmark) ──
  const misaligned: { pos: CareerPosition; gap_pct: number; median: number }[] = [];

  for (const pos of active) {
    const benchmarks = benchmarksByPosition[pos.id] || [];
    if (benchmarks.length === 0) continue;

    // Use most recent benchmark median
    const latest = benchmarks.sort((a, b) =>
      b.referencia_data.localeCompare(a.referencia_data)
    )[0];

    const midpoint = (pos.faixa_salarial_min + pos.faixa_salarial_max) / 2;
    if (midpoint <= 0 || latest.valor_mediano <= 0) continue;

    const gap_pct = ((midpoint - latest.valor_mediano) / latest.valor_mediano) * 100;

    // Flag if >15% below benchmark
    if (gap_pct < -15) {
      misaligned.push({ pos, gap_pct, median: latest.valor_mediano });
    }
  }

  if (misaligned.length > 0) {
    insights.push({
      insight_id: iid(),
      category: 'salary_action' as InsightCategory,
      priority: misaligned.length >= 3 ? 'high' : 'medium',
      title: 'Desalinhamento salarial detectado',
      summary: `${misaligned.length} cargo(s) com faixa salarial >15% abaixo do benchmark.`,
      detail: misaligned
        .sort((a, b) => a.gap_pct - b.gap_pct)
        .slice(0, 5)
        .map(m => `• ${m.pos.nome}: ${m.gap_pct.toFixed(1)}% abaixo (mediana R$ ${fmt(m.median)})`)
        .join('\n'),
      recommended_actions: [
        'Revisar faixas salariais dos cargos desalinhados',
        'Avaliar impacto financeiro de ajuste ao benchmark',
        'Priorizar cargos com maior risco de turnover',
      ],
      data_points: {
        misaligned_positions: misaligned.length,
        worst_gap_pct: Math.abs(Math.min(...misaligned.map(m => m.gap_pct))),
      },
      audience: ['hr', 'finance'],
    });
  }

  // ── 3. Progressões recomendadas ──
  if (tracks.length > 0 && avgTenureByPosition) {
    const readyProgressions: {
      track: CareerTrack;
      originName: string;
      destName: string;
      avgTenure: number;
    }[] = [];

    const posMap = new Map(active.map(p => [p.id, p]));

    for (const track of tracks) {
      if (!track.ativo) continue;
      const avg = avgTenureByPosition[track.cargo_origem_id];
      if (avg == null) continue;

      if (avg >= track.tempo_minimo_meses) {
        const origin = posMap.get(track.cargo_origem_id);
        const dest = posMap.get(track.cargo_destino_id);
        if (origin && dest) {
          readyProgressions.push({
            track,
            originName: origin.nome,
            destName: dest.nome,
            avgTenure: avg,
          });
        }
      }
    }

    if (readyProgressions.length > 0) {
      insights.push({
        insight_id: iid(),
        category: 'workforce_trend' as InsightCategory,
        priority: 'medium',
        title: 'Progressões de carreira recomendadas',
        summary: `${readyProgressions.length} progressão(ões) com tempo mínimo já atingido.`,
        detail: readyProgressions
          .slice(0, 5)
          .map(
            p =>
              `• ${p.originName} → ${p.destName}: tempo médio ${p.avgTenure.toFixed(0)} meses (mín. ${p.track.tempo_minimo_meses})`
          )
          .join('\n'),
        recommended_actions: [
          'Avaliar colaboradores elegíveis para promoção',
          'Verificar requisitos de competência e certificação',
          'Planejar impacto financeiro das progressões',
        ],
        data_points: {
          ready_progressions: readyProgressions.length,
          total_tracks: tracks.length,
        },
        audience: ['hr', 'executive'],
      });
    }
  }

  return insights;
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
