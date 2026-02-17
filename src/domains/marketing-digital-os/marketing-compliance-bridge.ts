/**
 * MarketingComplianceBridge — Connects the MarketingComplianceEngine
 * and PrePublishGate to the MDOS layer.
 *
 * Provides a unified compliance interface for all marketing assets
 * with explicit per-pillar breakdown:
 *
 *  1. FAB   — Feature-Advantage-Benefit structure validation
 *  2. SEO   — Headlines, H1, meta, alt attributes
 *  3. GTM   — Google Tag Manager / tracking setup
 *  4. Mobile — Responsive layout, touch targets, spacing
 */
import { runComplianceCheck, type ComplianceReport } from '@/domains/website-builder/marketing-compliance-engine';
import { runPrePublishGate, type PrePublishReport, type PrePublishIssue } from '@/domains/platform-growth/pre-publish-compliance-gate';
import { growthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
import type { LandingPage } from '@/domains/platform-growth/types';
import type { WebsiteBlock } from '@/domains/website-builder/types';

// ── Types ──────────────────────────────────────────────

export type CompliancePillar = 'fab' | 'seo' | 'gtm' | 'mobile';

export interface PillarResult {
  pillar: CompliancePillar;
  label: string;
  passed: boolean;
  score: number; // 0-100
  issues: PrePublishIssue[];
}

export interface MDOSComplianceResult {
  assetId: string;
  assetType: 'landing_page' | 'website_page';
  passed: boolean;
  overallScore: number;
  criticalCount: number;
  warningCount: number;
  conversionRiskLevel: string;
  pillars: PillarResult[];
  complianceReport: ComplianceReport | null;
  prePublishReport: PrePublishReport | null;
}

// ── Helpers ────────────────────────────────────────────

const PILLAR_CATEGORIES: Record<CompliancePillar, string[]> = {
  fab: ['fab', 'content'],
  seo: ['seo', 'headline'],
  gtm: ['tracking', 'gtm'],
  mobile: ['mobile', 'responsive', 'ux'],
};

const PILLAR_LABELS: Record<CompliancePillar, string> = {
  fab: 'Estrutura FAB',
  seo: 'SEO',
  gtm: 'Tracking (GTM)',
  mobile: 'Responsividade Mobile',
};

function categorizePillar(issue: PrePublishIssue): CompliancePillar {
  const cat = issue.category.toLowerCase();
  const code = issue.code.toLowerCase();
  for (const [pillar, keywords] of Object.entries(PILLAR_CATEGORIES)) {
    if (keywords.some(k => cat.includes(k) || code.includes(k))) {
      return pillar as CompliancePillar;
    }
  }
  // Conversion-related issues map to FAB by default
  if (cat === 'conversion') return 'fab';
  return 'seo'; // fallback
}

function buildPillars(issues: PrePublishIssue[]): PillarResult[] {
  const pillars: CompliancePillar[] = ['fab', 'seo', 'gtm', 'mobile'];

  return pillars.map(pillar => {
    const pillarIssues = issues.filter(i => categorizePillar(i) === pillar);
    const blocking = pillarIssues.filter(i => i.severity === 'blocking').length;
    const warnings = pillarIssues.filter(i => i.severity === 'warning').length;
    const score = Math.max(0, 100 - blocking * 25 - warnings * 10);

    return {
      pillar,
      label: PILLAR_LABELS[pillar],
      passed: blocking === 0,
      score,
      issues: pillarIssues,
    };
  });
}

// ── Bridge ─────────────────────────────────────────────

export class MarketingComplianceBridge {
  /**
   * Full compliance check for a landing page with per-pillar breakdown.
   */
  validateLandingPage(page: LandingPage): MDOSComplianceResult {
    const prePublish = runPrePublishGate(page);
    const risk = growthAISupportLayer.analyzeConversionRisk(page);
    const pillars = buildPillars(prePublish.issues);

    const criticalCount = prePublish.issues.filter(i => i.severity === 'blocking').length;
    const warningCount = prePublish.issues.filter(i => i.severity === 'warning').length;

    return {
      assetId: page.id,
      assetType: 'landing_page',
      passed: prePublish.passed,
      overallScore: prePublish.score,
      criticalCount,
      warningCount,
      conversionRiskLevel: risk.riskLevel,
      pillars,
      complianceReport: null,
      prePublishReport: prePublish,
    };
  }

  /**
   * Compliance check for website blocks with per-pillar breakdown.
   */
  validateWebsiteBlocks(blocks: WebsiteBlock[]): MDOSComplianceResult {
    const report = runComplianceCheck(blocks);

    // Map compliance issues to PrePublishIssue format for pillar categorization
    const mapped: PrePublishIssue[] = report.issues.map(ci => ({
      code: `COMPLIANCE_${ci.id.toUpperCase()}`,
      source: 'compliance' as const,
      category: ci.category,
      severity: ci.severity === 'error' ? 'blocking' as const : 'warning' as const,
      title: ci.title,
      description: ci.description,
      suggestion: ci.suggestion,
    }));

    const pillars = buildPillars(mapped);
    const criticalCount = mapped.filter(i => i.severity === 'blocking').length;
    const warningCount = mapped.filter(i => i.severity === 'warning').length;

    return {
      assetId: 'website',
      assetType: 'website_page',
      passed: report.passed,
      overallScore: Math.max(0, 100 - criticalCount * 25 - warningCount * 10),
      criticalCount,
      warningCount,
      conversionRiskLevel: report.passed ? 'low' : 'medium',
      pillars,
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
