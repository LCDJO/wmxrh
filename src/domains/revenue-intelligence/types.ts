/**
 * Revenue Intelligence & Referral Engine — Domain Types
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  RevenueIntelligenceEngine                                   ║
 * ║   ├── RevenueAnalyzer                                        ║
 * ║   ├── ChurnPredictionService                                 ║
 * ║   ├── UpgradeRecommendationService                           ║
 * ║   ├── ReferralManager                                        ║
 * ║   ├── ReferralLinkGenerator                                  ║
 * ║   ├── ReferralTrackingService                                ║
 * ║   ├── GamificationEngine                                     ║
 * ║   └── RewardCalculator                                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ══════════════════════════════════════════════════════════════
// Revenue Analytics
// ══════════════════════════════════════════════════════════════

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  paying_tenants: number;
  arpa: number;
  growth_rate_pct: number;
  net_revenue_retention_pct: number;
  churn_rate_pct: number;
  ltv_estimate: number;
}

export interface RevenueForecast {
  month: string;
  projected_mrr: number;
  confidence_low: number;
  confidence_high: number;
  growth_scenario: 'pessimistic' | 'base' | 'optimistic';
}

export interface ChurnRiskTenant {
  tenant_id: string;
  tenant_name: string;
  plan_name: string;
  risk_score: number; // 0-100
  risk_factors: string[];
  days_since_last_activity: number;
  mrr_at_risk: number;
  recommended_action: string;
}

export interface UpgradeCandidate {
  tenant_id: string;
  tenant_name: string;
  current_plan: string;
  recommended_plan: string;
  usage_pct: number;
  potential_uplift_brl: number;
  signals: string[];
}

// ══════════════════════════════════════════════════════════════
// Referral System
// ══════════════════════════════════════════════════════════════

export interface ReferralLink {
  id: string;
  referrer_user_id: string;
  code: string;
  url: string;
  is_active: boolean;
  total_clicks: number;
  total_signups: number;
  total_conversions: number;
  total_reward_brl: number;
  created_at: string;
}

export interface ReferralTracking {
  id: string;
  referral_link_id: string;
  referrer_user_id: string;
  referred_tenant_id: string;
  status: 'pending' | 'trial' | 'converted' | 'churned' | 'expired';
  signed_up_at: string;
  converted_at: string | null;
  plan_id: string | null;
  first_payment_brl: number | null;
  reward_brl: number | null;
}

export interface ReferralReward {
  id: string;
  referrer_user_id: string;
  tracking_id: string | null;
  reward_type: 'commission' | 'credit' | 'bonus' | 'tier_upgrade';
  amount_brl: number;
  description: string | null;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
}

// ══════════════════════════════════════════════════════════════
// Gamification
// ══════════════════════════════════════════════════════════════

export type GamificationTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface GamificationLeaderboardEntry {
  user_id: string;
  total_points: number;
  total_referrals: number;
  total_conversions: number;
  total_reward_brl: number;
  current_tier: GamificationTier;
}

export interface GamificationPointEntry {
  id: string;
  user_id: string;
  action: string;
  points: number;
  source: string;
  description: string | null;
  created_at: string;
}

// ══════════════════════════════════════════════════════════════
// Engine APIs
// ══════════════════════════════════════════════════════════════

export interface RevenueAnalyzerAPI {
  getMetrics(): Promise<RevenueMetrics>;
  getForecast(months: number): Promise<RevenueForecast[]>;
  getMonthlyTrend(months: number): Promise<{ month: string; mrr: number; tenants: number }[]>;
}

export interface ChurnPredictionServiceAPI {
  getAtRiskTenants(): Promise<ChurnRiskTenant[]>;
  getTenantRiskScore(tenantId: string): Promise<number>;
}

export interface UpgradeRecommendationServiceAPI {
  getCandidates(): Promise<UpgradeCandidate[]>;
}

export interface ReferralManagerAPI {
  generateLink(userId: string): Promise<ReferralLink>;
  getLinks(userId?: string): Promise<ReferralLink[]>;
  getTracking(linkId?: string): Promise<ReferralTracking[]>;
  recordConversion(trackingId: string, planId: string, paymentBrl: number): Promise<void>;
}

export interface GamificationEngineAPI {
  getLeaderboard(limit?: number): Promise<GamificationLeaderboardEntry[]>;
  getUserPoints(userId: string): Promise<GamificationPointEntry[]>;
  awardPoints(userId: string, action: string, points: number, source: string, description?: string): Promise<void>;
  recalculateTier(userId: string): Promise<GamificationTier>;
}

export interface RewardCalculatorAPI {
  calculateCommission(paymentBrl: number, tier: GamificationTier): number;
  getTierThresholds(): Record<GamificationTier, number>;
}
