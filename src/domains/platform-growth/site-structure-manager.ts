/**
 * SiteStructureManager — Manages the institutional website page tree.
 *
 * Responsibilities:
 *  1. Define hierarchical site structure (home, about, pricing, contact, etc.)
 *  2. Map each page to a LandingPage entity or static template
 *  3. Track navigation hierarchy for breadcrumbs + internal linking
 *  4. Auto-generate sitemap data for SEO
 */

export interface SitePage {
  id: string;
  slug: string;
  title: string;
  type: 'landing' | 'institutional' | 'blog' | 'legal' | 'custom';
  parentId: string | null;
  landingPageId: string | null;
  order: number;
  isVisible: boolean;
  meta: SitePageMeta;
  children?: SitePage[];
}

export interface SitePageMeta {
  title: string;
  description: string;
  ogImage?: string;
  canonical?: string;
  noIndex?: boolean;
}

export interface SiteStructure {
  id: string;
  name: string;
  domain: string;
  pages: SitePage[];
  createdAt: string;
  updatedAt: string;
}

export class SiteStructureManager {
  private structures: Map<string, SiteStructure> = new Map();

  /** Create a default professional website structure */
  createDefault(domain: string): SiteStructure {
    const id = `site-${Date.now()}`;
    const now = new Date().toISOString();

    const structure: SiteStructure = {
      id,
      name: 'Website Principal',
      domain,
      pages: [
        this.makePage('home', '/', 'Home', 'landing', null, 0),
        this.makePage('about', '/sobre', 'Sobre', 'institutional', null, 1),
        this.makePage('features', '/funcionalidades', 'Funcionalidades', 'landing', null, 2),
        this.makePage('pricing', '/precos', 'Preços', 'landing', null, 3),
        this.makePage('blog', '/blog', 'Blog', 'blog', null, 4),
        this.makePage('contact', '/contato', 'Contato', 'institutional', null, 5),
        this.makePage('terms', '/termos', 'Termos de Uso', 'legal', null, 6, false),
        this.makePage('privacy', '/privacidade', 'Política de Privacidade', 'legal', null, 7, false),
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.structures.set(id, structure);
    return structure;
  }

  /** Get or create structure */
  getOrCreate(domain: string): SiteStructure {
    const existing = Array.from(this.structures.values()).find(s => s.domain === domain);
    if (existing) return existing;
    return this.createDefault(domain);
  }

  /** Add a page to structure */
  addPage(structureId: string, page: Omit<SitePage, 'id' | 'children'>): SitePage | null {
    const structure = this.structures.get(structureId);
    if (!structure) return null;

    const newPage: SitePage = { ...page, id: `pg-${Date.now()}` };
    structure.pages.push(newPage);
    structure.updatedAt = new Date().toISOString();
    return newPage;
  }

  /** Remove a page */
  removePage(structureId: string, pageId: string): boolean {
    const structure = this.structures.get(structureId);
    if (!structure) return false;

    structure.pages = structure.pages.filter(p => p.id !== pageId);
    structure.updatedAt = new Date().toISOString();
    return true;
  }

  /** Reorder pages */
  reorder(structureId: string, orderedIds: string[]): boolean {
    const structure = this.structures.get(structureId);
    if (!structure) return false;

    orderedIds.forEach((id, idx) => {
      const page = structure.pages.find(p => p.id === id);
      if (page) page.order = idx;
    });
    structure.pages.sort((a, b) => a.order - b.order);
    structure.updatedAt = new Date().toISOString();
    return true;
  }

  /** Build hierarchical tree from flat list */
  toTree(structureId: string): SitePage[] {
    const structure = this.structures.get(structureId);
    if (!structure) return [];

    const map = new Map<string, SitePage>();
    const roots: SitePage[] = [];

    for (const page of structure.pages) {
      map.set(page.id, { ...page, children: [] });
    }

    for (const page of map.values()) {
      if (page.parentId && map.has(page.parentId)) {
        map.get(page.parentId)!.children!.push(page);
      } else {
        roots.push(page);
      }
    }

    return roots.sort((a, b) => a.order - b.order);
  }

  /** Generate sitemap entries */
  generateSitemap(structureId: string, baseUrl: string): string[] {
    const structure = this.structures.get(structureId);
    if (!structure) return [];

    return structure.pages
      .filter(p => p.isVisible && !p.meta.noIndex)
      .map(p => `${baseUrl}${p.slug}`);
  }

  // ── Helpers ──────────────────────────────

  private makePage(
    id: string,
    slug: string,
    title: string,
    type: SitePage['type'],
    parentId: string | null,
    order: number,
    isVisible = true,
  ): SitePage {
    return {
      id: `pg-${id}`,
      slug,
      title,
      type,
      parentId,
      landingPageId: null,
      order,
      isVisible,
      meta: {
        title: `${title} | Plataforma RH`,
        description: `${title} — Conheça a plataforma completa de gestão de pessoas.`,
      },
    };
  }
}

export const siteStructureManager = new SiteStructureManager();
