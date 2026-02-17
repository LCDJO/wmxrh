/**
 * AIConversionDesigner — AI-powered conversion optimization engine.
 *
 * Responsibilities:
 *  1. Analyze page structure and suggest improvements
 *  2. Auto-generate high-converting copy variants
 *  3. Score pages on conversion-readiness
 *  4. Recommend A/B test configurations
 *  5. Bridge with GrowthGovernanceAnalyzer for insights
 */
import type { LandingPage, FABContent, LPCopyBlueprint } from './types';
import { fabContentEngine } from './landing-page-builder';
import { conversionTrackingService } from './conversion-tracking-service';
import { emitGrowthEvent } from './growth.events';

// ── Conversion Score Breakdown ─────────────────────

export interface ConversionScore {
  total: number;           // 0–100
  breakdown: {
    heroClarity: number;   // 0–20
    fabCompleteness: number; // 0–20
    ctaStrength: number;   // 0–20
    socialProof: number;   // 0–20
    urgency: number;       // 0–10
    seo: number;           // 0–10
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  suggestions: ConversionSuggestion[];
}

export interface ConversionSuggestion {
  id: string;
  area: 'hero' | 'fab' | 'cta' | 'proof' | 'urgency' | 'seo' | 'layout';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: string;
}

export interface ABTestConfig {
  id: string;
  pageId: string;
  variant: 'A' | 'B';
  changes: Record<string, string>;
  expectedLift: number;   // %
  durationDays: number;
  status: 'proposed' | 'running' | 'completed';
}

// ── Designer ───────────────────────────────────────

export class AIConversionDesigner {

  /** Score a page on conversion-readiness */
  scorePage(page: LandingPage, blueprint?: LPCopyBlueprint): ConversionScore {
    const bp = blueprint ?? fabContentEngine.generateBlueprint('default', []);
    const suggestions: ConversionSuggestion[] = [];

    // 1. Hero Clarity (0–20)
    const heroClarity = this.scoreHero(bp, suggestions);

    // 2. FAB Completeness (0–20)
    const fabCompleteness = this.scoreFAB(page, suggestions);

    // 3. CTA Strength (0–20)
    const ctaStrength = this.scoreCTA(bp, page, suggestions);

    // 4. Social Proof (0–20)
    const socialProof = this.scoreProof(bp, suggestions);

    // 5. Urgency (0–10)
    const urgency = this.scoreUrgency(bp, suggestions);

    // 6. SEO (0–10)
    const seo = this.scoreSEO(page, suggestions);

    const total = heroClarity + fabCompleteness + ctaStrength + socialProof + urgency + seo;
    const grade = total >= 90 ? 'A' : total >= 75 ? 'B' : total >= 60 ? 'C' : total >= 40 ? 'D' : 'F';

    const sorted = suggestions.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    });

    // Emit AIConversionSuggested for top suggestion
    if (sorted.length > 0) {
      const top = sorted[0];
      emitGrowthEvent({
        type: 'AIConversionSuggested',
        timestamp: Date.now(),
        pageId: page.id,
        pageTitle: page.name,
        suggestionId: top.id,
        category: top.area,
        predictedLiftPct: parseFloat(top.expectedImpact.replace(/[^0-9.]/g, '')) || 10,
        confidence: total / 100,
      });
    }

