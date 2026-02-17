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
} from './types';
export {
  emitRevenueIntelligenceEvent,
  onRevenueIntelligenceEvent,
  getRevenueIntelligenceEventLog,
} from './revenue-events';
export type { RevenueIntelligenceDomainEvent, RevenueIntelligenceEventType } from './revenue-events';
