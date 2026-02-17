/**
 * Platform Growth AI + Landing Page Builder — Types
 */

// ── Growth Insight Engine ──
export interface GrowthInsight {
  id: string;
  type: 'acquisition' | 'retention' | 'expansion' | 'reactivation';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-100
  suggestedActions: string[];
  metrics: Record<string, number>;
  createdAt: string;
}

// ── Plan Optimization ──
export interface PlanOptimizationSuggestion {
  id: string;
  currentPlan: string;
  suggestedPlan: string;
  reason: string;
  expectedRevenueImpact: number;
  tenantId: string;
  tenantName: string;
  confidence: number;
}

// ── Conversion Prediction ──
export interface ConversionPrediction {
  leadId: string;
  source: string;
  score: number; // 0-100
  predictedPlan: string;
  predictedMRR: number;
  topFactors: string[];
  predictedAt: string;
}

// ── Landing Page Builder ──
export type FABBlockType = 'hero' | 'features' | 'pricing' | 'testimonials' | 'cta' | 'faq' | 'stats' | 'custom';

/** Feature-Advantage-Benefit content model */
export interface FABContent {
  feature: string;    // O que é (ex: "Multi-tenant avançado")
  advantage: string;  // Por que importa (ex: "Gestão centralizada")
  benefit: string;    // Resultado para o cliente (ex: "Redução de custos operacionais")
}

/** Full LP copy blueprint — structure required by FABContentEngine */
export interface LPCopyBlueprint {
  hero: {
    headline: string;
    subheadline: string;
    ctaText: string;
    ctaLink: string;
    fab: FABContent;
  };
  features: FABContent[];
  advantages: Array<{
    title: string;
    description: string;
    icon?: string;
    fab: FABContent;
  }>;
  benefits: Array<{
    title: string;
    metric: string;
    description: string;
    fab: FABContent;
  }>;
  cta: {
    headline: string;
    subheadline: string;
    ctaText: string;
    ctaLink: string;
    urgency?: string;
  };
  proof: {
    testimonials: Array<{ name: string; role: string; company: string; quote: string; avatar?: string }>;
    stats: Array<{ label: string; value: string }>;
    logos: string[];
    certifications: string[];
  };
}

export interface FABBlock {
  id: string;
  type: FABBlockType;
  order: number;
  fab: FABContent;
  content: Record<string, unknown>;
  styling?: Record<string, string>;
}

/** DB-backed entity */
export interface LandingPage {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'approved' | 'published';
  target_plan_id?: string | null;
  referral_program_id?: string | null;
  gtm_container_id?: string | null;
  blocks: FABBlock[];
  analytics: LandingPageAnalytics;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

/** Convenience alias used by legacy consumers */
export type { LandingPage as LandingPageEntity };

export interface LandingPageAnalytics {
  views: number;
  uniqueVisitors: number;
  conversions: number;
  conversionRate: number;
  avgTimeOnPage: number;
  bounceRate: number;
  topSources: Array<{ source: string; visits: number }>;
}

// ── Tag Manager ──
export interface TagManagerConfig {
  containerId: string;
  events: TagManagerEvent[];
  isActive: boolean;
}

export interface TagManagerEvent {
  name: string;
  trigger: string;
  category: string;
  label?: string;
  value?: number;
}

// ── Conversion Tracking ──
export interface ConversionEvent {
  id: string;
  landingPageId: string;
  type: 'signup' | 'trial_start' | 'purchase' | 'referral_click' | 'tenant_created' | 'plan_selected' | 'revenue_generated';
  source: string;
  referralCode?: string;
  tenantId?: string;
  planSelected?: string;
  revenue?: number;
  metadata: Record<string, unknown>;
  trackedAt: string;
}

// ── Growth Strategy ──
export interface GrowthStrategy {
  id: string;
  name: string;
  type: 'organic' | 'paid' | 'referral' | 'partnership';
  status: 'planning' | 'active' | 'paused' | 'completed';
  budget?: number;
  kpis: Array<{ metric: string; target: number; current: number }>;
  landingPages: string[];
  startDate: string;
  endDate?: string;
}
