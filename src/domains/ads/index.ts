export { adDeliveryService } from './ad-delivery-service';
export type { AdContext, AdCreative } from './ad-delivery-service';
export { useAdSlot } from './hooks/useAdSlot';
export {
  useAdsCampaigns, useAdsCreatives, useAdsTargeting, useAdsMetrics,
} from './hooks/useAdsCampaigns';
export type {
  AdsCampaign, AdsCreative, AdsTargeting, AdsPlacement, AdsMetricsSummary, DailyMetric,
} from './hooks/useAdsCampaigns';
