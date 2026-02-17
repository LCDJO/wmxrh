/**
 * Autonomous Marketing Engine — Types
 * 
 * Core types for A/B testing, conversion intelligence, and experiment management.
 */

// ── A/B Testing ──

export type VariantId = string;
export type ExperimentId = string;

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type VariantAllocationStrategy = 'equal' | 'weighted' | 'multi_armed_bandit';

export interface ABExperiment {
  id: ExperimentId;
  name: string;
  description: string;
  landingPageId: string;
  status: ExperimentStatus;
  strategy: VariantAllocationStrategy;
  variants: ABVariant[];
  primaryMetric: ConversionMetricType;
  secondaryMetrics: ConversionMetricType[];
  trafficPercentage: number; // 0-100, how much total traffic enters experiment
  startedAt: string | null;
  endedAt: string | null;
  winnerVariantId: VariantId | null;
  confidenceLevel: number; // target statistical significance (e.g. 95)
  minSampleSize: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ABVariant {
  id: VariantId;
  experimentId: ExperimentId;
  name: string; // e.g. "Control", "Variant A"
  slug: string; // e.g. "control", "variant-a"
  weight: number; // 0-100 allocation weight
  isControl: boolean;
  blockOverrides: Record<string, unknown>; // overrides for LP blocks
  metrics: VariantMetrics;
}

export interface VariantMetrics {
  impressions: number;
  conversions: number;
  conversionRate: number;
  avgTimeOnPage: number;
  bounceRate: number;
  revenue: number;
  confidenceVsControl: number | null; // statistical significance vs control
}

// ── Conversion Metrics ──

export type ConversionMetricType =
  | 'signup'
  | 'trial_start'
  | 'purchase'
  | 'form_submit'
  | 'cta_click'
  | 'referral_click'
  | 'scroll_depth'
  | 'time_on_page'
  | 'custom';

export interface ConversionDataPoint {
  id: string;
  experimentId: ExperimentId | null;
  variantId: VariantId | null;
  landingPageId: string;
  metricType: ConversionMetricType;
  value: number;
  sessionId: string;
  visitorId: string;
  source: string;
  medium: string;
  campaign: string | null;
  referralCode: string | null;
  metadata: Record<string, unknown>;
  trackedAt: string;
}

export interface ConversionFunnel {
  landingPageId: string;
  steps: FunnelStep[];
  overallRate: number;
  dropOffPoints: Array<{ step: string; dropRate: number }>;
}

export interface FunnelStep {
  name: string;
  metricType: ConversionMetricType;
  count: number;
  rate: number; // vs previous step
}

// ── Performance Ranking ──

export interface LandingPerformanceScore {
  landingPageId: string;
  pageName: string;
  overallScore: number; // 0-100
  conversionScore: number;
  engagementScore: number;
  revenueScore: number;
  seoScore: number;
  trend: 'improving' | 'stable' | 'declining';
  rank: number;
  periodStart: string;
  periodEnd: string;
}

// ── AI Experiment Advisor ──

export interface ExperimentSuggestion {
  id: string;
  experimentId: ExperimentId | null;
  landingPageId: string;
  type: 'new_experiment' | 'stop_experiment' | 'scale_winner' | 'iterate_variant';
  title: string;
  description: string;
  rationale: string;
  predictedLift: number; // expected % improvement
  confidence: number; // 0-100
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestedActions: string[];
  createdAt: string;
}

// ── Traffic Routing ──

export interface TrafficRule {
  id: string;
  experimentId: ExperimentId;
  conditions: TrafficCondition[];
  variantId: VariantId;
  priority: number;
}

export interface TrafficCondition {
  field: 'source' | 'medium' | 'campaign' | 'device' | 'geo' | 'referral' | 'cookie';
  operator: 'equals' | 'contains' | 'matches' | 'not_equals';
  value: string;
}

export interface TrafficAllocation {
  visitorId: string;
  experimentId: ExperimentId;
  variantId: VariantId;
  allocatedAt: string;
  sticky: boolean; // visitor always sees same variant
}

// ── Marketing Insights ──

export interface MarketingInsight {
  id: string;
  type: 'performance' | 'experiment' | 'conversion' | 'traffic' | 'revenue';
  title: string;
  summary: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  metrics: Record<string, number>;
  recommendations: string[];
  landingPageIds: string[];
  experimentIds: ExperimentId[];
  generatedAt: string;
}
