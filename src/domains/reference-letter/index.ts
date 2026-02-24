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
