/**
 * Reference Letter — Domain Barrel Export
 */
export {
  evaluateEligibility,
  requestReferenceLetter,
  signAsManager,
  signAsHR,
  cancelLetter,
  listReferenceLetters,
  generateLetterHtml,
  LETTER_TEMPLATES,
  STATUS_LABELS,
  STATUS_COLORS,
} from './reference-letter.engine';

export type {
  ReferenceLetter,
  ReferenceLetterStatus,
  EligibilityResult,
  RequestLetterInput,
} from './reference-letter.engine';

// ── Reputation Score Engine ──
export {
  computeReputationScore,
} from './reputation-score.engine';

export type {
  ReputationScoreResult,
  ReputationFactor,
  ReputationScoreConfig,
} from './reputation-score.engine';

// ── Document Generation ──
export { referenceLetterDocumentService } from './reference-letter-document.service';
export type { ReferenceLetterDocumentResult } from './reference-letter-document.service';
