/**
 * NR Training Lifecycle Engine — Bounded Context
 *
 * Manages the full lifecycle of mandatory NR trainings:
 *   pending → scheduled → completed → (active | expired) → renewal
 *
 * Capabilities:
 *   - Auto-assignment from Occupational Intelligence
 *   - Validity tracking with auto-expiry detection
 *   - Mandatory renewal scheduling
 *   - Function blocking on overdue/expired trainings
 *   - Immutable audit trail for labor compliance
 *   - Compliance violations integration
 */

// Core engine (pure functions)
export {
  canTransition,
  computeBlockingLevel,
  getBlockingDescription,
  computeExpiryDate,
  isExpired,
  isOverdue,
  daysUntilExpiry,
  getRenewalUrgency,
  buildRenewalForecast,
  computeEmployeeCompliance,
  computeDashboardStats,
} from './lifecycle.engine';

// Service layer (persistence + orchestration)
export { trainingLifecycleService } from './training-lifecycle.service';

// Events
export { trainingLifecycleEvents } from './events';
export type {
  TrainingAssignedEvent,
  TrainingCompletedEvent,
  TrainingExpiredEvent,
  TrainingBlockedEvent,
  TrainingRenewalDueEvent,
  TrainingStatusChangedEvent,
  TrainingLifecycleEventType,
} from './events';

// Integrations
export { trainingIntegrations } from './integrations';

// Functional Block Engine
export {
  functionalBlockEngine,
  classifyBlockingLevel,
  isOperationallyRestricted,
} from './functional-block.engine';
export type {
  EmployeeRestrictionStatus,
  RestrictionReason,
  BlockedTrainingSummary,
} from './functional-block.engine';

// Types
export type {
  TrainingLifecycleStatus,
  TrainingTrigger,
  BlockingLevel,
  TrainingAssignment,
  TrainingCompletion,
  TrainingLifecycleEvent,
  CreateAssignmentDTO,
  RecordCompletionDTO,
  WaiveTrainingDTO,
  ScheduleTrainingDTO,
  EmployeeTrainingCompliance,
  CompanyTrainingCompliance,
  RenewalForecast,
  TrainingDashboardStats,
} from './types';
