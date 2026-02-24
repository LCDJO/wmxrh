/**
 * LGPD Compliance — Domain Barrel Export
 */
export {
  listLegalBasis,
  upsertLegalBasis,
  logExEmployeeAccess,
  listAccessLogs,
  getRetentionOverview,
  anonymizeProfile,
  runAutoAnonymization,
  DEFAULT_LEGAL_BASES,
} from './lgpd-compliance.engine';

export type {
  LgpdLegalBasis,
  LgpdAccessLog,
  AnonymizationCandidate,
  RetentionOverview,
} from './lgpd-compliance.engine';
