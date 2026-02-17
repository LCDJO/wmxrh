/**
 * FunnelOrchestrator — Manages acquisition funnels end-to-end.
 *
 * MarketingFunnel concept:
 *   Website → Landing → Signup → Billing → Referral
 *
 * Each funnel links an entry point (website or landing page) to a target plan,
 * optional referral program, and active A/B experiments — then tracks the
 * full conversion pipeline with stage-by-stage analytics.
 */
import { conversionTrackingService } from '@/domains/platform-growth';
import { landingPageBuilder } from '@/domains/platform-growth';
import { abTestingManager } from '@/domains/platform-growth';
import type { LandingPage } from '@/domains/platform-growth/types';

// ── Types ──────────────────────────────────────────────

export type FunnelEntryPoint = 'website' | 'landing';

export interface MarketingFunnel {
  id: string;
  name: string;
  entryPoint: FunnelEntryPoint;
  /** Landing page that serves as the funnel entry */
  landingPageId: string;
  /** Target SaaS plan this funnel drives toward */
  targetPlan: string | null;
  /** Linked referral program for post-conversion attribution */
  referralProgramId: string | null;
  /** Active A/B experiment IDs running on this funnel */
  activeExperiments: string[];
  /** Funnel flow stages with live metrics */
  stages: FunnelStage[];
  /** Aggregate KPIs */
  totalConversions: number;
  overallConversionRate: number;
  totalRevenue: number;
  createdAt: string;
}

export interface FunnelStage {
  id: string;
  name: string;
  count: number;
  conversionFromPrevious: number;
}

export interface FunnelHealth {
  funnelId: string;
  weakestStage: string;
  dropoffRate: number;
  recommendation: string;
}

// ── Canonical flow stages ──────────────────────────────

const FLOW_STAGES = ['Website', 'Landing', 'Signup', 'Billing', 'Referral'] as const;

// ── Orchestrator ───────────────────────────────────────

export class FunnelOrchestrator {
  /**
   * Build a full MarketingFunnel from a LandingPage,
   * resolving linked experiments, target plan, and referral program.
   */
  buildFunnel(page: LandingPage): MarketingFunnel {
    const rawFunnel = conversionTrackingService.getConversionFunnel(page.id);

    // Resolve active experiments linked to this page
    const runningExps = abTestingManager.listByStatus('running');
    const linkedExps = runningExps
      .filter(e => e.landingPageId === page.id)
      .map(e => e.id);

    // Determine entry point: if page came from website structure, it's 'website'
    const entryPoint: FunnelEntryPoint = page.slug?.startsWith('home') || page.slug?.startsWith('solucoes')
      ? 'website'
      : 'landing';

    // Build the canonical 5-stage flow: Website → Landing → Signup → Billing → Referral
    const stages: FunnelStage[] = [
      {
        id: 'website',
        name: 'Website',
        count: rawFunnel.views,
        conversionFromPrevious: 100,
      },
      {
        id: 'landing',
        name: 'Landing',
        count: Math.round(rawFunnel.views * (1 - (page.analytics.bounceRate / 100))),
        conversionFromPrevious: 100 - page.analytics.bounceRate,
      },
      {
        id: 'signup',
        name: 'Signup',
        count: rawFunnel.signups,
        conversionFromPrevious: rawFunnel.views > 0
          ? (rawFunnel.signups / rawFunnel.views) * 100
          : 0,
      },
      {
        id: 'billing',
        name: 'Billing',
        count: rawFunnel.revenueEvents,
        conversionFromPrevious: rawFunnel.signups > 0
          ? (rawFunnel.revenueEvents / rawFunnel.signups) * 100
          : 0,
      },
      {
        id: 'referral',
        name: 'Referral',
        count: rawFunnel.referralClicks,
        conversionFromPrevious: rawFunnel.revenueEvents > 0
          ? (rawFunnel.referralClicks / rawFunnel.revenueEvents) * 100
          : 0,
      },
    ];

    // Round percentages
    stages.forEach(s => {
      s.conversionFromPrevious = Math.round(s.conversionFromPrevious * 10) / 10;
    });

    return {
      id: `funnel-${page.id}`,
      name: `Funil: ${page.name}`,
      entryPoint,
      landingPageId: page.id,
      targetPlan: page.target_plan_id ?? null,
      referralProgramId: page.referral_program_id ?? null,
      activeExperiments: linkedExps,
      stages,
      totalConversions: rawFunnel.revenueEvents,
      overallConversionRate: rawFunnel.views > 0
        ? Math.round((rawFunnel.revenueEvents / rawFunnel.views) * 10000) / 100
        : 0,
      totalRevenue: rawFunnel.totalRevenue,
      createdAt: page.created_at ?? new Date().toISOString(),
    };
  }

  async buildAllFunnels(): Promise<MarketingFunnel[]> {
    const pages = await landingPageBuilder.getAll();
    return pages.map(p => this.buildFunnel(p));
  }

  analyzeFunnelHealth(funnel: MarketingFunnel): FunnelHealth {
    // Find weakest stage (skip first which is always 100%)
    let weakest = funnel.stages[1];
    for (const stage of funnel.stages.slice(2)) {
      if (stage.conversionFromPrevious < weakest.conversionFromPrevious) {
        weakest = stage;
      }
    }

    const recommendations: Record<string, string> = {
      'Landing': 'Reduza o bounce rate otimizando o hero e a velocidade de carregamento.',
      'Signup': 'Otimize o CTA e headline da landing page para aumentar signups.',
      'Billing': 'Revise pricing, adicione gatilhos de urgência e simplifique o checkout.',
      'Referral': 'Incentive indicações com recompensas pós-compra e prompts de compartilhamento.',
    };

    return {
      funnelId: funnel.id,
      weakestStage: weakest.name,
      dropoffRate: Math.round((100 - weakest.conversionFromPrevious) * 10) / 10,
      recommendation: recommendations[weakest.name] ?? 'Analise os dados do funil para identificar gargalos.',
    };
  }

  /**
   * Get the canonical flow definition.
   */
  getFlowDefinition() {
    return FLOW_STAGES.map((name, i) => ({
      order: i,
      stage: name,
      description: {
        Website: 'Tráfego orgânico e pago chegando ao site institucional',
        Landing: 'Visitantes engajados que não saíram (bounce)',
        Signup: 'Cadastros/trials iniciados',
        Billing: 'Receita gerada (plano selecionado e pago)',
        Referral: 'Indicações feitas por clientes convertidos',
      }[name],
    }));
  }
}

export const funnelOrchestrator = new FunnelOrchestrator();
