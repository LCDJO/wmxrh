/**
 * Future Preparation — Regulatory Intelligence
 *
 * Contracts and stubs for upcoming integrations:
 *  1. External Legal API
 *  2. AI Impact Summarization
 *  3. Automatic Email Notifications
 *  4. Real-time DOU Monitoring
 */

// ── Types ──
export type {
  // Legal API
  LegalApiProvider,
  LegalApiConfig,
  LegalApiQueryParams,
  LegalApiNormResult,
  LegalApiResponse,
  LegalApiSyncResult,
  // AI Summarization
  AiSummaryModel,
  SummaryLanguage,
  SummaryFormat,
  AiSummarizationRequest,
  AiSummarizationResult,
  // Email Notifications
  EmailNotificationType,
  EmailPriority,
  EmailNotificationTemplate,
  EmailNotificationRequest,
  EmailRecipient,
  EmailAttachment,
  EmailNotificationResult,
  // DOU Monitor
  DouSecao,
  DouMonitorStatus,
  DouMonitorConfig,
  DouPublicacao,
  DouDigestResult,
  DouCheckResult,
} from './types';

// ── Legal API Service ──
export {
  validateLegalApiConfig,
  buildQueryString,
  parseApiResponse,
  syncFromLegalApi,
  getDefaultProviderConfig,
} from './legal-api.service';

// ── AI Summarization Service ──
export {
  buildSummarizationPrompt,
  buildUserPrompt,
  summarizeImpact,
} from './ai-summarization.service';

// ── Email Notification Service ──
export {
  getDefaultTemplate,
  interpolateTemplate,
  sendRegulatoryEmail,
} from './email-notification.service';

// ── DOU Monitor Service ──
export {
  createDefaultDouConfig,
  calculateRelevanceScore,
  filterPublicacoes,
  checkDou,
  generateDouDigest,
} from './dou-monitor.service';
