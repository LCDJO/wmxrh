/**
 * Revenue Intelligence Domain Events
 */

export type RevenueIntelligenceEventType =
  | 'ReferralLinkCreated'
  | 'ReferralSignup'
  | 'ReferralConverted'
  | 'RewardAwarded'
  | 'TierUpgraded'
  | 'ChurnRiskDetected'
  | 'UpgradeRecommended';

export interface RevenueIntelligenceEventBase {
  type: RevenueIntelligenceEventType;
  timestamp: number;
  user_id?: string;
  tenant_id?: string;
}

export interface ReferralLinkCreatedEvent extends RevenueIntelligenceEventBase {
  type: 'ReferralLinkCreated';
  code: string;
}

export interface ReferralSignupEvent extends RevenueIntelligenceEventBase {
  type: 'ReferralSignup';
  referrer_user_id: string;
  referred_tenant_id: string;
}

export interface ReferralConvertedEvent extends RevenueIntelligenceEventBase {
  type: 'ReferralConverted';
  tracking_id: string;
  payment_brl: number;
}

export interface RewardAwardedEvent extends RevenueIntelligenceEventBase {
  type: 'RewardAwarded';
  reward_type: string;
  amount_brl: number;
  points: number;
}

export interface TierUpgradedEvent extends RevenueIntelligenceEventBase {
  type: 'TierUpgraded';
  from_tier: string;
  to_tier: string;
}

export interface ChurnRiskDetectedEvent extends RevenueIntelligenceEventBase {
  type: 'ChurnRiskDetected';
  risk_score: number;
  mrr_at_risk: number;
}

export interface UpgradeRecommendedEvent extends RevenueIntelligenceEventBase {
  type: 'UpgradeRecommended';
  current_plan: string;
  recommended_plan: string;
  potential_uplift_brl: number;
}

export type RevenueIntelligenceDomainEvent =
  | ReferralLinkCreatedEvent
  | ReferralSignupEvent
  | ReferralConvertedEvent
  | RewardAwardedEvent
  | TierUpgradedEvent
  | ChurnRiskDetectedEvent
  | UpgradeRecommendedEvent;

// ── Event Bus ──────────────────────────────────────────────

type Listener = (event: RevenueIntelligenceDomainEvent) => void;
const listeners = new Set<Listener>();
const eventLog: RevenueIntelligenceDomainEvent[] = [];

export function onRevenueIntelligenceEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitRevenueIntelligenceEvent(event: RevenueIntelligenceDomainEvent): void {
  for (const l of listeners) {
    try { l(event); } catch { /* swallow */ }
  }
  eventLog.unshift(event);
  if (eventLog.length > 100) eventLog.pop();
}

export function getRevenueIntelligenceEventLog(): ReadonlyArray<RevenueIntelligenceDomainEvent> {
  return eventLog;
}
