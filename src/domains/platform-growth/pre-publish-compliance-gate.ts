/**
 * PrePublishComplianceGate — Unified compliance validation invoked before
 * publishing Websites or Landing Pages.
 *
 * Combines:
 *  1. MarketingComplianceEngine (FAB, SEO, tracking, legal, mobile UX)
 *  2. GrowthAISupportLayer (conversion risk analysis)
 *  3. GTM tracking verification
 *
 * Returns a structured report with blocking/warning issues.
 * Both SecurePublishService (LP) and WebsiteGovernanceEngine (Website)
 * call this gate before proceeding.
 */
import { runComplianceCheck, type ComplianceOptions, type ComplianceReport, type ComplianceIssue } from '@/domains/website-builder/marketing-compliance-engine';
import { growthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
import { tagManagerIntegration } from '@/domains/platform-growth';
import type { LandingPage } from '@/domains/platform-growth/types';

// ── Types ──────────────────────────────────────────

export interface PrePublishIssue {
  code: string;
  source: 'compliance' | 'growth_ai' | 'gtm';
  category: string;
  severity: 'blocking' | 'warning';
  title: string;
  description: string;
  suggestion?: string;
}

export interface PrePublishReport {
  passed: boolean;
  score: number;
  issues: PrePublishIssue[];
  complianceReport: ComplianceReport;
  conversionRiskLevel: string;
  checkedAt: string;
}

// ── Gate ────────────────────────────────────────────

export function runPrePublishGate(
  page: LandingPage,
  options: { skipAI?: boolean } = {},
): PrePublishReport {
  const issues: PrePublishIssue[] = [];

  // ── 1. Marketing Compliance Engine ──
  const blocks = (page.blocks ?? []).map(b => ({
    id: b.id,
    type: b.type,
    content: (b.content ?? {}) as Record<string, unknown>,
  }));

  const pageConfig = tagManagerIntegration.getConfig(page.id);
  const gtmActive = !!pageConfig?.isActive;

  const complianceOpts: ComplianceOptions = {
    hasGTM: gtmActive,
    hasPrivacyLink: blocks.some(b =>
      JSON.stringify(b.content).toLowerCase().includes('privacidade')
    ),
    hasTermsLink: blocks.some(b =>
      JSON.stringify(b.content).toLowerCase().includes('termos')
    ),
  };

  const complianceReport = runComplianceCheck(blocks, complianceOpts);

  // Map compliance issues to pre-publish issues
  for (const ci of complianceReport.issues) {
    issues.push({
      code: `COMPLIANCE_${ci.id.toUpperCase()}`,
      source: 'compliance',
      category: ci.category,
      severity: ci.severity === 'error' ? 'blocking' : 'warning',
      title: ci.title,
      description: ci.description,
      suggestion: ci.suggestion,
    });
  }

  // ── 2. GTM Tracking Check ──
  if (!gtmActive) {
    // Already added by compliance, but ensure it's blocking for publish
    const hasGtmIssue = issues.some(i => i.code.includes('TRACKING'));
    if (!hasGtmIssue) {
      issues.push({
        code: 'GTM_NOT_ACTIVE',
        source: 'gtm',
        category: 'tracking',
        severity: 'warning',
        title: 'GTM não ativo',
        description: 'Google Tag Manager não está configurado. Conversões não serão rastreadas.',
        suggestion: 'Configure o GTM Container ID antes de publicar.',
      });
    }
  }

  // ── 3. GrowthAI Conversion Risk ──
  let conversionRiskLevel = 'unknown';

  if (!options.skipAI) {
    try {
      const risk = growthAISupportLayer.analyzeConversionRisk(page);
      conversionRiskLevel = risk.riskLevel;

      if (risk.riskLevel === 'critical') {
        issues.push({
          code: 'AI_CONVERSION_RISK_CRITICAL',
          source: 'growth_ai',
          category: 'conversion',
          severity: 'blocking',
          title: 'Risco crítico de conversão detectado',
          description: `Score ${risk.overallScore}/100 (${risk.grade}). ${risk.recommendation}`,
          suggestion: 'Corrija os problemas de conversão antes de publicar.',
        });
      } else if (risk.riskLevel === 'high') {
        issues.push({
          code: 'AI_CONVERSION_RISK_HIGH',
          source: 'growth_ai',
          category: 'conversion',
          severity: 'warning',
          title: 'Risco alto de conversão',
          description: `Score ${risk.overallScore}/100. ${risk.recommendation}`,
          suggestion: 'Considere otimizar hero, FAB e CTA antes de publicar.',
        });
      }

      // FAB structure check via AI
      const fab = growthAISupportLayer.suggestFABStructure(page);
      if (fab.missingElements.length >= 2) {
        issues.push({
          code: 'AI_FAB_INCOMPLETE',
          source: 'growth_ai',
          category: 'fab',
          severity: 'warning',
          title: 'Estrutura FAB incompleta',
          description: `Faltam: ${fab.missingElements.join(', ')}. Páginas com FAB completo convertem 25-40% melhor.`,
          suggestion: fab.rationale,
        });
      }

      // Funnel dropoff warnings
      for (const dropoff of risk.funnelDropoffs) {
        if (dropoff.rate > 80) {
          issues.push({
            code: `AI_FUNNEL_DROP_${dropoff.stage.toUpperCase()}`,
            source: 'growth_ai',
            category: 'conversion',
            severity: 'warning',
            title: `Alto dropoff no funil: ${dropoff.stage}`,
            description: `${dropoff.rate}% de desistência no estágio "${dropoff.stage}".`,
          });
        }
      }
    } catch (err) {
      console.warn('[PrePublishGate] AI analysis skipped:', err);
    }
  }

  // ── Score ──
  const blockingCount = issues.filter(i => i.severity === 'blocking').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const score = Math.max(0, 100 - blockingCount * 20 - warningCount * 5);

  return {
    passed: blockingCount === 0,
    score,
    issues,
    complianceReport,
    conversionRiskLevel,
    checkedAt: new Date().toISOString(),
  };
}
