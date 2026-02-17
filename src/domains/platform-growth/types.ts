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

export interface FABBlock {
  id: string;
  type: FABBlockType;
  order: number;
  content: Record<string, unknown>;
  styling?: Record<string, string>;
}

/** DB-backed entity */
export interface LandingPage {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published';
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
  type: 'signup' | 'trial_start' | 'purchase' | 'referral_click';
  source: string;
  referralCode?: string;
  tenantId?: string;
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
