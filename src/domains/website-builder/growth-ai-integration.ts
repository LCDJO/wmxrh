/**
 * GrowthAIIntegration — Connects GrowthAI insights to the Website Builder.
 *
 * Provides three core suggestion types:
 *   1. Headline optimization (tone, CTR prediction, A/B variants)
 *   2. FAB block reordering (by predicted impact)
 *   3. Conversion improvements (CTA, layout, urgency signals)
 *
 * READ-ONLY: suggestions are returned for user confirmation, never auto-applied.
 */
import type { WebsiteBlock } from './types';

// ── Types ────────────────────────────────────────────────────────

export type SuggestionCategory = 'headline' | 'fab-reorder' | 'conversion';
export type SuggestionPriority = 'high' | 'medium' | 'low';

export interface GrowthSuggestion {
  id: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  title: string;
  description: string;
  /** The block this suggestion applies to (null = page-level) */
  blockId: string | null;
  /** Predicted uplift percentage */
  predictedUplift: number;
  /** Concrete payload the UI can apply on user confirmation */
  payload: Record<string, unknown>;
}

export interface HeadlineVariant {
  text: string;
  tone: 'urgente' | 'confiança' | 'benefício' | 'social_proof';
  predictedCtr: number;
}

export interface FABRanking {
  blockId: string;
  currentOrder: number;
  suggestedOrder: number;
  impactScore: number;
  reason: string;
}

export interface ConversionTip {
  area: 'cta' | 'layout' | 'urgency' | 'social_proof' | 'pricing';
  suggestion: string;
  predictedUplift: number;
}

// ── Heuristic Engine (rule-based, no AI call needed) ─────────────

/**
 * Analyze hero blocks and suggest optimized headlines.
 */
export function suggestHeadlines(blocks: WebsiteBlock[]): GrowthSuggestion[] {
  const heroes = blocks.filter(b => b.type === 'hero');
  const suggestions: GrowthSuggestion[] = [];

  for (const hero of heroes) {
    const headline = String(hero.content.headline ?? '');
    const sub = String(hero.content.subheadline ?? '');

    // Rule 1: headline too long
    if (headline.length > 50) {
      suggestions.push({
        id: `hl-len-${hero.id}`,
        category: 'headline',
        priority: 'high',
        title: 'Headline muito longa',
        description: `"${headline.slice(0, 30)}…" tem ${headline.length} chars. Headlines ≤ 50 chars convertem 18% melhor.`,
        blockId: hero.id,
        predictedUplift: 18,
        payload: { field: 'headline', maxLength: 50 },
      });
    }

    // Rule 2: no action verb
    const actionVerbs = /^(automatize|reduza|simplifique|transforme|descubra|comece|acelere|elimine|otimize|gerencie)/i;
    if (!actionVerbs.test(headline.trim())) {
      suggestions.push({
        id: `hl-verb-${hero.id}`,
        category: 'headline',
        priority: 'medium',
        title: 'Headline sem verbo de ação',
        description: 'Headlines com verbo de ação no início geram +12% CTR.',
        blockId: hero.id,
        predictedUplift: 12,
        payload: { field: 'headline', tip: 'Comece com verbo imperativo' },
      });
    }

    // Rule 3: subheadline missing metrics
    if (sub && !/\d+/.test(sub)) {
      suggestions.push({
        id: `hl-metric-${hero.id}`,
        category: 'headline',
        priority: 'low',
        title: 'Subheadline sem métricas',
        description: 'Adicionar números concretos (ex: "40% menos tempo") aumenta credibilidade.',
        blockId: hero.id,
        predictedUplift: 8,
        payload: { field: 'subheadline', tip: 'Incluir métrica quantitativa' },
      });
    }

    // Rule 4: no secondary CTA
    if (!hero.content.secondaryCta) {
      suggestions.push({
        id: `hl-cta2-${hero.id}`,
        category: 'conversion',
        priority: 'medium',
        title: 'CTA secundário ausente no Hero',
        description: 'Um CTA alternativo (ex: "Ver demo") captura visitantes indecisos (+9% conversão).',
        blockId: hero.id,
        predictedUplift: 9,
        payload: { field: 'secondaryCta', suggestedText: 'Ver demonstração' },
      });
    }
  }

  return suggestions;
}

/**
 * Analyze FAB blocks and suggest optimal ordering by impact.
 */
