export { getRevenueIntelligenceEngine } from './revenue-intelligence-engine';
export type { RevenueIntelligenceEngine } from './revenue-intelligence-engine';
export type {
  RevenueMetrics,
  RevenueForecast,
  ChurnRiskTenant,
  UpgradeCandidate,
  ReferralLink,
  ReferralTracking,
  ReferralProgram,
  GamificationTier,
  GamificationLevel,
  GamificationPointWeight,
  GamificationProfile,
  GamificationLeaderboardEntry,
  RewardMode,
  RewardResult,
  TenantUsageScore,
  TenantUserEngagement,
} from './types';
export {
  emitRevenueIntelligenceEvent,
  onRevenueIntelligenceEvent,
  onRevenueEventType,
  getRevenueIntelligenceEventLog,
  clearRevenueIntelligenceEventLog,
} from './revenue-events';
export type {
  RevenueIntelligenceDomainEvent,
  RevenueIntelligenceEventType,
  ReferralLinkCreatedEvent,
  ReferralConvertedEvent,
  RewardGrantedEvent,
  RevenueForecastUpdatedEvent,
  GamificationLevelUpEvent,
} from './revenue-events';
