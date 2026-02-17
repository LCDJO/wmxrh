/**
 * MarketingComplianceBridge — Connects the MarketingComplianceEngine
 * and PrePublishGate to the MDOS layer.
 *
 * Provides a unified compliance interface for all marketing assets
 * regardless of their origin (website, landing page, campaign).
 */
import { runComplianceCheck, type ComplianceReport } from '@/domains/website-builder/marketing-compliance-engine';
import { runPrePublishGate, type PrePublishReport } from '@/domains/platform-growth/pre-publish-compliance-gate';
import { growthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
import type { LandingPage } from '@/domains/platform-growth/types';
import type { WebsiteBlock } from '@/domains/website-builder/types';

// ── Types ──────────────────────────────────────────────

export interface MDOSComplianceResult {
  assetId: string;
  assetType: 'landing_page' | 'website_page';
  passed: boolean;
  criticalCount: number;
  warningCount: number;
  conversionRiskLevel: string;
  complianceReport: ComplianceReport | null;
  prePublishReport: PrePublishReport | null;
}

// ── Bridge ─────────────────────────────────────────────

export class MarketingComplianceBridge {
  /**
   * Full compliance check for a landing page (compliance + pre-publish + conversion risk).
   */
  validateLandingPage(page: LandingPage): MDOSComplianceResult {
    const prePublish = runPrePublishGate(page);
    const risk = growthAISupportLayer.analyzeConversionRisk(page);

    return {
      assetId: page.id,
      assetType: 'landing_page',
      passed: prePublish.passed,
      criticalCount: prePublish.issues.filter(i => i.severity === 'blocking').length,
      warningCount: prePublish.issues.filter(i => i.severity === 'warning').length,
      conversionRiskLevel: risk.riskLevel,
      complianceReport: null,
      prePublishReport: prePublish,
    };
  }

  /**
   * Compliance check for website blocks.
   */
  validateWebsiteBlocks(blocks: WebsiteBlock[]): MDOSComplianceResult {
    const report = runComplianceCheck(blocks);

    return {
      assetId: 'website',
      assetType: 'website_page',
      passed: report.passed,
      criticalCount: report.issues.filter(i => i.severity === 'error').length,
      warningCount: report.issues.filter(i => i.severity === 'warning').length,
      conversionRiskLevel: report.passed ? 'low' : 'medium',
      complianceReport: report,
      prePublishReport: null,
    };
  }

  /**
   * Batch validate all landing pages.
   */
  async validateAllLandingPages(pages: LandingPage[]): Promise<MDOSComplianceResult[]> {
    return pages.map(p => this.validateLandingPage(p));
  }
}

export const marketingComplianceBridge = new MarketingComplianceBridge();
