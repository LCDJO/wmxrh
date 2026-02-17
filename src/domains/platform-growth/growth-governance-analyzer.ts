/**
 * GrowthGovernanceAnalyzer — Detects growth anti-patterns:
 *   1. Landing pages with low conversion rate
 *   2. Poorly structured FAB content (missing feature/advantage/benefit)
 *   3. CTAs with low interaction
 *
 * Produces GovernanceFindings consumed by the Growth Insights dashboard.
 */
import type { LandingPage, FABBlock, GrowthInsight } from './types';
import { landingPageBuilder } from './landing-page-builder';
import { conversionTrackingService } from './conversion-tracking-service';

// ── Thresholds ──────────────────────────────────────────────────

const CONV_RATE_LOW = 2;          // % — below this is flagged
const CONV_RATE_CRITICAL = 0.5;   // %
const BOUNCE_HIGH = 70;           // %
const AVG_TIME_LOW = 30;          // seconds
const CTA_CLICK_MIN = 5;          // minimum expected clicks per LP

// ── Finding types ───────────────────────────────────────────────

export interface GrowthGovernanceFinding {
  id: string;
  category: 'low_conversion' | 'bad_fab' | 'low_cta' | 'high_bounce' | 'short_session';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  pageId: string;
  pageName: string;
  suggestedActions: string[];
  metrics: Record<string, number | string>;
  detectedAt: string;
}

// ── Analyzer ────────────────────────────────────────────────────

export class GrowthGovernanceAnalyzer {

