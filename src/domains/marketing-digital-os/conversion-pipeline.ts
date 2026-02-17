/**
 * ConversionPipeline — End-to-end conversion flow manager.
 *
 * Connects traffic sources → landing pages → conversion tracking → revenue
 * into a single pipeline with stage-level visibility and AI scoring.
 */
import { conversionTrackingService } from '@/domains/platform-growth';
import { conversionPredictionService } from '@/domains/platform-growth';
import { growthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
import { landingPageBuilder } from '@/domains/platform-growth';
import type { LandingPage } from '@/domains/platform-growth/types';

// ── Types ──────────────────────────────────────────────

export interface PipelineStageMetrics {
  stage: string;
  volume: number;
  conversionRate: number;
  avgTimeInStage: number; // seconds
}

export interface ConversionPipelineSnapshot {
  landingPageId: string;
  pageName: string;
  stages: PipelineStageMetrics[];
  aiScore: number;
  riskLevel: string;
  predictedRevenue: number;
  topSource: string;
}

// ── Pipeline ───────────────────────────────────────────

export class ConversionPipeline {
  async getSnapshot(page: LandingPage): Promise<ConversionPipelineSnapshot> {
    const funnel = conversionTrackingService.getConversionFunnel(page.id);
    const risk = growthAISupportLayer.analyzeConversionRisk(page);
    const predictions = conversionPredictionService.getBatchPredictions();

    const topSource = page.analytics.topSources.length > 0
      ? page.analytics.topSources.reduce((a, b) => a.visits > b.visits ? a : b).source
      : 'direct';

    const matchingPrediction = predictions.find(p => p.source === topSource);
    const predictedRevenue = matchingPrediction ? matchingPrediction.score * funnel.totalRevenue * 0.01 : funnel.totalRevenue;

    const stages: PipelineStageMetrics[] = [
      { stage: 'Tráfego', volume: funnel.views, conversionRate: 100, avgTimeInStage: 0 },
      { stage: 'Engajamento', volume: Math.round(funnel.views * (1 - page.analytics.bounceRate / 100)), conversionRate: 100 - page.analytics.bounceRate, avgTimeInStage: page.analytics.avgTimeOnPage },
      { stage: 'Signup', volume: funnel.signups, conversionRate: funnel.views > 0 ? (funnel.signups / funnel.views) * 100 : 0, avgTimeInStage: 120 },
      { stage: 'Trial', volume: funnel.trials, conversionRate: funnel.signups > 0 ? (funnel.trials / funnel.signups) * 100 : 0, avgTimeInStage: 300 },
      { stage: 'Conversão', volume: funnel.revenueEvents, conversionRate: funnel.trials > 0 ? (funnel.revenueEvents / funnel.trials) * 100 : 0, avgTimeInStage: 600 },
    ];

    stages.forEach(s => { s.conversionRate = Math.round(s.conversionRate * 10) / 10; });

    return {
      landingPageId: page.id,
      pageName: page.name,
      stages,
      aiScore: risk.overallScore,
      riskLevel: risk.riskLevel,
      predictedRevenue: Math.round(predictedRevenue),
      topSource,
    };
  }

  async getAllSnapshots(): Promise<ConversionPipelineSnapshot[]> {
    const pages = await landingPageBuilder.getAll();
    return Promise.all(pages.map(p => this.getSnapshot(p)));
  }
}

export const conversionPipeline = new ConversionPipeline();
