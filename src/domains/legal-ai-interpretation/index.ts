/**
 * Legal AI Interpretation Engine — Bounded Context
 *
 * Interprets legislative changes detected by Regulatory Intelligence
 * and transforms them into actionable guidance:
 *  - Executive summaries
 *  - Practical interpretations
 *  - Position-level impact analysis
 *  - Structured action plans
 *  - Auto-generated workflows
 *
 * Integrations:
 *  - Regulatory Intelligence Engine
 *  - Career & Legal Intelligence Engine
 *  - Occupational Intelligence Engine
 *  - NR Training Lifecycle Engine
 *  - Labor Compliance (PCMSO/PGR)
 *  - Workforce Intelligence Engine
 *  - Safety Automation Engine
 *  - Government Integration Gateway
 *  - Security Kernel
 */

// ── Engines ──
export { generateInterpretation } from './interpretation.engine';
export { analyzePositionImpacts } from './position-impact.engine';
export { generateActionPlan } from './action-plan.engine';
export { generateWorkflows } from './workflow-generation.engine';
export { analyzeLegalChange } from './legal-ai-analyzer.engine';

export type {
  LegalInterpretation,
  LegalChangeInput,
  NivelGravidade,
  TipoImpacto,
} from './legal-ai-analyzer.engine';

// ── Event Consumer (Regulatory Intelligence → Legal AI) ──
export { startRegulatoryEventConsumer, stopRegulatoryEventConsumer } from './regulatory-event-consumer';

// ── Events ──
export { legalAiEvents, emitLegalAiEvent, onLegalAiEvent } from './legal-ai-interpretation.events';

// ── Types ──
export type {
  // Enums
  InterpretationStatus,
  ActionPriority,
  ActionComplexity,
  WorkflowType,
  ImpactLevel,
  InterpretationConfidence,
  // Core Entities
  ExecutiveSummary,
  PracticalInterpretation,
  PracticalImplication,
  NonComplianceRisk,
  LegalReference,
  PositionImpactAnalysis,
  PositionImpactArea,
  CostEstimate,
  ActionPlan,
  ActionStep,
  GeneratedWorkflow,
  WorkflowNode,
  WorkflowEdge,
  // Inputs
  InterpretationInput,
  DiffSummaryInput,
  PositionImpactInput,
  PositionSnapshot,
  CompanySnapshot,
  ActionPlanInput,
  WorkflowGenerationInput,
  // Outputs
  InterpretationResult,
  PositionImpactResult,
  ActionPlanResult,
  WorkflowGenerationResult,
} from './types';
