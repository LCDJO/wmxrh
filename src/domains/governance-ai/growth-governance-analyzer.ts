/**
 * GrowthGovernanceAnalyzer — Governance AI for Growth domain.
 *
 * Detects:
 *  1. A/B tests with low statistical significance (running too long, insufficient sample)
 *  2. Landing pages with revenue loss (declining RPV, high bounce, negative conversion trend)
 *
 * Produces GovernanceInsight[] consumed by the GovernanceAI dashboard.
 */
import type { GovernanceInsight, InsightSeverity } from './types';
import { abTestingManager } from '@/domains/platform-growth/autonomous-marketing/ab-testing-manager';
import { supabase } from '@/integrations/supabase/client';

// ── Low-Significance A/B Test Detection ─────────────────────────

function detectLowSignificanceTests(): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];
  const running = abTestingManager.listByStatus('running');

  for (const exp of running) {
    const daysSinceStart = exp.startedAt
      ? (Date.now() - new Date(exp.startedAt).getTime()) / 86400000
      : 0;

    const totalImpressions = exp.variants.reduce((s, v) => s + v.metrics.impressions, 0);
    const hasEnoughSample = totalImpressions >= exp.minSampleSize;
    const anySignificant = exp.variants.some(
      v => !v.isControl && (v.metrics.confidenceVsControl ?? 0) >= exp.confidenceLevel,
    );

    // Case 1: Running > 14 days with insufficient sample
    if (daysSinceStart > 14 && !hasEnoughSample) {
      const severity: InsightSeverity = daysSinceStart > 30 ? 'critical' : 'warning';
      insights.push({
        id: `growth-lowsig-sample-${exp.id}`,
        category: 'plan_waste',
        severity,
        title: `A/B Test "${exp.name}" com amostra insuficiente`,
        description: `Experimento rodando há ${Math.round(daysSinceStart)} dias com apenas ${totalImpressions} impressões (mínimo: ${exp.minSampleSize}). Tráfego insuficiente para atingir significância estatística.`,
        affected_entities: [{
          type: 'tenant',
          id: exp.landingPageId,
          label: `Experimento: ${exp.name}`,
          domain: 'growth',
        }],
        recommendation: daysSinceStart > 30
          ? 'Encerrar o experimento como inconclusivo ou aumentar o tráfego alocado significativamente.'
          : 'Considerar aumentar a porcentagem de tráfego alocado ao experimento ou simplificar as variantes.',
        auto_remediable: false,
        confidence: Math.min(95, 60 + daysSinceStart),
        detected_at: Date.now(),
        source: 'heuristic',
        metadata: {
          experiment_id: exp.id,
          days_running: Math.round(daysSinceStart),
          total_impressions: totalImpressions,
          min_sample_size: exp.minSampleSize,
          variant_count: exp.variants.length,
        },
      });
    }

    // Case 2: Running > 21 days with sample but no significance
    if (daysSinceStart > 21 && hasEnoughSample && !anySignificant) {
      insights.push({
        id: `growth-lowsig-nosig-${exp.id}`,
        category: 'plan_waste',
        severity: daysSinceStart > 45 ? 'critical' : 'warning',
        title: `A/B Test "${exp.name}" sem significância após ${Math.round(daysSinceStart)} dias`,
        description: `O experimento tem ${totalImpressions} impressões mas nenhuma variante atingiu ${exp.confidenceLevel}% de confiança. As variantes provavelmente são muito similares.`,
        affected_entities: [{
          type: 'tenant',
          id: exp.landingPageId,
          label: `Experimento: ${exp.name}`,
          domain: 'growth',
        }],
        recommendation: 'Encerrar o teste e criar variantes com diferenças mais agressivas (headlines, layout, oferta).',
        auto_remediable: false,
        confidence: 80,
        detected_at: Date.now(),
        source: 'heuristic',
        metadata: {
          experiment_id: exp.id,
          days_running: Math.round(daysSinceStart),
          total_impressions: totalImpressions,
          confidence_target: exp.confidenceLevel,
          variant_confidences: exp.variants
            .filter(v => !v.isControl)
            .map(v => ({ name: v.name, confidence: v.metrics.confidenceVsControl })),
        },
      });
    }

    // Case 3: Variant performing significantly worse (negative lift > 15%)
    const control = exp.variants.find(v => v.isControl);
    if (control && control.metrics.conversionRate > 0) {
      for (const v of exp.variants.filter(v => !v.isControl)) {
        const lift = ((v.metrics.conversionRate - control.metrics.conversionRate) / control.metrics.conversionRate) * 100;
        if (lift < -15 && v.metrics.impressions >= 50) {
          insights.push({
            id: `growth-lowsig-negative-${exp.id}-${v.id}`,
            category: 'plan_waste',
            severity: 'warning',
            title: `Variante "${v.name}" com lift negativo de ${Math.round(lift)}%`,
            description: `No experimento "${exp.name}", a variante "${v.name}" está performando ${Math.abs(Math.round(lift))}% pior que o controle. Tráfego está sendo desperdiçado.`,
            affected_entities: [
              { type: 'tenant', id: exp.id, label: `Experimento: ${exp.name}`, domain: 'growth' },
              { type: 'tenant', id: v.id, label: `Variante: ${v.name}`, domain: 'growth' },
            ],
            recommendation: 'Remover esta variante do experimento para redistribuir tráfego para variantes mais promissoras.',
            auto_remediable: false,
            confidence: Math.min(90, 60 + v.metrics.impressions / 10),
            detected_at: Date.now(),
            source: 'heuristic',
            metadata: {
              experiment_id: exp.id,
              variant_id: v.id,
              control_conversion: control.metrics.conversionRate,
              variant_conversion: v.metrics.conversionRate,
              lift_pct: Math.round(lift * 10) / 10,
              impressions: v.metrics.impressions,
            },
          });
        }
      }
    }
  }

  return insights;
}

