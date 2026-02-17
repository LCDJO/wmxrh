/**
 * GovernanceAIVersionAnalyzer — Analyzes content changes between landing page versions.
 *
 * Detects:
 *  - FAB drift: drastic changes in Feature-Advantage-Benefit blocks
 *  - CTA mutation: radical changes to call-to-action text, link, or removal
 *  - Layout inconsistency: block order/count/type changes that break UX continuity
 *
 * Integrates with MarketingComplianceEngine for baseline validation
 * and SmartRollbackEngine for pre-rollback risk assessment.
 */

// ── Types ──

export type GovernanceRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type GovernanceIssueType =
  | 'fab_drift'
  | 'cta_mutation'
  | 'layout_inconsistency';

export interface GovernanceVersionIssue {
  id: string;
  type: GovernanceIssueType;
  risk: GovernanceRiskLevel;
  title: string;
  description: string;
  blockId?: string;
  previousValue?: string;
  currentValue?: string;
  suggestion: string;
}

export interface GovernanceVersionReport {
  landingPageId: string;
  fromVersion: number;
  toVersion: number;
  overallRisk: GovernanceRiskLevel;
  issues: GovernanceVersionIssue[];
  score: number;
  analyzedAt: string;
}

interface BlockLike {
  id: string;
  type: string;
  content: Record<string, unknown>;
}

// ── Thresholds ──

const THRESHOLDS = {
  /** Max % of FAB text that can change before flagging drift */
  fabDriftPct: 60,
  /** Max % of CTA text change before flagging mutation */
  ctaChangePct: 50,
  /** Max allowed block count difference ratio */
  layoutBlockCountDeltaPct: 40,
  /** Max block type removals before flagging */
  layoutTypeRemovalMax: 2,
};

// ── Analyzer ──

class GovernanceAIVersionAnalyzer {
  private reports: GovernanceVersionReport[] = [];

  /**
   * Analyze content changes between two version snapshots.
   */
  analyze(
    landingPageId: string,
    fromVersion: number,
    toVersion: number,
    previousBlocks: BlockLike[],
    currentBlocks: BlockLike[],
  ): GovernanceVersionReport {
    const issues: GovernanceVersionIssue[] = [
      ...this.detectFABDrift(previousBlocks, currentBlocks),
      ...this.detectCTAMutation(previousBlocks, currentBlocks),
      ...this.detectLayoutInconsistency(previousBlocks, currentBlocks),
    ];

    const overallRisk = this.computeOverallRisk(issues);
    const score = Math.max(0, 100 - issues.filter(i => i.risk === 'critical').length * 30
      - issues.filter(i => i.risk === 'high').length * 20
      - issues.filter(i => i.risk === 'medium').length * 10
      - issues.filter(i => i.risk === 'low').length * 3);

    const report: GovernanceVersionReport = {
      landingPageId,
      fromVersion,
      toVersion,
      overallRisk,
      issues,
      score,
      analyzedAt: new Date().toISOString(),
    };

    this.reports.push(report);
    return report;
  }

  /**
   * Get reports for a landing page.
   */
  getReports(landingPageId?: string): GovernanceVersionReport[] {
    if (!landingPageId) return [...this.reports];
    return this.reports.filter(r => r.landingPageId === landingPageId);
  }

  // ── 1. FAB Drift Detection ──