  async analyze(): Promise<GrowthGovernanceFinding[]> {
    const pages = await landingPageBuilder.getAll();
    const findings: GrowthGovernanceFinding[] = [];

    for (const page of pages) {
      findings.push(...this.checkConversionRate(page));
      findings.push(...this.checkFABStructure(page));
      findings.push(...this.checkCTAInteraction(page));
      findings.push(...this.checkBounceRate(page));
      findings.push(...this.checkSessionTime(page));
    }

    return findings.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity];
    });
  }

  /** Convert findings to GrowthInsights for the unified dashboard */
  async toInsights(): Promise<GrowthInsight[]> {
    const findings = await this.analyze();
    return findings.map(f => ({
      id: f.id,
      type: 'acquisition' as const,
      title: f.title,
      description: f.description,
      impact: f.severity === 'critical' ? 'critical' : f.severity === 'warning' ? 'high' : 'medium',
      confidence: f.severity === 'critical' ? 90 : f.severity === 'warning' ? 75 : 60,
      suggestedActions: f.suggestedActions,
      metrics: Object.fromEntries(
        Object.entries(f.metrics).map(([k, v]) => [k, typeof v === 'number' ? v : 0])
      ),
      createdAt: f.detectedAt,
    }));
  }

  // ── Detectors ──────────────────────────────────────────────

  private checkConversionRate(page: LandingPage): GrowthGovernanceFinding[] {
    const rate = page.analytics.conversionRate;
    if (rate >= CONV_RATE_LOW) return [];

    const severity = rate <= CONV_RATE_CRITICAL ? 'critical' : 'warning';
    return [{
      id: `gg-conv-${page.id}`,
      category: 'low_conversion',
      severity,
      title: `LP "${page.name}" com conversão de ${rate}%`,
      description: `A página "${page.name}" tem taxa de conversão de apenas ${rate}%, abaixo do limiar de ${CONV_RATE_LOW}%. Com ${page.analytics.views} views e apenas ${page.analytics.conversions} conversões, há oportunidade significativa de otimização.`,
      pageId: page.id,
      pageName: page.name,
      suggestedActions: [
        'Revisar headline e proposta de valor do Hero',
        'Testar variações A/B do CTA principal',
        'Analisar heatmap para identificar pontos de abandono',
        'Verificar velocidade de carregamento da página',
      ],
      metrics: { conversion_rate: rate, views: page.analytics.views, conversions: page.analytics.conversions },
      detectedAt: new Date().toISOString(),
    }];
  }

  private checkFABStructure(page: LandingPage): GrowthGovernanceFinding[] {
    const findings: GrowthGovernanceFinding[] = [];

    for (const block of page.blocks) {
      const fab = block.fab;
      const missing: string[] = [];
      if (!fab.feature || fab.feature.trim().length < 3) missing.push('Feature');
      if (!fab.advantage || fab.advantage.trim().length < 3) missing.push('Advantage');
      if (!fab.benefit || fab.benefit.trim().length < 3) missing.push('Benefit');

      if (missing.length > 0) {
        findings.push({
          id: `gg-fab-${page.id}-${block.id}`,
          category: 'bad_fab',
          severity: missing.length >= 2 ? 'warning' : 'info',
          title: `FAB incompleto: bloco "${block.type}" em "${page.name}"`,
          description: `O bloco ${block.type} (seção #${block.order + 1}) está sem: ${missing.join(', ')}. Conteúdo FAB incompleto reduz a eficácia de conversão.`,
          pageId: page.id,
          pageName: page.name,
          suggestedActions: [
            ...missing.map(m => `Preencher o campo "${m}" com conteúdo persuasivo`),
            'Usar o FAB Builder para gerar conteúdo automaticamente',
          ],
          metrics: { missing_fields: missing.length, block_order: block.order },
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return findings;
  }

  private checkCTAInteraction(page: LandingPage): GrowthGovernanceFinding[] {
    const ctaBlocks = page.blocks.filter(b => b.type === 'cta');
    if (ctaBlocks.length === 0) {
      return [{
        id: `gg-nocta-${page.id}`,
        category: 'low_cta',
        severity: 'warning',
        title: `LP "${page.name}" sem bloco CTA`,
        description: `A página não possui nenhum bloco do tipo CTA. Sem call-to-action explícito, a conversão fica comprometida.`,
        pageId: page.id,
        pageName: page.name,
        suggestedActions: [
          'Adicionar bloco CTA ao final da página',
          'Considerar CTA flutuante (sticky) para mobile',
        ],
        metrics: { cta_blocks: 0 },
        detectedAt: new Date().toISOString(),
      }];
    }

    // Low conversion relative to views → CTA not compelling
    const funnel = conversionTrackingService.getConversionFunnel(page.id);
    if (page.analytics.views > 100 && funnel.signups < CTA_CLICK_MIN) {
      return [{
        id: `gg-lowcta-${page.id}`,
        category: 'low_cta',
        severity: 'warning',
        title: `CTA com baixa interação em "${page.name}"`,
        description: `Com ${page.analytics.views} views, apenas ${funnel.signups} signups foram registrados. O CTA pode não estar visível ou persuasivo o suficiente.`,
        pageId: page.id,
        pageName: page.name,
        suggestedActions: [
          'Aumentar contraste visual do botão CTA',
          'Testar copy do CTA (ex: "Comece grátis" vs "Teste 14 dias")',
          'Posicionar CTA acima do fold',
          'Adicionar urgência (ex: "Vagas limitadas")',
        ],
        metrics: { views: page.analytics.views, signups: funnel.signups },
        detectedAt: new Date().toISOString(),
      }];
    }

    return [];
  }

  private checkBounceRate(page: LandingPage): GrowthGovernanceFinding[] {
    if (page.analytics.bounceRate < BOUNCE_HIGH) return [];
    return [{
      id: `gg-bounce-${page.id}`,
      category: 'high_bounce',
      severity: page.analytics.bounceRate > 85 ? 'critical' : 'warning',
      title: `Bounce rate alto (${page.analytics.bounceRate}%) em "${page.name}"`,
      description: `A taxa de rejeição de ${page.analytics.bounceRate}% indica que visitantes saem sem interagir. Possíveis causas: carregamento lento, headline desalinhada com a expectativa do anúncio, ou layout confuso.`,
      pageId: page.id,
      pageName: page.name,
      suggestedActions: [
        'Alinhar headline da LP com o copy do anúncio/fonte',
        'Otimizar LCP (Largest Contentful Paint)',
        'Simplificar layout — menos distrações visuais',
      ],
      metrics: { bounce_rate: page.analytics.bounceRate },
      detectedAt: new Date().toISOString(),
    }];
  }

  private checkSessionTime(page: LandingPage): GrowthGovernanceFinding[] {
    if (page.analytics.avgTimeOnPage >= AVG_TIME_LOW) return [];
    return [{
      id: `gg-session-${page.id}`,
      category: 'short_session',
      severity: 'info',
      title: `Tempo médio curto (${page.analytics.avgTimeOnPage}s) em "${page.name}"`,
      description: `Visitantes passam em média apenas ${page.analytics.avgTimeOnPage}s na página, indicando que o conteúdo pode não estar engajando ou a página é muito longa.`,
      pageId: page.id,
      pageName: page.name,
      suggestedActions: [
        'Adicionar elementos interativos (calculadora, quiz)',
        'Reduzir texto e priorizar conteúdo visual',
        'Adicionar prova social (testimonials, logos)',
      ],
      metrics: { avg_time_seconds: page.analytics.avgTimeOnPage },
      detectedAt: new Date().toISOString(),
    }];
  }
}

export const growthGovernanceAnalyzer = new GrowthGovernanceAnalyzer();
