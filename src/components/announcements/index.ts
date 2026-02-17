/**
 * Announcements — Public API barrel
 */

// Domain services
export { announcementDispatcher } from '@/domains/announcements/announcement-hub';
export { announcementReactor } from '@/domains/announcements/announcement-reactor';
export { applyRestrictions, clearRestrictions, getRestrictedFeatures } from '@/domains/announcements/restriction-bridge';

// UI Components
export { SystemAnnouncementBanner } from './SystemAnnouncementBanner';
export { SystemAlertCard } from './SystemAlertCard';
export { TenantAnnouncementList } from './TenantAnnouncementList';
export { SystemNoticeBadge } from './SystemNoticeBadge';
export { AnnouncementBanner } from './AnnouncementBanner';
export { AnnouncementFlyoutSection } from './AnnouncementFlyoutSection';

// Types — Core
export type {
  AlertType,
  Severity,
  BlockingLevel,
  TenantAnnouncement,
  CreateAnnouncementInput,
} from '@/domains/announcements/announcement-hub';

export type {
  AnnouncementTriggerEvent,
  AnnouncementTriggerPayload,
} from '@/domains/announcements/announcement-reactor';

// Types — Future: Multicanal
export type {
  DeliveryChannelType,
  DeliveryChannel,
  DeliveryRecipient,
  DeliveryResult,
  DeliveryOptions,
  ChannelPreference,
  ChannelOrchestrator,
} from '@/domains/announcements/channels/delivery-channel';
export { DEFAULT_CHANNEL_RULES, createChannelOrchestrator } from '@/domains/announcements/channels/delivery-channel';

// Types — Future: SLA & Health Score
export type {
  SlaMetric,
  SlaStatus,
  SlaDefinition,
  SlaSnapshot,
  SlaViolation,
  SlaAlertEngine,
  HealthDimension,
  HealthDimensionScore,
  TenantHealthScore,
  HealthScoreEngine,
} from '@/domains/announcements/sla/sla-alert-engine';
export { scoreToGrade, GRADE_CONFIG } from '@/domains/announcements/sla/sla-alert-engine';

// Types — Future: AI Smart Announcements
export type {
  SuggestionSource,
  AnnouncementSuggestion,
  SuggestionEvidence,
  SmartAnnouncementEngine,
  SuggestionContext,
} from '@/domains/announcements/ai/smart-announcements';
export { SUGGESTION_SOURCE_CONFIG } from '@/domains/announcements/ai/smart-announcements';