  private detectFABDrift(prev: BlockLike[], curr: BlockLike[]): GovernanceVersionIssue[] {
    const issues: GovernanceVersionIssue[] = [];
    const prevFABs = prev.filter(b => b.type === 'fab-block');
    const currFABs = curr.filter(b => b.type === 'fab-block');

    // FAB blocks removed entirely
    if (prevFABs.length > 0 && currFABs.length === 0) {
      issues.push({
        id: 'gov-fab-removed',
        type: 'fab_drift',
        risk: 'critical',
        title: 'Todos os blocos FAB removidos',
        description: `Versão anterior tinha ${prevFABs.length} bloco(s) FAB. A nova versão não possui nenhum.`,
        suggestion: 'Mantenha pelo menos um bloco FAB para comunicar proposta de valor.',
      });
      return issues;
    }

    // Compare matched FAB blocks by position
    const limit = Math.min(prevFABs.length, currFABs.length);
    for (let i = 0; i < limit; i++) {
      const pContent = prevFABs[i].content;
      const cContent = currFABs[i].content;

      for (const field of ['feature', 'advantage', 'benefit'] as const) {
        const pVal = String(pContent[field] ?? '');
        const cVal = String(cContent[field] ?? '');

        if (pVal && cVal) {
          const changePct = this.textChangePct(pVal, cVal);
          if (changePct >= THRESHOLDS.fabDriftPct) {
            issues.push({
              id: `gov-fab-drift-${i}-${field}`,
              type: 'fab_drift',
              risk: changePct >= 90 ? 'high' : 'medium',
              title: `FAB Drift: ${field} alterado radicalmente`,
              description: `Campo "${field}" do bloco FAB #${i + 1} mudou ${changePct.toFixed(0)}%.`,
              blockId: currFABs[i].id,
              previousValue: pVal.slice(0, 80),
              currentValue: cVal.slice(0, 80),
              suggestion: 'Verifique se a mudança de proposta de valor foi intencional. Mudanças drásticas no FAB podem afetar conversões.',
            });
          }
        }
      }
    }

    // New FABs added (info level)
    if (currFABs.length > prevFABs.length) {
      issues.push({
        id: 'gov-fab-added',
        type: 'fab_drift',
        risk: 'low',
        title: 'Novos blocos FAB adicionados',
        description: `${currFABs.length - prevFABs.length} novo(s) bloco(s) FAB adicionado(s).`,
        suggestion: 'Revise se os novos FABs estão alinhados com a estratégia de conversão.',
      });
    }

    return issues;
  }

  // ── 2. CTA Mutation Detection ──

  private detectCTAMutation(prev: BlockLike[], curr: BlockLike[]): GovernanceVersionIssue[] {
    const issues: GovernanceVersionIssue[] = [];
    const ctaTypes = ['cta-section', 'hero'];
    const prevCTAs = prev.filter(b => ctaTypes.includes(b.type));
    const currCTAs = curr.filter(b => ctaTypes.includes(b.type));

    // All CTAs removed
    if (prevCTAs.length > 0 && currCTAs.length === 0) {
      issues.push({
        id: 'gov-cta-removed-all',
        type: 'cta_mutation',
        risk: 'critical',
        title: 'Todos os CTAs removidos',
        description: `Versão anterior tinha ${prevCTAs.length} CTA(s). A nova versão não possui nenhum.`,
        suggestion: 'Sem CTA a página não converte. Restaure pelo menos um Call-to-Action.',
      });
      return issues;
    }

    // Compare CTA text and links
    const limit = Math.min(prevCTAs.length, currCTAs.length);
    for (let i = 0; i < limit; i++) {
      const pText = String(prevCTAs[i].content.ctaText ?? '');
      const cText = String(currCTAs[i].content.ctaText ?? '');
      const pLink = String(prevCTAs[i].content.ctaLink ?? '');
      const cLink = String(currCTAs[i].content.ctaLink ?? '');

      // CTA text radical change
      if (pText && cText) {
        const changePct = this.textChangePct(pText, cText);
        if (changePct >= THRESHOLDS.ctaChangePct) {
          issues.push({
            id: `gov-cta-text-${i}`,
            type: 'cta_mutation',
            risk: 'high',
            title: 'Mudança radical no texto do CTA',
            description: `CTA #${i + 1} mudou ${changePct.toFixed(0)}%: "${pText}" → "${cText}"`,
            blockId: currCTAs[i].id,
            previousValue: pText,
            currentValue: cText,
            suggestion: 'Mudanças radicais no CTA impactam diretamente conversões. Considere um teste A/B antes.',
          });
        }
      }

      // CTA link changed entirely
      if (pLink && cLink && pLink !== cLink) {
        issues.push({
          id: `gov-cta-link-${i}`,
          type: 'cta_mutation',
          risk: 'medium',
          title: 'Link do CTA alterado',
          description: `CTA #${i + 1}: link mudou de "${pLink}" para "${cLink}"`,
          blockId: currCTAs[i].id,
          previousValue: pLink,
          currentValue: cLink,
          suggestion: 'Verifique se o novo destino está correto e com tracking configurado.',
        });
      }

      // CTA text removed
      if (pText && !cText) {
        issues.push({
          id: `gov-cta-text-empty-${i}`,
          type: 'cta_mutation',
          risk: 'critical',
          title: 'Texto do CTA removido',
          description: `CTA #${i + 1} ficou sem texto. Anteriormente: "${pText}"`,
          blockId: currCTAs[i].id,
          previousValue: pText,
          suggestion: 'Restaure o texto do CTA ou defina um novo.',
        });
      }
    }

    return issues;
  }