// ── Landing Page Revenue Loss Detection ─────────────────────────

async function detectRevenueLossPages(): Promise<GovernanceInsight[]> {
  const insights: GovernanceInsight[] = [];

  // Fetch landing metric events for last 60 days (two 30-day windows)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: events } = await supabase
    .from('landing_metric_events')
    .select('landing_page_id, event_type, revenue_generated, created_at')
    .gte('created_at', sixtyDaysAgo)
    .order('created_at', { ascending: true });

  if (!events || events.length === 0) return insights;

  // Fetch page names
  const pageIds = [...new Set(events.map(e => e.landing_page_id))];
  const { data: pages } = await supabase
    .from('landing_pages')
    .select('id, name')
    .in('id', pageIds);

  const pageNameMap = new Map((pages ?? []).map(p => [p.id, p.name]));

  // Group events by page and period
  for (const pageId of pageIds) {
    const pageEvents = events.filter(e => e.landing_page_id === pageId);
    const pageName = pageNameMap.get(pageId) ?? pageId;

    const prev = pageEvents.filter(e => e.created_at < thirtyDaysAgo);
    const curr = pageEvents.filter(e => e.created_at >= thirtyDaysAgo);

    // Revenue comparison
    const prevRevenue = prev
      .filter(e => e.event_type === 'revenue_generated')
      .reduce((s, e) => s + Number(e.revenue_generated ?? 0), 0);
    const currRevenue = curr
      .filter(e => e.event_type === 'revenue_generated')
      .reduce((s, e) => s + Number(e.revenue_generated ?? 0), 0);

    // Views comparison
    const prevViews = prev.filter(e => e.event_type === 'page_view').length;
    const currViews = curr.filter(e => e.event_type === 'page_view').length;

    // Conversion comparison
    const prevConversions = prev.filter(e => e.event_type === 'signup_completed').length;
    const currConversions = curr.filter(e => e.event_type === 'signup_completed').length;

    const prevRPV = prevViews > 0 ? prevRevenue / prevViews : 0;
    const currRPV = currViews > 0 ? currRevenue / currViews : 0;
    const prevConvRate = prevViews > 0 ? (prevConversions / prevViews) * 100 : 0;
    const currConvRate = currViews > 0 ? (currConversions / currViews) * 100 : 0;

    // Revenue decline detection (>20% drop with meaningful volume)
    if (prevRevenue > 0 && currRevenue < prevRevenue * 0.8 && prevViews >= 20) {
      const dropPct = Math.round(((prevRevenue - currRevenue) / prevRevenue) * 100);
      const lostBrl = Math.round((prevRevenue - currRevenue) * 100) / 100;

      insights.push({
        id: `growth-revloss-${pageId}`,
        category: 'plan_waste',
        severity: dropPct > 50 ? 'critical' : 'warning',
        title: `Landing "${pageName}" com queda de ${dropPct}% na receita`,
        description: `Receita caiu de R$ ${prevRevenue.toFixed(2)} para R$ ${currRevenue.toFixed(2)} nos últimos 30 dias (perda de R$ ${lostBrl.toFixed(2)}). RPV caiu de R$ ${prevRPV.toFixed(2)} para R$ ${currRPV.toFixed(2)}.`,
        affected_entities: [{
          type: 'tenant',
          id: pageId,
          label: `Landing Page: ${pageName}`,
          domain: 'growth',
        }],
        recommendation: dropPct > 50
          ? 'Investigar urgentemente: verificar se houve alteração no conteúdo, queda de tráfego, ou problema técnico. Considerar rollback para versão anterior.'
          : 'Analisar funil de conversão e iniciar A/B test para recuperar performance.',
        auto_remediable: false,
        confidence: Math.min(95, 60 + Math.min(prevViews, 100) * 0.3),
        detected_at: Date.now(),
        source: 'heuristic',
        metadata: {
          page_id: pageId,
          prev_revenue: prevRevenue,
          curr_revenue: currRevenue,
          revenue_drop_pct: dropPct,
          lost_brl: lostBrl,
          prev_rpv: Math.round(prevRPV * 100) / 100,
          curr_rpv: Math.round(currRPV * 100) / 100,
          prev_views: prevViews,
          curr_views: currViews,
          prev_conv_rate: Math.round(prevConvRate * 10) / 10,
          curr_conv_rate: Math.round(currConvRate * 10) / 10,
        },
      });
    }

    // Conversion rate decline (>30% drop)
    if (prevConvRate > 0 && currConvRate < prevConvRate * 0.7 && prevViews >= 30 && currViews >= 10) {
      const convDropPct = Math.round(((prevConvRate - currConvRate) / prevConvRate) * 100);

      // Avoid duplicate if already caught by revenue loss
      const hasRevLoss = insights.some(i => i.id === `growth-revloss-${pageId}`);
      if (!hasRevLoss) {
        insights.push({
          id: `growth-convdrop-${pageId}`,
          category: 'plan_waste',
          severity: 'warning',
          title: `Landing "${pageName}" com queda de ${convDropPct}% na conversão`,
          description: `Taxa de conversão caiu de ${prevConvRate.toFixed(1)}% para ${currConvRate.toFixed(1)}% nos últimos 30 dias. Pode indicar degradação de UX ou mudança no perfil de tráfego.`,
          affected_entities: [{
            type: 'tenant',
            id: pageId,
            label: `Landing Page: ${pageName}`,
            domain: 'growth',
          }],
          recommendation: 'Verificar alterações recentes na página e analisar fontes de tráfego. Considerar A/B test para otimização.',
          auto_remediable: false,
          confidence: 70,
          detected_at: Date.now(),
          source: 'heuristic',
          metadata: {
            page_id: pageId,
            prev_conv_rate: Math.round(prevConvRate * 10) / 10,
            curr_conv_rate: Math.round(currConvRate * 10) / 10,
            conv_drop_pct: convDropPct,
            prev_views: prevViews,
            curr_views: currViews,
          },
        });
      }
    }
  }

  return insights;
}

// ── Public API ──────────────────────────────────────────────────

/** Run full growth governance scan (sync A/B + async landing pages) */
export async function runGrowthGovernanceScan(): Promise<GovernanceInsight[]> {
  const [abInsights, revenueInsights] = await Promise.all([
    Promise.resolve(detectLowSignificanceTests()),
    detectRevenueLossPages(),
  ]);

  return [...abInsights, ...revenueInsights].sort((a, b) => {
    const order: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

/** Run only A/B test governance (sync, no DB calls) */
export function scanABTestGovernance(): GovernanceInsight[] {
  return detectLowSignificanceTests();
}

/** Run only landing page revenue loss detection (async) */
export async function scanLandingRevenueLoss(): Promise<GovernanceInsight[]> {
  return detectRevenueLossPages();
}
