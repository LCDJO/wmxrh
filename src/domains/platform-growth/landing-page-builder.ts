/**
 * LandingPageBuilder — CRUD + orchestrator for landing pages.
 * Persists to the `landing_pages` table via Supabase.
 * FABContentEngine generates high-conversion block content.
 */
import { supabase } from '@/integrations/supabase/client';
import type { LandingPage, FABBlock, FABBlockType, FABContent, LandingPageAnalytics } from './types';

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
    return rowToLandingPage(data);
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
    return rowToLandingPage(data);
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
 * FABContentEngine — Generates Feature-Advantage-Benefit copy for landing page blocks.
 *
 * Each block must answer:
 *   Feature   → O que é?
 *   Advantage → Por que importa?
 *   Benefit   → Qual o resultado para o cliente?
 */
export class FABContentEngine {
  /** Pre-built FAB sets by module/industry */
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

  /** Get FAB content sets for a given module key */
  getByModule(moduleKey: string): FABContent[] {
    return this.catalog[moduleKey] ?? [];
  }

  /** List all available module keys */
  getAvailableModules(): string[] {
    return Object.keys(this.catalog);
  }

  /** Generate a hero block FAB */
  generateHeroFAB(industry: string): FABContent & { headline: string; subheadline: string; ctaText: string } {
    const templates: Record<string, FABContent & { headline: string; subheadline: string; ctaText: string }> = {
      default: {
        feature: 'Plataforma completa de gestão de pessoas',
        advantage: 'Tudo integrado: admissão, folha, compliance',
        benefit: 'Gestão de RH sem complicação',
        headline: 'Gestão de RH sem complicação',
        subheadline: 'Automatize admissões, folha e compliance em uma plataforma.',
        ctaText: 'Experimente grátis',
      },
      tech: {
        feature: 'RH otimizado para empresas de tecnologia',
        advantage: 'Processos ágeis que acompanham seu crescimento',
        benefit: 'Escale seu time sem gargalos operacionais',
        headline: 'RH para empresas de tecnologia',
        subheadline: 'Escale seu time com processos ágeis e integrados.',
        ctaText: 'Comece agora',
      },
      healthcare: {
        feature: 'Compliance ocupacional automatizado',
        advantage: 'NRs, ASOs e PCMSO sempre em dia',
        benefit: 'Zero risco de autuação em saúde ocupacional',
        headline: 'Compliance em saúde ocupacional',
        subheadline: 'NRs, ASOs e PCMSO em conformidade total.',
        ctaText: 'Conheça a plataforma',
      },
    };
    return templates[industry] ?? templates.default;
  }
}

export const fabContentEngine = new FABContentEngine();