    return {
      total,
      breakdown: { heroClarity, fabCompleteness, ctaStrength, socialProof, urgency, seo },
      grade,
      suggestions: sorted,
    };
  }

  /** Generate copy variant for A/B testing */
  generateVariant(blueprint: LPCopyBlueprint, focus: 'hero' | 'cta' | 'benefits'): Partial<LPCopyBlueprint> {
    switch (focus) {
      case 'hero':
        return {
          hero: {
            ...blueprint.hero,
            headline: this.rewriteHeadline(blueprint.hero.headline),
            ctaText: this.rewriteCTA(blueprint.hero.ctaText),
          },
        };
      case 'cta':
        return {
          cta: {
            ...blueprint.cta,
            headline: this.rewriteHeadline(blueprint.cta.headline),
            ctaText: this.rewriteCTA(blueprint.cta.ctaText),
            urgency: 'Oferta válida apenas esta semana — vagas limitadas.',
          },
        };
      case 'benefits':
        return {
          benefits: blueprint.benefits.map(b => ({
            ...b,
            title: `${b.metric} ${b.title.toLowerCase()}`,
            description: `Resultado comprovado: ${b.description}`,
          })),
        };
      default:
        return {};
    }
  }

  /** Propose an A/B test configuration */
  proposeABTest(pageId: string, area: 'hero' | 'cta' | 'benefits'): ABTestConfig {
    return {
      id: `ab-${Date.now()}`,
      pageId,
      variant: 'B',
      changes: { area, strategy: 'conversion_focus' },
      expectedLift: area === 'hero' ? 15 : area === 'cta' ? 20 : 10,
      durationDays: 14,
      status: 'proposed',
    };
  }

  /** Get conversion funnel analysis */
  analyzeFunnel(pageId: string) {
    const funnel = conversionTrackingService.getConversionFunnel(pageId);
    const dropoffs: { stage: string; rate: number }[] = [];

    if (funnel.views > 0 && funnel.signups > 0) {
      dropoffs.push({ stage: 'view→signup', rate: round((1 - funnel.signups / funnel.views) * 100) });
    }
    if (funnel.signups > 0 && funnel.trials > 0) {
      dropoffs.push({ stage: 'signup→trial', rate: round((1 - funnel.trials / funnel.signups) * 100) });
    }
    if (funnel.trials > 0 && funnel.tenantsCreated > 0) {
      dropoffs.push({ stage: 'trial→tenant', rate: round((1 - funnel.tenantsCreated / funnel.trials) * 100) });
    }
    if (funnel.tenantsCreated > 0 && funnel.revenueEvents > 0) {
      dropoffs.push({ stage: 'tenant→revenue', rate: round((1 - funnel.revenueEvents / funnel.tenantsCreated) * 100) });
    }

    return {
      funnel,
      dropoffs,
      biggestDropoff: dropoffs.sort((a, b) => b.rate - a.rate)[0] ?? null,
      overallConversion: funnel.views > 0 ? round((funnel.revenueEvents / funnel.views) * 100) : 0,
    };
  }

  // ── Scoring helpers ──────────────────────

  private scoreHero(bp: LPCopyBlueprint, suggestions: ConversionSuggestion[]): number {
    let score = 0;
    if (bp.hero.headline.length >= 10) score += 8; else suggestions.push(this.suggest('hero', 'high', 'Headline muito curta', 'Headlines com 6-12 palavras convertem melhor.', '+15% atenção'));
    if (bp.hero.subheadline.length >= 20) score += 6; else suggestions.push(this.suggest('hero', 'medium', 'Subheadline insuficiente', 'Detalhe o benefício principal em 1 frase.', '+8% engajamento'));
    if (bp.hero.ctaText.length >= 5) score += 3;
    if (bp.hero.fab.benefit.length >= 10) score += 3;
    return Math.min(score, 20);
  }

  private scoreFAB(page: LandingPage, suggestions: ConversionSuggestion[]): number {
    const blocks = page.blocks;
    if (blocks.length === 0) {
      suggestions.push(this.suggest('fab', 'high', 'Sem blocos FAB', 'Adicione pelo menos 3 blocos com Feature, Advantage e Benefit.', '+25% conversão'));
      return 0;
    }
    const complete = blocks.filter(b => b.fab.feature && b.fab.advantage && b.fab.benefit).length;
    const ratio = complete / blocks.length;
    if (ratio < 0.7) suggestions.push(this.suggest('fab', 'medium', 'FAB incompleto em alguns blocos', 'Preencha todos os campos FAB para máximo impacto.', '+12% persuasão'));
    return Math.min(Math.round(ratio * 20), 20);
  }

  private scoreCTA(bp: LPCopyBlueprint, page: LandingPage, suggestions: ConversionSuggestion[]): number {
    let score = 0;
    if (bp.cta.ctaText.length >= 5) score += 8;
    if (bp.cta.urgency) score += 6; else suggestions.push(this.suggest('urgency', 'medium', 'Sem urgência no CTA', 'Adicione elemento de escassez ou prazo.', '+10% ação'));
    if (bp.cta.subheadline.length >= 10) score += 6;
    const ctaBlocks = page.blocks.filter(b => b.type === 'cta');
    if (ctaBlocks.length === 0) suggestions.push(this.suggest('cta', 'high', 'Sem bloco CTA dedicado', 'Adicione um CTA explícito ao final.', '+18% conversão'));
    return Math.min(score, 20);
  }

  private scoreProof(bp: LPCopyBlueprint, suggestions: ConversionSuggestion[]): number {
    let score = 0;
    if (bp.proof.testimonials.length >= 2) score += 8; else suggestions.push(this.suggest('proof', 'medium', 'Poucos depoimentos', 'Adicione ao menos 3 depoimentos com nome e cargo.', '+12% confiança'));
    if (bp.proof.stats.length >= 3) score += 6;
    if (bp.proof.logos.length >= 3) score += 3;
    if (bp.proof.certifications.length >= 1) score += 3;
    return Math.min(score, 20);
  }

  private scoreUrgency(bp: LPCopyBlueprint, suggestions: ConversionSuggestion[]): number {
    if (bp.cta.urgency && bp.cta.urgency.length > 5) return 10;
    suggestions.push(this.suggest('urgency', 'low', 'Sem elemento de urgência', 'Adicione prazo ou escassez ao CTA.', '+5% ação imediata'));
    return 3;
  }

  private scoreSEO(page: LandingPage, suggestions: ConversionSuggestion[]): number {
    let score = 0;
    if (page.slug && page.slug.length > 1) score += 4;
    if (page.name.length >= 5) score += 3;
    if (page.blocks.length >= 3) score += 3; else suggestions.push(this.suggest('seo', 'low', 'Conteúdo insuficiente para SEO', 'Páginas com mais seções rankeiam melhor.', '+8% tráfego orgânico'));
    return Math.min(score, 10);
  }

  private suggest(area: ConversionSuggestion['area'], priority: ConversionSuggestion['priority'], title: string, description: string, expectedImpact: string): ConversionSuggestion {
    return { id: `sug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, area, priority, title, description, expectedImpact };
  }

  // ── Copy Rewriters ──────────────────────

  private rewriteHeadline(original: string): string {
    const prefixes = ['Descubra como', 'Transforme seu', 'Acelere seu', 'Simplifique o'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const core = original.replace(/^(Gestão de|RH para|Compliance em)\s*/i, '');
    return `${prefix} ${core.charAt(0).toLowerCase()}${core.slice(1)}`;
  }

  private rewriteCTA(original: string): string {
    const variants = [
      'Começar agora — é grátis',
      'Criar conta gratuita',
      'Testar 14 dias grátis',
      'Quero experimentar',
      'Agendar demo gratuita',
    ];
    return variants.find(v => v !== original) ?? variants[0];
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export const aiConversionDesigner = new AIConversionDesigner();
