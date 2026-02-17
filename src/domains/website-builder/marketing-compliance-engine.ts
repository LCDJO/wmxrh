/**
 * MarketingComplianceEngine — Validates website/landing page content
 * against marketing best practices, legal requirements, and UX standards.
 */

// ── Types ──────────────────────────────

export type ComplianceSeverity = 'error' | 'warning' | 'info';
export type ComplianceCategory = 'fab' | 'cta' | 'content_policy' | 'tracking' | 'legal' | 'seo' | 'mobile_ux';

export interface ComplianceIssue {
  id: string;
  category: ComplianceCategory;
  severity: ComplianceSeverity;
  title: string;
  description: string;
  blockId?: string;
  suggestion?: string;
}

export interface ComplianceReport {
  score: number;
  issues: ComplianceIssue[];
  passed: boolean;
  checkedAt: string;
}

interface BlockLike {
  id: string;
  type: string;
  content: Record<string, unknown>;
}

// ── Forbidden terms ──────────────────────────────

const FORBIDDEN_TERMS = [
  'garantido', 'garantia de resultado', '100% seguro', 'sem risco',
  'lucro certo', 'dinheiro fácil', 'grátis para sempre', 'milagre',
  'comprovado cientificamente', 'número 1 do mercado',
];

// ── 1. ContentPolicyValidator ──────────────────────────────

