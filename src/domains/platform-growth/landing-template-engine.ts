/**
 * LandingTemplateEngine — Pre-built landing page templates with section definitions.
 *
 * Templates:
 *  1. SaaS Hero        — Product-led, feature-focused, free trial CTA
 *  2. Enterprise Sales — Trust-first, demo CTA, compliance proof
 *  3. Free Trial       — Urgency-driven, quick signup, minimal friction
 *  4. Referral Landing — Social proof, referral reward, viral loop
 *
 * Each template defines an ordered list of sections that map to existing
 * landing page components (HeroSection, FABSection, PricingSection, etc.).
 */

import type { FABContent, LPCopyBlueprint } from './types';
import { fabContentEngine } from './landing-page-builder';

// ── Section Types ────────────────────────────────────────────

export type TemplateSectionType =
  | 'hero'
  | 'fab'
  | 'pricing'
  | 'referral_cta'
  | 'testimonials'
  | 'faq'
  | 'footer';

export interface TemplateSection {
  id: string;
  type: TemplateSectionType;
  label: string;
  description: string;
  enabled: boolean;
  locked?: boolean; // Cannot be removed (e.g. hero is always first)
}

export interface LandingTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string; // Lucide icon name
  color: string; // HSL color
  tags: string[];
  sections: TemplateSection[];
  defaultIndustry: string;
  defaultModules: string[];
}

// ── Template Definitions ─────────────────────────────────────

const SAAS_HERO_TEMPLATE: LandingTemplate = {
  id: 'saas-hero',
  name: 'SaaS Hero',
  slug: 'saas-hero',
  description: 'Template product-led otimizado para conversão de trials. Hero impactante, features com FAB, pricing transparente e prova social.',
  icon: 'Rocket',
  color: 'hsl(265 80% 55%)',
  tags: ['product-led', 'trial', 'SaaS'],
  defaultIndustry: 'tech',
  defaultModules: ['multi-tenant', 'folha', 'admissao-digital'],
  sections: [
    { id: 'hero', type: 'hero', label: 'Hero', description: 'Headline + CTA principal + FAB micro-copy', enabled: true, locked: true },
    { id: 'fab', type: 'fab', label: 'Features · Advantages · Benefits', description: 'Seções FAB completas com cards de features', enabled: true },
    { id: 'pricing', type: 'pricing', label: 'Pricing', description: 'Tabela comparativa de planos', enabled: true },
    { id: 'testimonials', type: 'testimonials', label: 'Testimonials', description: 'Depoimentos + stats + logos', enabled: true },
    { id: 'faq', type: 'faq', label: 'FAQ', description: 'Perguntas frequentes', enabled: true },
    { id: 'footer', type: 'footer', label: 'Footer + CTA Final', description: 'CTA de urgência + links', enabled: true, locked: true },
  ],
};

const ENTERPRISE_SALES_TEMPLATE: LandingTemplate = {
  id: 'enterprise-sales',
  name: 'Enterprise Sales',
  slug: 'enterprise-sales',
  description: 'Template trust-first para vendas enterprise. Foco em compliance, segurança e ROI mensurável. CTA para agendar demo.',
  icon: 'Building2',
  color: 'hsl(200 70% 50%)',
  tags: ['enterprise', 'B2B', 'demo'],
  defaultIndustry: 'healthcare',
  defaultModules: ['compliance', 'multi-tenant', 'folha'],
  sections: [
    { id: 'hero', type: 'hero', label: 'Hero Enterprise', description: 'Headline de confiança + CTA para demo', enabled: true, locked: true },
    { id: 'testimonials', type: 'testimonials', label: 'Prova Social', description: 'Logos, certificações e depoimentos enterprise', enabled: true },
    { id: 'fab', type: 'fab', label: 'Capabilities', description: 'Features enterprise com foco em compliance e escala', enabled: true },
    { id: 'pricing', type: 'pricing', label: 'Planos Enterprise', description: 'Pricing com destaque para Enterprise', enabled: true },
    { id: 'faq', type: 'faq', label: 'FAQ', description: 'Perguntas sobre segurança, SLA e integração', enabled: true },
    { id: 'footer', type: 'footer', label: 'Footer + Demo CTA', description: 'CTA final para agendar demonstração', enabled: true, locked: true },
  ],
};

