/**
 * LandingPageBuilder — CRUD + orchestrator for landing pages.
 * FABContentEngine generates high-conversion block content.
 */
import type { LandingPage, FABBlock, FABBlockType } from './types';

const DEMO_BLOCKS: FABBlock[] = [
  { id: 'b1', type: 'hero', order: 0, content: { headline: 'Simplifique seu RH', subheadline: 'Plataforma completa de gestão de pessoas', ctaText: 'Comece Grátis' } },
  { id: 'b2', type: 'features', order: 1, content: { items: ['Admissão digital', 'Folha automatizada', 'Compliance em tempo real', 'eSocial integrado'] } },
  { id: 'b3', type: 'stats', order: 2, content: { metrics: [{ label: 'Tenants ativos', value: '340+' }, { label: 'Colaboradores gerenciados', value: '12.000+' }, { label: 'Economia média', value: '40%' }] } },
  { id: 'b4', type: 'pricing', order: 3, content: { plans: ['Starter', 'Professional', 'Enterprise'] } },
  { id: 'b5', type: 'testimonials', order: 4, content: { quotes: [{ name: 'Maria S.', role: 'Head de RH', text: 'Reduziu nosso tempo de admissão em 70%.' }] } },
  { id: 'b6', type: 'cta', order: 5, content: { headline: 'Pronto para transformar seu RH?', ctaText: 'Criar conta gratuita', ctaLink: '/auth/signup' } },
];

export class LandingPageBuilder {
  private pages: LandingPage[] = [
    {
      id: 'lp-1', slug: 'rh-gestao', title: 'RH Gestão — Plataforma de RH',
      status: 'published', blocks: DEMO_BLOCKS, gtmContainerId: 'GTM-XXXXXX',
      conversionGoal: 'signup', createdAt: '2025-12-01T00:00:00Z',
      updatedAt: '2026-02-15T00:00:00Z', publishedAt: '2026-01-10T00:00:00Z',
      analytics: { views: 4820, uniqueVisitors: 3210, conversions: 186, conversionRate: 5.79, avgTimeOnPage: 142, bounceRate: 34.2, topSources: [{ source: 'Google', visits: 1840 }, { source: 'Referral', visits: 920 }, { source: 'Direct', visits: 450 }] },
    },
  ];

  getAll(): LandingPage[] { return this.pages; }
  getById(id: string): LandingPage | undefined { return this.pages.find(p => p.id === id); }

  addBlock(pageId: string, type: FABBlockType): FABBlock | null {
    const page = this.getById(pageId);
    if (!page) return null;
    const block: FABBlock = { id: `b-${Date.now()}`, type, order: page.blocks.length, content: {} };
    page.blocks.push(block);
    return block;
  }
}

export const landingPageBuilder = new LandingPageBuilder();

/**
 * FABContentEngine — Generates Features-Advantages-Benefits copy for landing page blocks.
 */
export class FABContentEngine {
  generateHeroCopy(industry: string): { headline: string; subheadline: string; ctaText: string } {
    const templates: Record<string, { headline: string; subheadline: string; ctaText: string }> = {
      default: { headline: 'Gestão de RH sem complicação', subheadline: 'Automatize admissões, folha e compliance em uma plataforma.', ctaText: 'Experimente grátis' },
      tech: { headline: 'RH para empresas de tecnologia', subheadline: 'Escale seu time com processos ágeis e integrados.', ctaText: 'Comece agora' },
      healthcare: { headline: 'Compliance em saúde ocupacional', subheadline: 'NRs, ASOs e PCMSO em conformidade total.', ctaText: 'Conheça a plataforma' },
    };
    return templates[industry] ?? templates.default;
  }
}

export const fabContentEngine = new FABContentEngine();
