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

// Types
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
