/**
 * FunnelOrchestrator — Manages acquisition funnels end-to-end.
 *
 * Connects landing page → conversion tracking → revenue attribution
 * into a unified funnel view with stage-by-stage analytics.
 */
import { conversionTrackingService } from '@/domains/platform-growth';
import { landingPageBuilder } from '@/domains/platform-growth';
import type { LandingPage } from '@/domains/platform-growth/types';

// ── Types ──────────────────────────────────────────────

export interface FunnelStage {
  id: string;
  name: string;
  count: number;
  conversionFromPrevious: number;
}

export interface AcquisitionFunnel {
  id: string;
  name: string;
  landingPageId: string;
  stages: FunnelStage[];
  totalConversions: number;
  overallConversionRate: number;
  totalRevenue: number;
}

export interface FunnelHealth {
  funnelId: string;
  weakestStage: string;
  dropoffRate: number;
  recommendation: string;
}

// ── Orchestrator ───────────────────────────────────────

export class FunnelOrchestrator {
  buildFunnel(page: LandingPage): AcquisitionFunnel {
    const rawFunnel = conversionTrackingService.getConversionFunnel(page.id);

    const stages: FunnelStage[] = [
      { id: 'views', name: 'Page Views', count: rawFunnel.views, conversionFromPrevious: 100 },
      { id: 'signups', name: 'Signups', count: rawFunnel.signups, conversionFromPrevious: rawFunnel.views > 0 ? (rawFunnel.signups / rawFunnel.views) * 100 : 0 },
      { id: 'trials', name: 'Trials', count: rawFunnel.trials, conversionFromPrevious: rawFunnel.signups > 0 ? (rawFunnel.trials / rawFunnel.signups) * 100 : 0 },
      { id: 'tenants', name: 'Tenants', count: rawFunnel.tenantsCreated, conversionFromPrevious: rawFunnel.trials > 0 ? (rawFunnel.tenantsCreated / rawFunnel.trials) * 100 : 0 },
      { id: 'revenue', name: 'Revenue', count: rawFunnel.revenueEvents, conversionFromPrevious: rawFunnel.tenantsCreated > 0 ? (rawFunnel.revenueEvents / rawFunnel.tenantsCreated) * 100 : 0 },
    ];

    // Round percentages
    stages.forEach(s => { s.conversionFromPrevious = Math.round(s.conversionFromPrevious * 10) / 10; });

    return {
      id: `funnel-${page.id}`,
      name: `Funil: ${page.name}`,
      landingPageId: page.id,
      stages,
      totalConversions: rawFunnel.revenueEvents,
      overallConversionRate: rawFunnel.views > 0
        ? Math.round((rawFunnel.revenueEvents / rawFunnel.views) * 10000) / 100
        : 0,
      totalRevenue: rawFunnel.totalRevenue,
    };
  }

  async buildAllFunnels(): Promise<AcquisitionFunnel[]> {
    const pages = await landingPageBuilder.getAll();
    return pages.map(p => this.buildFunnel(p));
  }

  analyzeFunnelHealth(funnel: AcquisitionFunnel): FunnelHealth {
    let weakest = funnel.stages[0];
    for (const stage of funnel.stages.slice(1)) {
      if (stage.conversionFromPrevious < weakest.conversionFromPrevious) {
        weakest = stage;
      }
    }

    const recommendations: Record<string, string> = {
      'Signups': 'Otimize o CTA e headline da landing page para aumentar signups.',
      'Trials': 'Simplifique o onboarding e reduza fricção no início do trial.',
      'Tenants': 'Melhore a experiência do trial e adicione nudges de ativação.',
      'Revenue': 'Revise pricing e adicione gatilhos de urgência para conversão.',
    };

    return {
      funnelId: funnel.id,
      weakestStage: weakest.name,
      dropoffRate: 100 - weakest.conversionFromPrevious,
      recommendation: recommendations[weakest.name] ?? 'Analise os dados do funil para identificar gargalos.',
    };
  }
}

export const funnelOrchestrator = new FunnelOrchestrator();
