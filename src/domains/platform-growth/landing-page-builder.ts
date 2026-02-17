/**
 * LandingPageBuilder — CRUD + orchestrator for landing pages.
 * Persists to the `landing_pages` table via Supabase.
 * FABContentEngine generates high-conversion block content.
 * Emits LandingPageCreated, LandingPagePublished, FABContentUpdated domain events.
 */
import { supabase } from '@/integrations/supabase/client';
import type { LandingPage, FABBlock, FABBlockType, FABContent, LandingPageAnalytics, LPCopyBlueprint } from './types';
import { emitGrowthEvent } from './growth.events';

// ── Default analytics for new pages ────────────────────────────
const DEFAULT_ANALYTICS: LandingPageAnalytics = {
  views: 0, uniqueVisitors: 0, conversions: 0, conversionRate: 0,
  avgTimeOnPage: 0, bounceRate: 0, topSources: [],
};

// ── Row → Domain mapper ───────────────────────────────────────
function rowToLandingPage(row: Record<string, unknown>): LandingPage {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    status: row.status as 'draft' | 'published',
    target_plan_id: (row.target_plan_id as string) ?? null,
    referral_program_id: (row.referral_program_id as string) ?? null,
    gtm_container_id: (row.gtm_container_id as string) ?? null,
    blocks: (row.blocks ?? []) as FABBlock[],
    analytics: (row.analytics ?? DEFAULT_ANALYTICS) as LandingPageAnalytics,
    created_by: (row.created_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    published_at: (row.published_at as string) ?? null,
  };
}

// ── Public API ─────────────────────────────────────────────────

export class LandingPageBuilder {
  /** List all landing pages */
  async getAll(): Promise<LandingPage[]> {
    const { data, error } = await supabase
      .from('landing_pages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[LandingPageBuilder] getAll error:', error);
      return [];
    }
    return (data ?? []).map(rowToLandingPage);
  }

  /** Get a single landing page by id */
  async getById(id: string): Promise<LandingPage | null> {
    const { data, error } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return rowToLandingPage(data);
  }

  /** Create a new landing page */
  async create(input: {
    name: string;
    slug: string;
    target_plan_id?: string;
    referral_program_id?: string;
    gtm_container_id?: string;
    blocks?: FABBlock[];
  }): Promise<LandingPage | null> {
    const { data: userData } = await supabase.auth.getUser();

    const row = {
      name: input.name,
      slug: input.slug,
      status: 'draft' as const,
      target_plan_id: input.target_plan_id ?? null,
      referral_program_id: input.referral_program_id ?? null,
      gtm_container_id: input.gtm_container_id ?? null,
      blocks: JSON.parse(JSON.stringify(input.blocks ?? [])),
      analytics: JSON.parse(JSON.stringify(DEFAULT_ANALYTICS)),
      created_by: userData?.user?.id ?? null,
    };

    const { data, error } = await supabase
      .from('landing_pages')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[LandingPageBuilder] create error:', error);
      return null;
    }
    const page = rowToLandingPage(data);

    emitGrowthEvent({
      type: 'LandingPageCreated',
      timestamp: Date.now(),
      pageId: page.id,
      pageName: page.name,
      slug: page.slug,
      blocksCount: page.blocks.length,
      createdBy: page.created_by ?? 'unknown',
    });

    return page;
  }

  /** Update an existing landing page */
  async update(id: string, fields: Partial<{
    name: string;
    slug: string;
    status: 'draft' | 'published';
    target_plan_id: string | null;
    referral_program_id: string | null;
    gtm_container_id: string | null;
    blocks: FABBlock[];
    published_at: string | null;
  }>): Promise<LandingPage | null> {
    const payload: Record<string, unknown> = { ...fields };
    if (fields.blocks) {
      payload.blocks = fields.blocks as unknown as Record<string, unknown>;
    }
    // Auto-set published_at when publishing
    if (fields.status === 'published' && !fields.published_at) {
      payload.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('landing_pages')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[LandingPageBuilder] update error:', error);
      return null;
    }
    const page = rowToLandingPage(data);

    // Emit LandingPagePublished when status transitions to published
    if (fields.status === 'published') {
      emitGrowthEvent({
        type: 'LandingPagePublished',
        timestamp: Date.now(),
        pageId: page.id,
        pageName: page.name,
        slug: page.slug,
        publishedBy: page.created_by ?? 'unknown',
        publisherRole: 'platform_user',
      });
    }

    // Emit FABContentUpdated when blocks change
    if (fields.blocks) {
      for (const block of fields.blocks) {
        emitGrowthEvent({
          type: 'FABContentUpdated',
          timestamp: Date.now(),
          pageId: page.id,
          blockId: block.id,
          blockType: block.type,
          changedFields: ['feature', 'advantage', 'benefit'],
          updatedBy: page.created_by ?? 'unknown',
        });
      }
    }

    return page;
  }

  /** Delete a landing page */
  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('landing_pages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[LandingPageBuilder] delete error:', error);
      return false;
    }
    return true;
  }

  /** Add a block to a page with FAB content */
  async addBlock(pageId: string, type: FABBlockType, fab?: Partial<FABContent>): Promise<FABBlock | null> {
    const page = await this.getById(pageId);
    if (!page) return null;

    const block: FABBlock = {
      id: `b-${Date.now()}`,
      type,
      order: page.blocks.length,
      fab: {
        feature: fab?.feature ?? '',
        advantage: fab?.advantage ?? '',
        benefit: fab?.benefit ?? '',
      },
      content: {},
    };

    const updated = await this.update(pageId, {
      blocks: [...page.blocks, block],
    });
    return updated ? block : null;
  }
}

