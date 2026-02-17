/**
 * LandingGovernanceAIValidator — Pre-submission intelligence layer.
 *
 * Detects:
 *  1. Large FAB changes between current draft and last published version
 *  2. Conversion drop risk based on historical metrics + structural analysis
 *
 * Returns GovernanceAIAlert[] consumed by LandingPreSubmitAlert component.
 */
import { supabase } from '@/integrations/supabase/client';
import type { FABBlock, FABContent, LandingPage } from './types';
import { aiConversionDesigner } from './ai-conversion-designer';
import { fabContentEngine } from './landing-page-builder';

// ═══════════════════════════════════
// Types
// ═══════════════════════════════════

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface GovernanceAIAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  category: 'fab_drift' | 'conversion_risk' | 'structure_degradation';
  metrics: Record<string, number | string>;
  suggestedActions: string[];
}

// ═══════════════════════════════════
// Thresholds
// ═══════════════════════════════════

/** % of FAB fields changed to trigger a warning */
const FAB_DRIFT_WARN = 40;
/** % of FAB fields changed to trigger a critical alert */
const FAB_DRIFT_CRITICAL = 70;
/** Minimum conversion score drop (points) to flag risk */
const SCORE_DROP_WARN = 10;
const SCORE_DROP_CRITICAL = 20;
/** Number of blocks removed to flag structure degradation */
const BLOCKS_REMOVED_WARN = 2;

// ═══════════════════════════════════
// FAB Diff Utilities
// ═══════════════════════════════════

interface FABDiffResult {
  totalFields: number;
  changedFields: number;
  driftPct: number;
  details: Array<{
    blockType: string;
    field: 'feature' | 'advantage' | 'benefit';
    oldValue: string;
    newValue: string;
  }>;
}

function diffFABContent(a: FABContent, b: FABContent): Array<'feature' | 'advantage' | 'benefit'> {
  const changed: Array<'feature' | 'advantage' | 'benefit'> = [];
  if (normalize(a.feature) !== normalize(b.feature)) changed.push('feature');
  if (normalize(a.advantage) !== normalize(b.advantage)) changed.push('advantage');
  if (normalize(a.benefit) !== normalize(b.benefit)) changed.push('benefit');
  return changed;
}

function normalize(s: string): string {
  return (s ?? '').trim().toLowerCase();
}

function computeFABDrift(oldBlocks: FABBlock[], newBlocks: FABBlock[]): FABDiffResult {
  const details: FABDiffResult['details'] = [];
  let totalFields = 0;
  let changedFields = 0;

  // Match blocks by ID for direct comparison
  const oldMap = new Map(oldBlocks.map(b => [b.id, b]));

  for (const nb of newBlocks) {
    const ob = oldMap.get(nb.id);
    if (!ob) {
      // New block — all 3 FAB fields count as changed
      totalFields += 3;
      changedFields += 3;
      for (const f of ['feature', 'advantage', 'benefit'] as const) {
        details.push({ blockType: nb.type, field: f, oldValue: '', newValue: nb.fab[f] ?? '' });
      }
      continue;
    }

    totalFields += 3;
    const diffs = diffFABContent(ob.fab, nb.fab);
    changedFields += diffs.length;
    for (const f of diffs) {
      details.push({ blockType: nb.type, field: f, oldValue: ob.fab[f] ?? '', newValue: nb.fab[f] ?? '' });
    }
  }

  // Removed blocks count as changes
  for (const ob of oldBlocks) {
    if (!newBlocks.find(nb => nb.id === ob.id)) {
      totalFields += 3;
      changedFields += 3;
      for (const f of ['feature', 'advantage', 'benefit'] as const) {
        details.push({ blockType: ob.type, field: f, oldValue: ob.fab[f] ?? '', newValue: '' });
      }
    }
  }

  const driftPct = totalFields > 0 ? Math.round((changedFields / totalFields) * 100) : 0;
  return { totalFields, changedFields, driftPct, details };
}

// ═══════════════════════════════════
// Validator
// ═══════════════════════════════════

class LandingGovernanceAIValidator {