export function suggestFABReorder(blocks: WebsiteBlock[]): GrowthSuggestion[] {
  const fabs = blocks.filter(b => b.type === 'fab-block');
  if (fabs.length < 2) return [];

  // Score each FAB by heuristic impact (benefit strength, specificity)
  const scored: FABRanking[] = fabs.map(fab => {
    const benefit = String(fab.content.benefit ?? '');
    let score = 50;

    // Boost: has numbers/metrics
    if (/\d+%?/.test(benefit)) score += 20;
    // Boost: action-oriented benefit
    if (/reduza|aumente|elimine|economize|acelere/i.test(benefit)) score += 15;
    // Boost: short and punchy
    if (benefit.length <= 60) score += 10;
    // Penalize: vague benefit
    if (/melhor|bom|ótimo|excelente/i.test(benefit) && !/\d/.test(benefit)) score -= 10;

    return {
      blockId: fab.id,
      currentOrder: fab.order,
      suggestedOrder: 0,
      impactScore: Math.min(100, Math.max(0, score)),
      reason: score >= 70 ? 'Alto impacto' : score >= 50 ? 'Impacto moderado' : 'Baixo impacto',
    };
  });

  // Sort by impact descending
  scored.sort((a, b) => b.impactScore - a.impactScore);
  scored.forEach((s, i) => { s.suggestedOrder = i; });

  // Only suggest if reorder differs from current
  const needsReorder = scored.some((s, i) => {
    const currentIdx = fabs.findIndex(f => f.id === s.blockId);
    return currentIdx !== i;
  });

  if (!needsReorder) return [];

  return [{
    id: 'fab-reorder',
    category: 'fab-reorder',
    priority: 'high',
    title: 'Reordenar FAB Blocks por impacto',
    description: `FABs com benefício quantitativo devem aparecer primeiro. Ordem sugerida: ${scored.map(s => `#${s.suggestedOrder + 1}`).join(' → ')}`,
    blockId: null,
    predictedUplift: 15,
    payload: {
      rankings: scored,
      newOrder: scored.map(s => s.blockId),
    },
  }];
}

/**
 * General conversion improvement suggestions based on page structure.
 */
export function suggestConversionImprovements(blocks: WebsiteBlock[]): GrowthSuggestion[] {
  const suggestions: GrowthSuggestion[] = [];
  const types = blocks.map(b => b.type);

  // Rule 1: no testimonials
  if (!types.includes('testimonial-slider')) {
    suggestions.push({
      id: 'conv-testimonial',
      category: 'conversion',
      priority: 'high',
      title: 'Adicionar prova social',
      description: 'Páginas com depoimentos convertem em média 34% mais.',
      blockId: null,
      predictedUplift: 34,
      payload: { addBlock: 'testimonial-slider', position: 'after-fab' },
    });
  }

  // Rule 2: no FAQ
  if (!types.includes('faq-accordion')) {
    suggestions.push({
      id: 'conv-faq',
      category: 'conversion',
      priority: 'medium',
      title: 'Adicionar FAQ',
      description: 'FAQs reduzem objeções e aumentam conversão em ~12%.',
      blockId: null,
      predictedUplift: 12,
      payload: { addBlock: 'faq-accordion', position: 'before-footer' },
    });
  }

  // Rule 3: CTA without urgency
  const ctas = blocks.filter(b => b.type === 'cta-section');
  for (const cta of ctas) {
    const headline = String(cta.content.headline ?? '');
    if (!/grátis|limitad|últim|agora|hoje/i.test(headline)) {
      suggestions.push({
        id: `conv-urgency-${cta.id}`,
        category: 'conversion',
        priority: 'medium',
        title: 'CTA sem gatilho de urgência',
        description: 'Adicionar urgência ou escassez aumenta conversão em ~11%.',
        blockId: cta.id,
        predictedUplift: 11,
        payload: { field: 'headline', tip: 'Adicionar urgência ou oferta limitada' },
      });
    }
  }

  // Rule 4: pricing not highlighted
  const pricing = blocks.filter(b => b.type === 'pricing-table');
  for (const p of pricing) {
    const plans = (p.content.plans ?? []) as Array<{ highlighted?: boolean }>;
    const hasHighlight = plans.some(pl => pl.highlighted);
    if (!hasHighlight && plans.length > 1) {
      suggestions.push({
        id: `conv-pricing-${p.id}`,
        category: 'conversion',
        priority: 'high',
        title: 'Destacar plano recomendado',
        description: 'Páginas com plano destacado têm 22% mais conversão.',
        blockId: p.id,
        predictedUplift: 22,
        payload: { action: 'highlight-popular-plan' },
      });
    }
  }

  return suggestions;
}

// ── Aggregator ───────────────────────────────────────────────────

/**
 * Run all Growth AI analyses on a set of blocks and return prioritized suggestions.
 */
export function analyzePageForGrowth(blocks: WebsiteBlock[]): GrowthSuggestion[] {
  const all = [
    ...suggestHeadlines(blocks),
    ...suggestFABReorder(blocks),
    ...suggestConversionImprovements(blocks),
  ];

  // Sort by predicted uplift descending
  all.sort((a, b) => b.predictedUplift - a.predictedUplift);

  return all;
}

/**
 * Apply a suggestion payload to blocks (pure function, returns new array).
 * The caller MUST confirm with the user before calling this.
 */
export function applySuggestion(
  blocks: WebsiteBlock[],
  suggestion: GrowthSuggestion,
): WebsiteBlock[] {
  if (suggestion.category === 'fab-reorder' && suggestion.payload.newOrder) {
    const order = suggestion.payload.newOrder as string[];
    return blocks.map(b => {
      const idx = order.indexOf(b.id);
      if (idx === -1) return b;
      return { ...b, order: idx };
    });
  }

  // Block-level field suggestion — no auto-mutation, just returns as-is
  // The UI should open an edit modal with the suggestion pre-filled
  return blocks;
}
