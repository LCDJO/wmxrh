/**
 * SEO Manager — Core types and engine for website SEO configuration.
 */

export interface SEOConfig {
  title: string;
  meta_description: string;
  canonical_url?: string;
  og_image?: string;
  structured_data?: StructuredData;
  robots?: RobotsDirective;
  keywords?: string[];
}

export interface StructuredData {
  '@type': string;
  name?: string;
  description?: string;
  url?: string;
  logo?: string;
  image?: string;
  [key: string]: unknown;
}

export interface RobotsDirective {
  index: boolean;
  follow: boolean;
  archive?: boolean;
}

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

/** Build JSON-LD script content from structured data */
export function buildJsonLd(data: StructuredData, baseUrl: string): object {
  return {
    '@context': 'https://schema.org',
    ...data,
    url: data.url || baseUrl,
  };
}

/** Build robots.txt content */
export function buildRobotsTxt(
  baseUrl: string,
  disallowPaths: string[] = [],
  sitemapPath = '/sitemap.xml',
): string {
  const lines = [
    'User-agent: *',
    ...disallowPaths.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${baseUrl}${sitemapPath}`,
  ];
  if (disallowPaths.length === 0) lines.splice(1, 0, 'Allow: /');
  return lines.join('\n');
}

/** Build sitemap.xml content */
export function buildSitemapXml(entries: SitemapEntry[], baseUrl: string): string {
  const urls = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${baseUrl}${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority.toFixed(1)}</priority>\n  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

/** Generate default SEO config for a page */
export function defaultSEOConfig(pageName: string, slug: string, baseUrl: string): SEOConfig {
  return {
    title: `${pageName} | Plataforma RH`,
    meta_description: `${pageName} — Conheça a plataforma completa de gestão de pessoas.`,
    canonical_url: `${baseUrl}${slug}`,
    robots: { index: true, follow: true },
    structured_data: {
      '@type': 'WebPage',
      name: pageName,
      description: `${pageName} — Plataforma de gestão de pessoas`,
      url: `${baseUrl}${slug}`,
    },
  };
}

/** Validate SEO config and return issues */
export function validateSEO(config: SEOConfig): string[] {
  const issues: string[] = [];
  if (!config.title) issues.push('Título é obrigatório');
  else if (config.title.length > 60) issues.push(`Título muito longo (${config.title.length}/60 caracteres)`);
  if (!config.meta_description) issues.push('Meta description é obrigatória');
  else if (config.meta_description.length > 160) issues.push(`Meta description muito longa (${config.meta_description.length}/160)`);
  if (!config.canonical_url) issues.push('URL canônica recomendada');
  if (!config.og_image) issues.push('Imagem OG recomendada para compartilhamento social');
  if (!config.structured_data) issues.push('Schema.org markup recomendado');
  return issues;
}