export const landingPageBuilder = new LandingPageBuilder();

/**
 * FABContentEngine — Generates complete LP copy following the mandatory structure:
 *
 *   1. Hero Section     → Headline + CTA + FAB principal
 *   2. Features         → Lista de features com FAB
 *   3. Advantages       → Diferenciais competitivos
 *   4. Benefits         → Resultados mensuráveis
 *   5. CTA              → Chamada final com urgência
 *   6. Proof Elements   → Testimonials, stats, logos, certificações
 */
export class FABContentEngine {
  // ── FAB catalog by module ──────────────────────────────────
  private readonly catalog: Record<string, FABContent[]> = {
    'multi-tenant': [
      { feature: 'Multi-tenant avançado', advantage: 'Gestão centralizada de múltiplas empresas', benefit: 'Redução de custos operacionais em até 40%' },
      { feature: 'Isolamento de dados por tenant', advantage: 'Segurança e compliance garantidos', benefit: 'Zero risco de vazamento entre clientes' },
    ],
    'admissao-digital': [
      { feature: 'Admissão 100% digital', advantage: 'Eliminação de papelada e retrabalho', benefit: 'Onboarding 70% mais rápido' },
      { feature: 'Checklist automático de documentos', advantage: 'Nenhum documento esquecido', benefit: 'Compliance trabalhista desde o dia 1' },
    ],
    'folha': [
      { feature: 'Cálculo automático de folha', advantage: 'Regras CLT e convenções aplicadas automaticamente', benefit: 'Economia de 20h/mês do time de DP' },
      { feature: 'Integração com eSocial', advantage: 'Envio direto sem retrabalho', benefit: 'Zero multas por atraso ou inconsistência' },
    ],
    'compliance': [
      { feature: 'Motor de compliance em tempo real', advantage: 'Monitoramento contínuo de NRs e prazos', benefit: 'Proteção contra autuações e passivos trabalhistas' },
      { feature: 'Alertas preditivos de vencimento', advantage: 'Ação preventiva antes do prazo', benefit: 'Redução de 90% em não-conformidades' },
    ],
    'referral': [
      { feature: 'Programa de indicação integrado', advantage: 'Aquisição via rede de clientes satisfeitos', benefit: 'CAC até 60% menor que canais pagos' },
    ],
  };

  getByModule(moduleKey: string): FABContent[] {
    return this.catalog[moduleKey] ?? [];
  }

  getAvailableModules(): string[] {
    return Object.keys(this.catalog);
  }

  // ── Full LP Blueprint Generator ────────────────────────────

  /**
   * Generate a complete LP copy blueprint for a given industry.
   * Follows the mandatory 6-section structure.
   */
  generateBlueprint(industry: string = 'default', modules: string[] = []): LPCopyBlueprint {
    const hero = this.buildHero(industry);
    const features = this.buildFeatures(modules);
    const advantages = this.buildAdvantages(modules);
    const benefits = this.buildBenefits(modules);
    const cta = this.buildCTA(industry);
    const proof = this.buildProof();

    return { hero, features, advantages, benefits, cta, proof };
  }

  // ── Section builders ───────────────────────────────────────