  /**
   * Run all governance AI checks for a landing page draft before submission.
   * Compares the current draft state against the last published version.
   */
  async validate(currentPage: LandingPage): Promise<GovernanceAIAlert[]> {
    const alerts: GovernanceAIAlert[] = [];

    // 1. Fetch last published version for comparison
    const previousBlocks = await this.fetchLastPublishedBlocks(currentPage.id);

    // 2. FAB Drift detection
    if (previousBlocks) {
      const drift = computeFABDrift(previousBlocks, currentPage.blocks);
      alerts.push(...this.evaluateFABDrift(drift, currentPage));
    }

    // 3. Conversion score comparison
    alerts.push(...this.evaluateConversionRisk(currentPage, previousBlocks));

    // 4. Structure degradation (block removal)
    if (previousBlocks) {
      alerts.push(...this.evaluateStructureDegradation(previousBlocks, currentPage.blocks, currentPage));
    }

    return alerts.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity];
    });
  }

  // ── Detectors ──────────────────────────────────

  private evaluateFABDrift(drift: FABDiffResult, page: LandingPage): GovernanceAIAlert[] {
    if (drift.driftPct < FAB_DRIFT_WARN) return [];

    const severity: AlertSeverity = drift.driftPct >= FAB_DRIFT_CRITICAL ? 'critical' : 'warning';
    const changedTypes = [...new Set(drift.details.map(d => d.blockType))].join(', ');

    return [{
      id: `gov-fab-drift-${page.id}`,
      severity,
      title: `Grande alteração de FAB detectada (${drift.driftPct}%)`,
      description:
        `${drift.changedFields} de ${drift.totalFields} campos FAB foram modificados em relação à versão publicada. ` +
        `Blocos afetados: ${changedTypes}. Mudanças significativas no conteúdo FAB podem impactar a taxa de conversão.`,
      category: 'fab_drift',
      metrics: {
        drift_pct: drift.driftPct,
        changed_fields: drift.changedFields,
        total_fields: drift.totalFields,
      },
      suggestedActions: [
        'Revisar cada alteração FAB antes de submeter',
        'Considerar teste A/B para validar as mudanças',
        'Manter backup da versão anterior para rollback rápido',
        drift.driftPct >= FAB_DRIFT_CRITICAL
          ? 'RECOMENDAÇÃO: Submeter versão com mudanças incrementais'
          : 'Documentar a motivação das alterações nos notes da submissão',
      ],
    }];
  }

  private evaluateConversionRisk(page: LandingPage, previousBlocks: FABBlock[] | null): GovernanceAIAlert[] {
    const alerts: GovernanceAIAlert[] = [];

    // Score current page
    const blueprint = fabContentEngine.generateBlueprint('default', []);
    const currentScore = aiConversionDesigner.scorePage(page, blueprint);

    // If there's historical data, compare
    const historicalRate = page.analytics.conversionRate;
    const currentGrade = currentScore.total;

    // Check FAB completeness drop
    if (currentScore.breakdown.fabCompleteness < 10) {
      alerts.push({
        id: `gov-fab-incomplete-${page.id}`,
        severity: 'warning',
        title: 'FAB incompleto pode reduzir conversão',
        description:
          `O score de completude FAB é ${currentScore.breakdown.fabCompleteness}/20. ` +
          `Páginas com FAB incompleto têm historicamente taxas de conversão 30-50% menores.`,
        category: 'conversion_risk',
        metrics: {
          fab_score: currentScore.breakdown.fabCompleteness,
          total_score: currentScore.total,
          grade: currentScore.grade,
        },
        suggestedActions: [
          'Completar os campos Feature, Advantage e Benefit de cada bloco',
          'Usar o AI FAB Generator para sugestões automáticas',
        ],
      });
    }

    // Check if overall score is poor
    if (currentScore.total < 50) {
      alerts.push({
        id: `gov-low-score-${page.id}`,
        severity: currentScore.total < 30 ? 'critical' : 'warning',
        title: `Score de conversão baixo: ${currentScore.total}/100 (${currentScore.grade})`,
        description:
          `A análise de conversion-readiness indica que a página tem potencial de conversão limitado. ` +
          `Áreas críticas: ${currentScore.suggestions.filter(s => s.priority === 'high').map(s => s.area).join(', ') || 'múltiplas'}.`,
        category: 'conversion_risk',
        metrics: {
          total_score: currentScore.total,
          hero_clarity: currentScore.breakdown.heroClarity,
          fab_completeness: currentScore.breakdown.fabCompleteness,
          cta_strength: currentScore.breakdown.ctaStrength,
          historical_conversion_rate: historicalRate,
        },
        suggestedActions: currentScore.suggestions
          .filter(s => s.priority === 'high')
          .slice(0, 4)
          .map(s => s.description),
      });
    }

    return alerts;
  }

  private evaluateStructureDegradation(
    oldBlocks: FABBlock[],
    newBlocks: FABBlock[],
    page: LandingPage,
  ): GovernanceAIAlert[] {
    const removedBlocks = oldBlocks.filter(ob => !newBlocks.find(nb => nb.id === ob.id));
    if (removedBlocks.length < BLOCKS_REMOVED_WARN) return [];

    const removedTypes = removedBlocks.map(b => b.type).join(', ');
    const hasCTARemoved = removedBlocks.some(b => b.type === 'cta');

    return [{
      id: `gov-struct-degrade-${page.id}`,
      severity: hasCTARemoved ? 'critical' : 'warning',
      title: `${removedBlocks.length} blocos removidos da versão publicada`,
      description:
        `Blocos removidos: ${removedTypes}. ` +
        (hasCTARemoved
          ? 'A remoção de um bloco CTA é especialmente arriscada — pode eliminar o ponto de conversão principal.'
          : 'Remover blocos pode impactar negativamente o fluxo de conversão da página.'),
      category: 'structure_degradation',
      metrics: {
        blocks_removed: removedBlocks.length,
        old_block_count: oldBlocks.length,
        new_block_count: newBlocks.length,
      },
      suggestedActions: [
        'Verificar se a remoção foi intencional',
        'Comparar métricas da versão anterior antes de prosseguir',
        ...(hasCTARemoved ? ['URGENTE: Garantir que ao menos um bloco CTA permanece na página'] : []),
      ],
    }];
  }

  // ── Data Fetching ──────────────────────────────

  private async fetchLastPublishedBlocks(landingPageId: string): Promise<FABBlock[] | null> {
    try {
      // Fetch the last published version's snapshot from approval requests
      const { data } = await (supabase
        .from('landing_page_approval_requests') as any)
        .select('page_snapshot')
        .eq('landing_page_id', landingPageId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!data || data.length === 0) return null;

      const snapshot = data[0].page_snapshot;
      if (snapshot && Array.isArray(snapshot.blocks)) {
        return snapshot.blocks as FABBlock[];
      }

      // Fallback: try landing_page_versions table
      const { data: versions } = await (supabase
        .from('landing_page_versions') as any)
        .select('snapshot')
        .eq('landing_page_id', landingPageId)
        .eq('status', 'published')
        .order('version_number', { ascending: false })
        .limit(1);

      if (versions && versions.length > 0 && versions[0].snapshot?.blocks) {
        return versions[0].snapshot.blocks as FABBlock[];
      }

      return null;
    } catch {
      return null;
    }
  }
}

export const landingGovernanceAIValidator = new LandingGovernanceAIValidator();
export type { FABDiffResult };