  // ── 3. Layout Inconsistency Detection ──

  private detectLayoutInconsistency(prev: BlockLike[], curr: BlockLike[]): GovernanceVersionIssue[] {
    const issues: GovernanceVersionIssue[] = [];

    // Block count change
    if (prev.length > 0) {
      const delta = Math.abs(curr.length - prev.length);
      const deltaPct = (delta / prev.length) * 100;

      if (deltaPct >= THRESHOLDS.layoutBlockCountDeltaPct) {
        issues.push({
          id: 'gov-layout-count',
          type: 'layout_inconsistency',
          risk: deltaPct >= 60 ? 'high' : 'medium',
          title: 'Mudança significativa na estrutura da página',
          description: `De ${prev.length} para ${curr.length} blocos (${deltaPct.toFixed(0)}% de variação).`,
          suggestion: 'Mudanças estruturais grandes podem desorientar visitantes recorrentes.',
        });
      }
    }

    // Block type removals
    const prevTypes = new Set(prev.map(b => b.type));
    const currTypes = new Set(curr.map(b => b.type));
    const removedTypes = [...prevTypes].filter(t => !currTypes.has(t));

    if (removedTypes.length >= THRESHOLDS.layoutTypeRemovalMax) {
      issues.push({
        id: 'gov-layout-types-removed',
        type: 'layout_inconsistency',
        risk: 'high',
        title: 'Tipos de bloco removidos',
        description: `Removidos: ${removedTypes.join(', ')}. Pode afetar a experiência.`,
        previousValue: [...prevTypes].join(', '),
        currentValue: [...currTypes].join(', '),
        suggestion: 'Revise se a remoção de seções foi intencional.',
      });
    }

    // Block order change (same types but different sequence)
    const prevTypeSeq = prev.map(b => b.type).join(',');
    const currTypeSeq = curr.map(b => b.type).join(',');
    if (prev.length === curr.length && prevTypeSeq !== currTypeSeq && prev.length > 2) {
      issues.push({
        id: 'gov-layout-reorder',
        type: 'layout_inconsistency',
        risk: 'low',
        title: 'Ordem dos blocos alterada',
        description: 'A sequência de seções mudou. Pode afetar o fluxo de leitura.',
        suggestion: 'Garanta que a nova ordem segue a jornada de conversão esperada.',
      });
    }

    return issues;
  }

  // ── Helpers ──

  private textChangePct(a: string, b: string): number {
    if (a === b) return 0;
    if (!a || !b) return 100;

    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const union = new Set([...wordsA, ...wordsB]);
    const intersection = [...wordsA].filter(w => wordsB.has(w));

    if (union.size === 0) return 0;
    const similarity = intersection.length / union.size;
    return (1 - similarity) * 100;
  }

  private computeOverallRisk(issues: GovernanceVersionIssue[]): GovernanceRiskLevel {
    if (issues.some(i => i.risk === 'critical')) return 'critical';
    if (issues.filter(i => i.risk === 'high').length >= 2) return 'critical';
    if (issues.some(i => i.risk === 'high')) return 'high';
    if (issues.some(i => i.risk === 'medium')) return 'medium';
    return 'low';
  }
}

export const governanceVersionAnalyzer = new GovernanceAIVersionAnalyzer();
export { GovernanceAIVersionAnalyzer };