function validateContentPolicy(blocks: BlockLike[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  let issueIdx = 0;

  for (const block of blocks) {
    const textValues = extractTextValues(block.content);
    const fullText = textValues.join(' ').toLowerCase();

    for (const term of FORBIDDEN_TERMS) {
      if (fullText.includes(term.toLowerCase())) {
        issues.push({
          id: `cp-${issueIdx++}`,
          category: 'content_policy',
          severity: 'error',
          title: 'Linguagem proibida detectada',
          description: `O termo "${term}" viola a política de conteúdo.`,
          blockId: block.id,
          suggestion: `Remova ou substitua "${term}" por uma afirmação verificável.`,
        });
      }
    }
  }

  return issues;
}

// ── 2. FABComplianceChecker ──────────────────────────────

function validateFAB(blocks: BlockLike[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const fabBlocks = blocks.filter((b) => b.type === 'fab-block');

  for (const block of fabBlocks) {
    const { feature, advantage, benefit } = block.content as Record<string, string>;

    if (!feature || feature.trim().length < 3) {
      issues.push({
        id: `fab-f-${block.id}`,
        category: 'fab',
        severity: 'error',
        title: 'Feature ausente no FAB',
        description: 'O campo Feature está vazio ou muito curto.',
        blockId: block.id,
        suggestion: 'Descreva a funcionalidade específica do produto.',
      });
    }
    if (!advantage || advantage.trim().length < 3) {
      issues.push({
        id: `fab-a-${block.id}`,
        category: 'fab',
        severity: 'error',
        title: 'Advantage ausente no FAB',
        description: 'O campo Advantage está vazio ou muito curto.',
        blockId: block.id,
        suggestion: 'Explique por que essa feature importa.',
      });
    }
    if (!benefit || benefit.trim().length < 3) {
      issues.push({
        id: `fab-b-${block.id}`,
        category: 'fab',
        severity: 'error',
        title: 'Benefit ausente no FAB',
        description: 'O campo Benefit está vazio ou muito curto.',
        blockId: block.id,
        suggestion: 'Descreva o resultado concreto para o cliente.',
      });
    }
  }

  // Check if page has at least one FAB block
  if (fabBlocks.length === 0 && blocks.length > 0) {
    issues.push({
      id: 'fab-missing',
      category: 'fab',
      severity: 'warning',
      title: 'Nenhum bloco FAB na página',
      description: 'Recomendado ter pelo menos um bloco Feature-Advantage-Benefit.',
      suggestion: 'Adicione um FAB Block para comunicar valor de forma estruturada.',
    });
  }

  return issues;
}

// ── 3. CTA Validator ──────────────────────────────

function validateCTA(blocks: BlockLike[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const ctaBlocks = blocks.filter((b) => b.type === 'cta-section' || b.type === 'hero');

  if (ctaBlocks.length === 0 && blocks.length > 0) {
    issues.push({
      id: 'cta-missing',
      category: 'cta',
      severity: 'error',
      title: 'Nenhum CTA na página',
      description: 'Toda página de conversão precisa de pelo menos um Call-to-Action.',
      suggestion: 'Adicione um Hero ou CTA Section.',
    });
  }

  for (const block of ctaBlocks) {
    const ctaText = (block.content.ctaText as string) || '';
    const ctaLink = (block.content.ctaLink as string) || '';

    if (!ctaText || ctaText.trim().length < 2) {
      issues.push({
        id: `cta-text-${block.id}`,
        category: 'cta',
        severity: 'error',
        title: 'Texto do CTA vazio',
        description: 'O botão CTA precisa de um texto claro e acionável.',
        blockId: block.id,
        suggestion: 'Use verbos de ação como "Começar agora", "Testar grátis".',
      });
    }
    if (!ctaLink || ctaLink.trim().length < 2) {
      issues.push({
        id: `cta-link-${block.id}`,
        category: 'cta',
        severity: 'error',
        title: 'Link do CTA ausente',
        description: 'O CTA não possui link de destino.',
        blockId: block.id,
        suggestion: 'Defina a URL de destino do botão.',
      });
    }
  }

  return issues;
}

// ── 4. Tracking Validator ──────────────────────────────

function validateTracking(hasGTM: boolean): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  if (!hasGTM) {
    issues.push({
      id: 'tracking-gtm',
      category: 'tracking',
      severity: 'warning',
      title: 'Google Tag Manager não configurado',
      description: 'Sem GTM, não é possível rastrear conversões e comportamento.',
      suggestion: 'Configure o GTM Container ID nas configurações da página.',
    });
  }

  return issues;
}

// ── 5. LegalDisclaimerEnforcer ──────────────────────────────

function validateLegal(blocks: BlockLike[], hasPrivacyLink: boolean, hasTermsLink: boolean): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const fullText = blocks.flatMap((b) => extractTextValues(b.content)).join(' ').toLowerCase();

  if (!hasPrivacyLink) {
    issues.push({
      id: 'legal-privacy',
      category: 'legal',
      severity: 'error',
      title: 'Link de Política de Privacidade ausente',
      description: 'LGPD exige link visível para a Política de Privacidade.',
      suggestion: 'Adicione um rodapé com link para /privacidade.',
    });
  }

  if (!hasTermsLink) {
    issues.push({
      id: 'legal-terms',
      category: 'legal',
      severity: 'warning',
      title: 'Termos de Uso não referenciados',
      description: 'Recomendado incluir link para Termos de Uso.',
      suggestion: 'Adicione link para /termos no rodapé.',
    });
  }

  // Check for price claims without disclaimer
  if (/r\$\s*\d/.test(fullText) && !fullText.includes('*valores sujeitos')) {
    issues.push({
      id: 'legal-price-disclaimer',
      category: 'legal',
      severity: 'warning',
      title: 'Preços sem disclaimer',
      description: 'Valores exibidos sem aviso de que podem sofrer alteração.',
      suggestion: 'Adicione "*Valores sujeitos a alteração" próximo à tabela de preços.',
    });
  }

  return issues;
}

// ── 6. SEOGuard ──────────────────────────────

function validateSEOGuard(blocks: BlockLike[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  // Check headlines
  const heroBlocks = blocks.filter((b) => b.type === 'hero');
  const headlines = heroBlocks.map((b) => (b.content.headline as string) || '');

  for (let i = 0; i < heroBlocks.length; i++) {
    const h = headlines[i];
    if (h.length > 0 && h.length < 10) {
      issues.push({
        id: `seo-headline-short-${i}`,
        category: 'seo',
        severity: 'warning',
        title: 'Headline muito curta',
        description: `"${h}" tem apenas ${h.length} caracteres. Recomendado: 20-60.`,
        blockId: heroBlocks[i].id,
        suggestion: 'Expanda a headline para comunicar mais valor.',
      });
    }
  }

  // Check for duplicate H1 (multiple heroes)
  if (heroBlocks.length > 1) {
    issues.push({
      id: 'seo-duplicate-h1',
      category: 'seo',
      severity: 'error',
      title: 'H1 duplicado detectado',
      description: `${heroBlocks.length} Hero Sections na página geram múltiplos H1.`,
      suggestion: 'Mantenha apenas 1 Hero Section como H1 principal.',
    });
  }

  return issues;
}

// ── 7. MobileUXValidator ──────────────────────────────

function validateMobileUX(blocks: BlockLike[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  for (const block of blocks) {
    // Check for grids with too many columns (problematic on mobile without responsive overrides)
    const cols = block.content.columns as number | undefined;
    if (cols && cols > 3) {
      issues.push({
        id: `mux-cols-${block.id}`,
        category: 'mobile_ux',
        severity: 'warning',
        title: 'Muitas colunas para mobile',
        description: `${cols} colunas podem causar overflow em telas pequenas.`,
        blockId: block.id,
        suggestion: 'Use no máximo 3 colunas ou configure override responsivo.',
      });
    }

    // Check CTA button text length (touch targets)
    const ctaText = (block.content.ctaText as string) || '';
    if (ctaText.length > 25) {
      issues.push({
        id: `mux-cta-long-${block.id}`,
        category: 'mobile_ux',
        severity: 'warning',
        title: 'Texto do CTA longo demais',
        description: `"${ctaText}" (${ctaText.length} chars) pode não caber em botões mobile.`,
        blockId: block.id,
        suggestion: 'Limite o texto do CTA a 25 caracteres.',
      });
    }

    // Check for pricing tables with many plans
    if (block.type === 'pricing-table') {
      const plans = (block.content.plans as unknown[]) || [];
      if (plans.length > 3) {
        issues.push({
          id: `mux-pricing-${block.id}`,
          category: 'mobile_ux',
          severity: 'warning',
          title: 'Muitos planos na tabela de preços',
          description: `${plans.length} planos lado a lado ficam ilegíveis no mobile.`,
          blockId: block.id,
          suggestion: 'Limite a 3 planos ou use carrossel no mobile.',
        });
      }
    }
  }

  // General spacing check — no blocks means nothing to check
  if (blocks.length > 8) {
    issues.push({
      id: 'mux-too-many-blocks',
      category: 'mobile_ux',
      severity: 'info',
      title: 'Muitas seções na página',
      description: `${blocks.length} seções podem tornar a rolagem excessiva no mobile.`,
      suggestion: 'Considere remover seções menos importantes ou usar tabs.',
    });
  }

  return issues;
}

// ── Main Engine ──────────────────────────────

export interface ComplianceOptions {
  hasGTM?: boolean;
  hasPrivacyLink?: boolean;
  hasTermsLink?: boolean;
}

export function runComplianceCheck(
  blocks: BlockLike[],
  options: ComplianceOptions = {},
): ComplianceReport {
  const allIssues: ComplianceIssue[] = [
    ...validateContentPolicy(blocks),
    ...validateFAB(blocks),
    ...validateCTA(blocks),
    ...validateTracking(options.hasGTM ?? false),
    ...validateLegal(blocks, options.hasPrivacyLink ?? false, options.hasTermsLink ?? false),
    ...validateSEOGuard(blocks),
    ...validateMobileUX(blocks),
  ];

  const errorCount = allIssues.filter((i) => i.severity === 'error').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;
  const score = Math.max(0, 100 - errorCount * 15 - warningCount * 5);

  return {
    score,
    issues: allIssues,
    passed: errorCount === 0,
    checkedAt: new Date().toISOString(),
  };
}

// ── Legal disclaimer auto-injection ──────────────────────────────

export interface LegalFooter {
  privacyUrl: string;
  termsUrl: string;
  companyName: string;
  priceDisclaimer?: boolean;
}

export function generateLegalFooterHtml(config: LegalFooter): string {
  const year = new Date().getFullYear();
  let html = `<footer style="text-align:center;padding:2rem 1rem;font-size:12px;color:#666;">`;
  html += `<p>© ${year} ${config.companyName}. Todos os direitos reservados.</p>`;
  html += `<p><a href="${config.privacyUrl}">Política de Privacidade</a> | <a href="${config.termsUrl}">Termos de Uso</a></p>`;
  if (config.priceDisclaimer) {
    html += `<p style="margin-top:0.5rem;">*Valores sujeitos a alteração sem aviso prévio.</p>`;
  }
  html += `<p style="margin-top:0.5rem;">Este site utiliza cookies conforme nossa Política de Privacidade (LGPD — Lei 13.709/2018).</p>`;
  html += `</footer>`;
  return html;
}

// ── Helpers ──────────────────────────────

function extractTextValues(obj: Record<string, unknown>): string[] {
  const texts: string[] = [];
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') texts.push(val);
    else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string') texts.push(item);
        else if (typeof item === 'object' && item) texts.push(...extractTextValues(item as Record<string, unknown>));
      }
    } else if (typeof val === 'object' && val) {
      texts.push(...extractTextValues(val as Record<string, unknown>));
    }
  }
  return texts;
}
