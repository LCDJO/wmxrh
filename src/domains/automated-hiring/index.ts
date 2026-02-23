/**
 * Automated Hiring Workflow Engine — Bounded Context
 *
 * End-to-end employee admission automation compliant with
 * Brazilian labor legislation (CLT / eSocial / NRs).
 *
 * Architecture:
 *   1. WorkflowOrchestrator — State machine driving step progression
 *   2. StepValidators — Per-step validation (pure, no I/O)
 *   3. ComplianceGate — Final blocker evaluation before activation
 *   4. IntegrationAdapters — Bridges to external bounded contexts
 *   5. EventBus — Domain events for cross-module reactivity
 *
 * Integrations:
 *   - Employee Master Record Engine
 *   - Career & Legal Intelligence Engine
 *   - Occupational Intelligence Engine
 *   - NR Training Lifecycle Engine
 *   - EPILifecycleEngine
 *   - PCMSO / PGR
 *   - Employee Agreement Engine
 *   - Government Integration Gateway (eSocial)
 *   - Fleet Compliance Engine
 *   - Safety Automation Engine
 *   - Security Kernel
 */

// ── Orchestrator ──
export { hiringWorkflowOrchestrator } from './workflow-orchestrator.service';

// ── Step Validators ──
export { validateStep, validateAllSteps } from './step-validators';
export type { StepValidationResult } from './step-validators';

// ── Compliance Gate ──
export { evaluateComplianceGate } from './compliance-gate';

// ── Integration Adapters ──
export {
  buildOccupationalProfile,
  getAdmissionalExamRequirements,
  buildS2200Payload,
  buildOnboardingSafetySignal,
} from './integration-adapters';
export type {
  ESocialS2200Payload,
  OnboardingSafetySignal,
} from './integration-adapters';

// ── Document Validators ──
export { isValidCPF, isValidPIS, formatCPF, formatPIS } from './document-validators';

// ── Pre-Cadastro (Etapa 1) ──
export {
  validatePreCadastro,
  applyPreCadastroToWorkflow,
  isValidESocialCategory,
  isValidCBOFormat,
  getESocialCategoryLabel,
  ESOCIAL_CATEGORIES,
} from './pre-cadastro.engine';
export type {
  PreCadastroInput,
  PreCadastroResult,
  ESocialCategoryCode,
} from './pre-cadastro.engine';

// ── Análise Legal do Cargo (Etapa 2) ──
export {
  analyzePositionLegal,
  applyAnaliseLegalToWorkflow,
} from './analise-legal-cargo.engine';
export type {
  NrObrigatoria,
  ExameObrigatorio,
  EpiObrigatorio,
  AdicionalLegal,
  PisoSalarialAplicavel,
  AnaliseLegalCargoResult,
  AnaliseLegalCargoInput,
} from './analise-legal-cargo.engine';

// ── PCMSO Admissional (Etapa 3) ──
export {
  validateExameAdmissional,
  applyPcmsoToWorkflow,
  buildComplementaryExamChecklist,
} from './pcmso-admissional.engine';
export type {
  AsoResultado,
  ExameAdmissionalInput,
  ExameComplementarResult,
  PcmsoEtapaResult,
} from './pcmso-admissional.engine';

// ── Treinamentos NR Admissional (Etapa 4) ──
export {
  generateAdmissionTrainings,
  buildTrainingAssignmentDTOs,
  applyNrTrainingToWorkflow,
} from './nr-training-admission.engine';
export type {
  NrTrainingAdmissionInput,
  GeneratedTrainingAssignment,
  NrTrainingEtapaResult,
} from './nr-training-admission.engine';

// ── Entrega de EPI (Etapa 5) ──
export {
  buildEpiRequirements,
  generateDeliveryTerm,
  validateEpiDelivery,
  applyEpiDeliveryToWorkflow,
} from './epi-delivery.engine';
export type {
  EpiRequirement,
  EpiDeliveryRecord,
  EpiDeliveryTerm,
  EpiEtapaInput,
  EpiEtapaResult,
} from './epi-delivery.engine';

// ── Termos Obrigatórios (Etapa 6) ──
export {
  resolveRequiredAgreements,
  validateAgreements,
  applyAgreementsToWorkflow,
} from './agreements-admission.engine';
export type {
  AgreementCategory,
  RequiredAgreement,
  AgreementSignatureStatus,
  AgreementEtapaInput,
  AgreementEtapaResult,
} from './agreements-admission.engine';

// ── Events ──
export {
  onHiringEvent,
  emitHiringEvent,
  buildHiringEvent,
  resetHiringHandlers,
} from './events';

// ── Types ──
export type {
  HiringStep,
  HiringWorkflowStatus,
  StepStatus,
  HiringStepState,
  HiringWorkflow,
  CreateHiringWorkflowDTO,
  AdvanceStepDTO,
  CancelWorkflowDTO,
  ComplianceBlockerSeverity,
  ComplianceBlocker,
  ComplianceGateResult,
  OccupationalProfileResult,
  HealthExamRequirement,
  ESocialSubmissionResult,
  HiringEventName,
  HiringDomainEvent,
} from './types';

export { HIRING_STEPS, HIRING_EVENTS } from './types';