const FREE_TRIAL_TEMPLATE: LandingTemplate = {
  id: 'free-trial',
  name: 'Free Trial',
  slug: 'free-trial',
  description: 'Template de alta conversão com foco em signup rápido. Mínima fricção, urgência e benefícios claros.',
  icon: 'Zap',
  color: 'hsl(145 60% 42%)',
  tags: ['trial', 'conversão', 'PLG'],
  defaultIndustry: 'tech',
  defaultModules: ['admissao-digital', 'folha'],
  sections: [
    { id: 'hero', type: 'hero', label: 'Hero Trial', description: 'Headline direto + CTA sem cartão', enabled: true, locked: true },
    { id: 'fab', type: 'fab', label: 'Benefícios Rápidos', description: 'Top 3 benefícios com métricas', enabled: true },
    { id: 'testimonials', type: 'testimonials', label: 'Social Proof', description: 'Stats + depoimento curto', enabled: true },
    { id: 'referral_cta', type: 'referral_cta', label: 'Referral CTA', description: 'Indicação para ganhar créditos', enabled: false },
    { id: 'faq', type: 'faq', label: 'FAQ', description: 'Dúvidas sobre trial e cancelamento', enabled: true },
    { id: 'footer', type: 'footer', label: 'Footer Mínimo', description: 'CTA final de urgência', enabled: true, locked: true },
  ],
};

const REFERRAL_LANDING_TEMPLATE: LandingTemplate = {
  id: 'referral-landing',
  name: 'Referral Landing',
  slug: 'referral-landing',
  description: 'Template viral para programa de indicação. Foco em recompensas, prova social e compartilhamento.',
  icon: 'Gift',
  color: 'hsl(340 75% 55%)',
  tags: ['referral', 'viral', 'growth'],
  defaultIndustry: 'default',
  defaultModules: ['referral', 'admissao-digital'],
  sections: [
    { id: 'hero', type: 'hero', label: 'Hero Referral', description: 'Headline de recompensa + código de indicação', enabled: true, locked: true },
    { id: 'referral_cta', type: 'referral_cta', label: 'Referral Reward', description: 'Bloco de recompensa com código', enabled: true },
    { id: 'fab', type: 'fab', label: 'Por que indicar', description: 'Benefícios do programa de indicação', enabled: true },
    { id: 'testimonials', type: 'testimonials', label: 'Indicadores de Sucesso', description: 'Stats de indicações e prova social', enabled: true },
    { id: 'faq', type: 'faq', label: 'FAQ', description: 'Como funciona o programa', enabled: true },
    { id: 'footer', type: 'footer', label: 'Footer + Compartilhar', description: 'CTA de compartilhamento', enabled: true, locked: true },
  ],
};

// ── Engine ────────────────────────────────────────────────────

export class LandingTemplateEngine {
  private templates: LandingTemplate[] = [
    SAAS_HERO_TEMPLATE,
    ENTERPRISE_SALES_TEMPLATE,
    FREE_TRIAL_TEMPLATE,
    REFERRAL_LANDING_TEMPLATE,
  ];

  /** Get all available templates */
  getAll(): LandingTemplate[] {
    return this.templates;
  }

  /** Get template by ID */
  getById(id: string): LandingTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  /** Generate a full blueprint from a template */
  generateBlueprint(templateId: string): LPCopyBlueprint {
    const template = this.getById(templateId);
    const industry = template?.defaultIndustry ?? 'default';
    const modules = template?.defaultModules ?? [];
    return fabContentEngine.generateBlueprint(industry, modules);
  }

  /** Clone a template with custom section order */
  cloneWithSections(templateId: string, sections: TemplateSection[]): LandingTemplate | null {
    const base = this.getById(templateId);
    if (!base) return null;
    return {
      ...base,
      id: `${base.id}-custom-${Date.now()}`,
      sections,
    };
  }

  /** Get the enabled sections in order for a template */
  getEnabledSections(templateId: string): TemplateSection[] {
    const template = this.getById(templateId);
    if (!template) return [];
    return template.sections.filter(s => s.enabled);
  }
}

export const landingTemplateEngine = new LandingTemplateEngine();
