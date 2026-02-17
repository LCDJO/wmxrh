/**
 * Revenue Intelligence Domain Events
 *
 * Events:
 *  - ReferralLinkCreated
 *  - ReferralSignup
 *  - ReferralConverted
 *  - RewardGranted (was RewardAwarded)
 *  - RevenueForecastUpdated
 *  - GamificationLevelUp
 *  - ChurnRiskDetected
 *  - UpgradeRecommended
 */

export type RevenueIntelligenceEventType =
  | 'ReferralLinkCreated'
  | 'ReferralSignup'
  | 'ReferralConverted'
  | 'RewardAwarded'
  | 'RewardGranted'
  | 'RevenueForecastUpdated'
  | 'GamificationLevelUp'
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
  link_id?: string;
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
  plan_id?: string;
}

/** @deprecated Use RewardGrantedEvent — kept for backward compat */
export interface RewardAwardedEvent extends RevenueIntelligenceEventBase {
  type: 'RewardAwarded';
  reward_type: string;
  amount_brl: number;
  points: number;
}

export interface RewardGrantedEvent extends RevenueIntelligenceEventBase {
  type: 'RewardGranted';
  reward_type: string;
  amount_brl: number;
  points: number;
  referrer_user_id?: string;
}

export interface RevenueForecastUpdatedEvent extends RevenueIntelligenceEventBase {
  type: 'RevenueForecastUpdated';
  mrr_current: number;
  mrr_forecast: number;
  growth_rate_pct: number;
  forecast_horizon_months: number;
}

export interface GamificationLevelUpEvent extends RevenueIntelligenceEventBase {
  type: 'GamificationLevelUp';
  from_tier: string;
  to_tier: string;
  total_points: number;
}

/** @deprecated Use GamificationLevelUpEvent */
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
  | RewardGrantedEvent
  | RevenueForecastUpdatedEvent
  | GamificationLevelUpEvent
  | TierUpgradedEvent
  | ChurnRiskDetectedEvent
  | UpgradeRecommendedEvent;

// ── Event Bus ──────────────────────────────────────────────

type Listener = (event: RevenueIntelligenceDomainEvent) => void;
type TypedListener = { type: RevenueIntelligenceEventType; fn: Listener };

const listeners = new Set<Listener>();
const typedListeners: TypedListener[] = [];
const eventLog: RevenueIntelligenceDomainEvent[] = [];

export function onRevenueIntelligenceEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Subscribe to a specific event type. */
export function onRevenueEventType<T extends RevenueIntelligenceDomainEvent>(
  type: T['type'],
  listener: (event: T) => void,
): () => void {
  const entry: TypedListener = { type, fn: listener as Listener };
  typedListeners.push(entry);
  return () => {
    const idx = typedListeners.indexOf(entry);
    if (idx >= 0) typedListeners.splice(idx, 1);
  };
}

export function emitRevenueIntelligenceEvent(event: RevenueIntelligenceDomainEvent): void {
  for (const l of listeners) {
    try { l(event); } catch { /* swallow */ }
  }
  for (const tl of typedListeners) {
    if (tl.type === event.type) {
      try { tl.fn(event); } catch { /* swallow */ }
    }
  }
  eventLog.unshift(event);
  if (eventLog.length > 100) eventLog.pop();
}

export function getRevenueIntelligenceEventLog(): ReadonlyArray<RevenueIntelligenceDomainEvent> {
  return eventLog;
}

export function clearRevenueIntelligenceEventLog(): void {
  eventLog.length = 0;
}
