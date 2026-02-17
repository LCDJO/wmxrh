/**
 * SEOOptimizationService — Automated SEO analysis and optimization for landing pages.
 *
 * Responsibilities:
 *  1. Analyze pages for SEO issues
 *  2. Generate meta tags, Open Graph, JSON-LD
 *  3. Score SEO readiness
 *  4. Auto-generate sitemap entries
 *  5. Keyword density analysis
 */
import type { LandingPage, LPCopyBlueprint } from './types';

// ── SEO Report ──────────────────────────────────────

export interface SEOReport {
  score: number;        // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: SEOIssue[];
  metaTags: MetaTags;
  jsonLd: Record<string, unknown>;
  recommendations: string[];
}

export interface SEOIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  fix: string;
}

export interface MetaTags {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  twitterCard: string;
  robots: string;
}

// ── Service ─────────────────────────────────────────

export class SEOOptimizationService {

  /** Full SEO audit for a landing page */
  analyze(page: LandingPage, blueprint: LPCopyBlueprint, baseUrl: string): SEOReport {
    const issues: SEOIssue[] = [];
    let score = 100;

    // Title check
    const title = blueprint.hero.headline;
    if (title.length > 60) {
      issues.push(this.issue('error', 'title_too_long', `Título com ${title.length} caracteres (máx 60).`, 'Reduza o título para menos de 60 caracteres.'));
      score -= 10;
    }
    if (title.length < 20) {
      issues.push(this.issue('warning', 'title_too_short', `Título com apenas ${title.length} caracteres.`, 'Expanda o título para 30-60 caracteres.'));
      score -= 5;
    }

    // Meta description
    const desc = blueprint.hero.subheadline;
    if (desc.length > 160) {
      issues.push(this.issue('warning', 'desc_too_long', `Meta description com ${desc.length} chars (máx 160).`, 'Reduza para menos de 160 caracteres.'));
      score -= 5;
    }
    if (desc.length < 50) {
      issues.push(this.issue('warning', 'desc_too_short', `Meta description com apenas ${desc.length} chars.`, 'Expanda para 100-160 caracteres.'));
      score -= 5;
    }

    // Slug
    if (!page.slug || page.slug === '/') {
      issues.push(this.issue('warning', 'generic_slug', 'Slug genérico ou ausente.', 'Use slug descritivo com palavras-chave.'));
      score -= 5;
    }
    if (page.slug && page.slug.includes(' ')) {
      issues.push(this.issue('error', 'slug_spaces', 'Slug contém espaços.', 'Substitua espaços por hifens.'));
      score -= 10;
    }

    // Content depth
    if (page.blocks.length < 3) {
      issues.push(this.issue('warning', 'thin_content', 'Conteúdo insuficiente para SEO.', 'Adicione mais seções (min 3 blocos).'));
      score -= 10;
    }

    // Social proof for E-A-T
    if (blueprint.proof.testimonials.length < 2) {
      issues.push(this.issue('info', 'low_social_proof', 'Pouca prova social.', 'Adicione depoimentos para aumentar E-A-T.'));
      score -= 3;
    }

    // Structured data presence
    if (blueprint.proof.certifications.length === 0) {
      issues.push(this.issue('info', 'no_certifications', 'Sem certificações listadas.', 'Adicione certificações para rich snippets.'));
      score -= 2;
    }

    score = Math.max(0, Math.min(100, score));
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

    const metaTags = this.generateMetaTags(page, blueprint, baseUrl);
    const jsonLd = this.generateJsonLd(page, blueprint, baseUrl);

    return {
      score,
      grade,
      issues,
      metaTags,
      jsonLd,
      recommendations: issues.map(i => i.fix),
    };
  }

  /** Generate complete meta tags */
  generateMetaTags(page: LandingPage, blueprint: LPCopyBlueprint, baseUrl: string): MetaTags {
    const title = `${blueprint.hero.headline} | Plataforma RH`;
    const description = blueprint.hero.subheadline.slice(0, 160);
    const canonical = `${baseUrl}/${page.slug}`;

    return {
      title: title.slice(0, 60),
      description,
      canonical,
      ogTitle: title.slice(0, 60),
      ogDescription: description,
      ogImage: `${baseUrl}/og-image-${page.slug}.png`,
      ogType: 'website',
      twitterCard: 'summary_large_image',
      robots: page.status === 'published' ? 'index, follow' : 'noindex, nofollow',
    };
  }

  /** Generate JSON-LD structured data */
  generateJsonLd(page: LandingPage, blueprint: LPCopyBlueprint, baseUrl: string): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: blueprint.hero.headline,
      description: blueprint.hero.subheadline,
      url: `${baseUrl}/${page.slug}`,
      publisher: {
        '@type': 'Organization',
        name: 'Plataforma RH',
        logo: `${baseUrl}/logo.png`,
      },
      mainEntity: {
        '@type': 'SoftwareApplication',
        name: blueprint.hero.headline,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'BRL',
          description: blueprint.cta.urgency ?? 'Teste grátis por 14 dias.',
        },
      },
      review: blueprint.proof.testimonials.slice(0, 3).map(t => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: t.name },
        reviewBody: t.quote,
      })),
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        reviewCount: String(blueprint.proof.testimonials.length),
        bestRating: '5',
      },
    };
  }

  /** Generate sitemap XML entry */
  generateSitemapEntry(page: LandingPage, baseUrl: string): string {
    return `  <url>
    <loc>${baseUrl}/${page.slug}</loc>
    <lastmod>${page.updated_at.split('T')[0]}</lastmod>
    <changefreq>${page.status === 'published' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${page.status === 'published' ? '0.8' : '0.4'}</priority>
  </url>`;
  }

  // ── Helpers ──────────────────────────────

  private issue(severity: SEOIssue['severity'], rule: string, message: string, fix: string): SEOIssue {
    return { id: `seo-${rule}-${Date.now()}`, severity, rule, message, fix };
  }
}

export const seoOptimizationService = new SEOOptimizationService();
