/**
 * MarketingHubController — Central orchestrator for the Marketing Digital OS.
 *
 * Aggregates the state of all marketing subsystems (Website, Landing Pages,
 * A/B Experiments, Campaigns) into a unified status view.
 * Acts as the single entry-point for cross-cutting marketing queries.
 */
import { landingPageBuilder } from '@/domains/platform-growth';
import { siteStructureManager } from '@/domains/platform-growth';
import { abTestingManager } from '@/domains/platform-growth';
import type { LandingPage } from '@/domains/platform-growth/types';
import type { SiteStructure, SitePage } from '@/domains/platform-growth/site-structure-manager';

// ── Types ──────────────────────────────────────────────

export interface MarketingHubStatus {
  landingPages: { total: number; published: number; drafts: number };
  website: { pages: number; published: boolean };
  experiments: { running: number; completed: number; totalVariants: number };
  campaigns: { active: number; scheduled: number };
  healthScore: number;
}

export interface MarketingAssetSummary {
  id: string;
  type: 'landing_page' | 'website_page' | 'experiment' | 'campaign';
  name: string;
  status: string;
  updatedAt: string;
}

// ── Controller ─────────────────────────────────────────

export class MarketingHubController {
  async getStatus(): Promise<MarketingHubStatus> {
    const [pages, structure, runningExps, completedExps] = await Promise.all([
      landingPageBuilder.getAll(),
      Promise.resolve(siteStructureManager.getOrCreate('app.example.com')),
      Promise.resolve(abTestingManager.listByStatus('running')),
      Promise.resolve(abTestingManager.listByStatus('completed')),
    ]);

    const published = pages.filter(p => p.status === 'published').length;
    const drafts = pages.filter(p => p.status === 'draft').length;
    const totalVariants = runningExps.reduce((s, e) => s + e.variants.length, 0);

    // Health = weighted average of key indicators
    const lpHealth = pages.length > 0 ? (published / pages.length) * 100 : 0;
    const expHealth = runningExps.length > 0 ? 80 : 50;
    const healthScore = Math.round(lpHealth * 0.5 + expHealth * 0.3 + (structure.pages.length > 0 ? 90 : 40) * 0.2);

    return {
      landingPages: { total: pages.length, published, drafts },
      website: { pages: structure.pages.length, published: structure.pages.length > 0 },
      experiments: { running: runningExps.length, completed: completedExps.length, totalVariants },
      campaigns: { active: 0, scheduled: 0 }, // Placeholder for future CampaignLifecycleManager
      healthScore,
    };
  }

  async listRecentAssets(limit = 10): Promise<MarketingAssetSummary[]> {
    const pages = await landingPageBuilder.getAll();
    const experiments = abTestingManager.listByStatus('running');

    const assets: MarketingAssetSummary[] = [
      ...pages.map(p => ({
        id: p.id,
        type: 'landing_page' as const,
        name: p.name,
        status: p.status,
        updatedAt: p.updated_at ?? p.created_at ?? new Date().toISOString(),
      })),
      ...experiments.map(e => ({
        id: e.id,
        type: 'experiment' as const,
        name: e.name,
        status: e.status,
        updatedAt: e.startedAt ?? new Date().toISOString(),
      })),
    ];

    return assets
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }
}

export const marketingHubController = new MarketingHubController();
