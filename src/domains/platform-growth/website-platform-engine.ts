/**
 * WebsitePlatformEngine — Top-level orchestrator for the AI Conversion Designer
 * and Professional Website Platform.
 *
 * Integrates:
 *  ├── SiteStructureManager      (page tree + navigation)
 *  ├── AIConversionDesigner      (scoring + A/B + funnel analysis)
 *  ├── FABContentGenerator       (= existing FABContentEngine)
 *  ├── LandingTemplateEngine     (= existing LandingPageBuilder)
 *  ├── VersioningManager         (snapshot + rollback)
 *  ├── SecurePublishService      (permission-gated publish pipeline)
 *  ├── GTMInjectionService       (= existing TagManagerIntegration)
 *  └── SEOOptimizationService    (meta tags + JSON-LD + audit)
 */
import { siteStructureManager, type SiteStructure } from './site-structure-manager';
import { aiConversionDesigner, type ConversionScore } from './ai-conversion-designer';
import { fabContentEngine } from './landing-page-builder';
import { landingPageBuilder } from './landing-page-builder';
import { versioningManager } from './versioning-manager';
import { securePublishService, type PublishResult } from './secure-publish-service';
import { tagManagerIntegration } from './tag-manager-integration';
import { seoOptimizationService, type SEOReport } from './seo-optimization-service';
import { conversionTrackingService } from './conversion-tracking-service';
import type { LandingPage, LPCopyBlueprint } from './types';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';

// ── Full Site Report ────────────────────────────────

export interface SiteHealthReport {
  siteStructure: SiteStructure;
  pages: PageHealthEntry[];
  overallScore: number;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalPages: number;
  publishedPages: number;
  totalConversions: number;
  totalRevenue: number;
}

export interface PageHealthEntry {
  page: LandingPage;
  conversionScore: ConversionScore;
  seoReport: SEOReport;
  versionCount: number;
  funnelOverview: ReturnType<typeof aiConversionDesigner.analyzeFunnel>;
}

// ── Engine ──────────────────────────────────────────

export class WebsitePlatformEngine {
  readonly site = siteStructureManager;
  readonly designer = aiConversionDesigner;
  readonly fab = fabContentEngine;
  readonly builder = landingPageBuilder;
  readonly versions = versioningManager;
  readonly publisher = securePublishService;
  readonly gtm = tagManagerIntegration;
  readonly seo = seoOptimizationService;

  // ── Quick Actions ──────────────────────────

  /** Bootstrap a complete website with default structure + LP */
  async bootstrapSite(domain: string, industry = 'default', modules: string[] = []): Promise<SiteStructure> {
    const structure = this.site.getOrCreate(domain);
    const blueprint = this.fab.generateBlueprint(industry, modules);

    // Create home LP
    const homePage = await this.builder.create({
      name: `${domain} — Home`,
      slug: 'home',
      blocks: [],
    });

    if (homePage) {
      // Link to site structure
      const homeNode = structure.pages.find(p => p.slug === '/');
      if (homeNode) homeNode.landingPageId = homePage.id;
    }

    return structure;
  }

  /** Full health report for the entire site */
  async generateSiteReport(domain: string, baseUrl: string): Promise<SiteHealthReport> {
    const structure = this.site.getOrCreate(domain);
    const allPages = await this.builder.getAll();
    const entries: PageHealthEntry[] = [];

    for (const page of allPages) {
      const blueprint = this.fab.generateBlueprint('default', []);
      entries.push({
        page,
        conversionScore: this.designer.scorePage(page, blueprint),
        seoReport: this.seo.analyze(page, blueprint, baseUrl),
        versionCount: this.versions.getVersionCount(page.id),
        funnelOverview: this.designer.analyzeFunnel(page.id),
      });
    }

    const scores = entries.map(e => e.conversionScore.total);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const grade = avg >= 90 ? 'A' : avg >= 75 ? 'B' : avg >= 60 ? 'C' : avg >= 40 ? 'D' : 'F';

    const allConversions = conversionTrackingService.getAll();

    return {
      siteStructure: structure,
      pages: entries,
      overallScore: avg,
      overallGrade: grade,
      totalPages: allPages.length,
      publishedPages: allPages.filter(p => p.status === 'published').length,
      totalConversions: allConversions.length,
      totalRevenue: allConversions.reduce((s, e) => s + (e.revenue ?? 0), 0),
    };
  }

  /** Publish with full pipeline (validation → version → permission → GTM → SEO) */
  async securePublish(
    pageId: string,
    userId: string,
    userRole: PlatformRoleType,
    options?: { changeNotes?: string; skipValidation?: boolean },
  ): Promise<PublishResult> {
    // Configure GTM if available
    const page = await this.builder.getById(pageId);
    if (page?.gtm_container_id) {
      this.gtm.configure(pageId, page.gtm_container_id);
    }

    return this.publisher.publish(pageId, userId, userRole, {
      changeNotes: options?.changeNotes,
      skipValidation: options?.skipValidation,
    });
  }

  /** Generate optimized blueprint for a page */
  generateOptimizedBlueprint(industry: string, modules: string[]): LPCopyBlueprint {
    return this.fab.generateBlueprint(industry, modules);
  }

  /** Score a page and get improvement suggestions */
  async auditPage(pageId: string, baseUrl: string): Promise<PageHealthEntry | null> {
    const page = await this.builder.getById(pageId);
    if (!page) return null;

    const blueprint = this.fab.generateBlueprint('default', []);
    return {
      page,
      conversionScore: this.designer.scorePage(page, blueprint),
      seoReport: this.seo.analyze(page, blueprint, baseUrl),
      versionCount: this.versions.getVersionCount(pageId),
      funnelOverview: this.designer.analyzeFunnel(pageId),
    };
  }
}

export const websitePlatformEngine = new WebsitePlatformEngine();