  private buildHero(industry: string): LPCopyBlueprint['hero'] {
    const templates: Record<string, LPCopyBlueprint['hero']> = {
      default: {
        headline: 'Gestão de RH sem complicação',
        subheadline: 'Automatize admissões, folha e compliance em uma plataforma.',
        ctaText: 'Experimente grátis por 14 dias',
        ctaLink: '/auth/signup',
        fab: { feature: 'Plataforma completa de gestão de pessoas', advantage: 'Tudo integrado: admissão, folha, compliance', benefit: 'Gestão de RH sem complicação' },
      },
      tech: {
        headline: 'RH para empresas de tecnologia',
        subheadline: 'Escale seu time com processos ágeis e integrados.',
        ctaText: 'Comece agora — é grátis',
        ctaLink: '/auth/signup',
        fab: { feature: 'RH otimizado para tech', advantage: 'Processos ágeis que acompanham seu crescimento', benefit: 'Escale seu time sem gargalos operacionais' },
      },
      healthcare: {
        headline: 'Compliance em saúde ocupacional',
        subheadline: 'NRs, ASOs e PCMSO em conformidade total.',
        ctaText: 'Conheça a plataforma',
        ctaLink: '/auth/signup',
        fab: { feature: 'Compliance ocupacional automatizado', advantage: 'NRs, ASOs e PCMSO sempre em dia', benefit: 'Zero risco de autuação' },
      },
    };
    return templates[industry] ?? templates.default;
  }

  private buildFeatures(modules: string[]): FABContent[] {
    const keys = modules.length > 0 ? modules : Object.keys(this.catalog);
    return keys.flatMap(k => this.catalog[k] ?? []);
  }

  private buildAdvantages(modules: string[]): LPCopyBlueprint['advantages'] {
    const features = this.buildFeatures(modules);
    return features.map(f => ({
      title: f.advantage,
      description: `${f.feature} permite ${f.advantage.toLowerCase()}, resultando em ${f.benefit.toLowerCase()}.`,
      fab: f,
    }));
  }

  private buildBenefits(modules: string[]): LPCopyBlueprint['benefits'] {
    const features = this.buildFeatures(modules);
    return features.map(f => ({
      title: f.benefit,
      metric: this.extractMetric(f.benefit),
      description: `Ao usar ${f.feature.toLowerCase()}, sua empresa ganha ${f.advantage.toLowerCase()}.`,
      fab: f,
    }));
  }

  private buildCTA(industry: string): LPCopyBlueprint['cta'] {
    const ctaMap: Record<string, LPCopyBlueprint['cta']> = {
      default: {
        headline: 'Pronto para transformar seu RH?',
        subheadline: 'Junte-se a mais de 340 empresas que já automatizaram sua gestão de pessoas.',
        ctaText: 'Criar conta gratuita',
        ctaLink: '/auth/signup',
        urgency: 'Primeiros 14 dias grátis — sem cartão de crédito.',
      },
      tech: {
        headline: 'Seu RH merece ser tão ágil quanto seu produto',
        subheadline: 'Setup em 5 minutos. Integração com suas ferramentas favoritas.',
        ctaText: 'Começar agora',
        ctaLink: '/auth/signup',
        urgency: 'Onboarding assistido para os primeiros 50 clientes.',
      },
      healthcare: {
        headline: 'Compliance não pode esperar',
        subheadline: 'Proteja sua empresa contra autuações trabalhistas hoje mesmo.',
        ctaText: 'Agendar demonstração',
        ctaLink: '/auth/signup',
        urgency: 'Diagnóstico gratuito de compliance em 48h.',
      },
    };
    return ctaMap[industry] ?? ctaMap.default;
  }

  private buildProof(): LPCopyBlueprint['proof'] {
    return {
      testimonials: [
        { name: 'Maria Silva', role: 'Head de RH', company: 'TechCorp', quote: 'Reduziu nosso tempo de admissão em 70%. A plataforma se paga no primeiro mês.' },
        { name: 'Carlos Mendes', role: 'Diretor de DP', company: 'SaúdePlus', quote: 'Finalmente conseguimos manter todas as NRs em dia sem planilhas.' },
        { name: 'Ana Rodrigues', role: 'CEO', company: 'StartupXYZ', quote: 'Escalamos de 20 para 200 colaboradores sem contratar ninguém para o DP.' },
      ],
      stats: [
        { label: 'Tenants ativos', value: '340+' },
        { label: 'Colaboradores gerenciados', value: '12.000+' },
        { label: 'Economia média em DP', value: '40%' },
        { label: 'Tempo médio de admissão', value: '< 24h' },
        { label: 'Uptime da plataforma', value: '99.9%' },
      ],
      logos: ['TechCorp', 'SaúdePlus', 'StartupXYZ', 'IndústriaMax', 'LogiTech'],
      certifications: ['SOC 2 Type II', 'LGPD Compliant', 'eSocial Homologado'],
    };
  }

  /** Extract numeric metric from benefit text */
  private extractMetric(benefit: string): string {
    const match = benefit.match(/(\d+[%h]?)/);
    return match ? match[1] : '✓';
  }
}

export const fabContentEngine = new FABContentEngine();
