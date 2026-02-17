/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   SECURITY KERNEL                       ║
 * ║                                                         ║
 * ║  Camada central de segurança enterprise desacoplada.     ║
 * ║  Nenhum Bounded Context implementa regras de acesso     ║
 * ║  próprias — tudo passa pelo Kernel.                     ║
 * ║                                                         ║
 * ║  SecurityKernel                                         ║
 * ║   ├── IdentityService     (quem é + SecurityContext)    ║
 * ║   ├── PermissionEngine    (o que pode fazer)            ║
 * ║   ├── PolicyEngine        (regras dinâmicas)            ║
 * ║   ├── ScopeResolver       (onde pode acessar)           ║
 * ║   ├── FeatureFlagEngine   (o que está habilitado)       ║
 * ║   ├── AuditSecurityService(registrar tudo)              ║
 * ║   └── SecurityPipeline    (orquestra tudo)              ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ── Identity + SecurityContext ─────────────────────────────
export { resolveIdentity, buildSecurityContext } from './identity.service';
export type { Identity, SecurityContext, SecurityScope, BuildSecurityContextInput, UserType } from './identity.service';

// ── Permission Engine ──────────────────────────────────────
export { permissionEngine, checkPermission } from './permission-engine';
export type { PermissionEngineAPI, PermissionCheck, PermissionResult, PermissionDecision, ResourceTarget } from './permission-engine';

// ── Policy Engine ──────────────────────────────────────────
export { policyEngine, requireAtLeastOneRole, requireValidScope, preventCrossTenantAccess, BUILTIN_RULES } from './policy-engine';
export type {
  PolicyEngineAPI, PolicyFn, PolicyContext, PolicyResult, PolicyDecision,
  PolicyRule, PolicyEffect, PolicyCondition, PolicyEvalContext,
} from './policy-engine';

// ── Scope Resolver ─────────────────────────────────────────
export { resolveScope, resolveScopeFromContext, buildQueryScope, scopedInsertFromContext } from './scope-resolver';
export type { ScopeResolution, ScopeResolverInput, ResolvedQueryScope } from './scope-resolver';

// ── Feature Flag Engine ────────────────────────────────────
export { featureFlagEngine } from './feature-flag-engine';
export type { FeatureFlagEngineAPI, FeatureFlagContext, FeatureFlagRecord } from './feature-flag-engine';

// ── Audit Security ─────────────────────────────────────────
export { auditSecurity, onSecurityEvent } from './audit-security.service';
export type { AuditSecurityAPI, AuditEntry, AuditAction, AuditResult, SecurityEventType, SecurityEventPayload } from './audit-security.service';

// ── Security Pipeline ──────────────────────────────────────
export { executeSecurityPipeline, requirePermission, SecurityPipelineError } from './security-pipeline';
export type { PipelineResult, PipelineInput, PipelineDecision, PipelineDeniedBy } from './security-pipeline';

// ── Access Graph ───────────────────────────────────────────
export { AccessGraph, buildAccessGraph, getAccessGraph, setAccessGraph, clearAccessGraph } from './access-graph';
export type { AccessGraphInput, GraphNode, GraphEdge, NodeType, EdgeRelation } from './access-graph';

// ── Access Graph Service ───────────────────────────────────
export { accessGraphService } from './access-graph.service';
export type { InheritedScopes, InheritanceEntry, AccessCheckResult } from './access-graph.service';

// ── Access Graph Cache ─────────────────────────────────────
export { accessGraphCache } from './access-graph.cache';
export type { AccessGraphCacheEntry, CacheInvalidationReason, CacheInvalidationEvent } from './access-graph.cache';

// ── Access Graph Events ────────────────────────────────────
export { emitGraphEvent, onGraphEvent, getGraphEventLog, clearGraphEventLog, graphEvents } from './access-graph.events';
export type { GraphEventType, GraphEvent } from './access-graph.events';

// ── Access Graph Capabilities (Future) ─────────────────────
export { DEFAULT_CAPABILITIES, DEFAULT_EXPIRATION_CONFIG } from './access-graph.capabilities';
export type {
  AccessDelegation, DelegatedPermission, DelegationStatus, DelegatedEdgeRelation,
  TemporaryPermission, TemporaryPermissionStatus, TemporaryPermissionEventType,
  AccessExpirationConfig, ExpirationSweepResult,
  ExternalIdentityProvider, IdentityProviderType, IdentityProviderConfig,
  ExternalRoleMapping, IdentityMapping,
  AccessCapabilities, AccessGraphInputExtended,
} from './access-graph.capabilities';

// ── Dual Identity Engine ───────────────────────────────────
export { DualIdentityEngine, dualIdentityEngine, onImpersonationEvent, getImpersonationEventLog } from './dual-identity-engine';
export {
  IMPERSONATION_ALLOWED_ROLES, DEFAULT_SIMULATED_ROLE,
  MAX_IMPERSONATION_DURATION_MINUTES, DEFAULT_IMPERSONATION_DURATION_MINUTES,
} from './dual-identity-engine.types';
export type {
  RealIdentity, ActiveIdentity, ImpersonationSession,
  StartImpersonationRequest, StartImpersonationResult, EndImpersonationResult,
  ImpersonationDenialReason, ImpersonationEvent,
  ImpersonationStartedPayload, ImpersonationExpiredPayload, ImpersonationEndedPayload, ImpersonationDeniedPayload,
} from './dual-identity-engine.types';

// ── Identity Boundary Layer ────────────────────────────────
export { IdentityBoundaryLayer, identityBoundary } from './identity-boundary';
export { IdentitySessionManager } from './identity-boundary';
export { contextResolver } from './identity-boundary';
export { multiScopeTokenBuilder } from './identity-boundary';
export { contextGuard, ContextGuardError } from './identity-boundary';
export { ContextSwitcherService } from './identity-boundary';
export type {
  IdentitySession, TenantScope,
  BoundaryIdentity, OperationalContext, TenantMembership,
  IdentityProvider, ContextSwitchRequest, ContextSwitchResult,
  EstablishIdentityInput, IdentityBoundarySnapshot,
  RefreshScopesInput,
  AccessGraphSnapshot, AllowedScopes,
  ResolvedContext, ScopeValidation, ResolutionStrategy, InitialContextResolution, PersistedContext,
  MultiScopeToken, ScopeToken, QueryFilterSet,
  GuardResult, GuardTarget, GuardCheckName,
} from './identity-boundary';

// ── IBL Domain Events ──────────────────────────────────────
export { emitIBLEvent, onIBLEvent, onIBLEventType, getIBLEventLog, clearIBLEventLog } from './ibl/domain-events';
export type {
  IBLDomainEventType, IBLDomainEvent,
  ContextSwitchedPayload, ContextSnapshotPayload,
  IdentitySessionStartedPayload,
  IdentitySessionRefreshedPayload,
  UnauthorizedContextSwitchPayload,
} from './ibl/domain-events';

// ── IAM Domain Events (re-exported for kernel consumers) ───
export { emitIAMEvent, onIAMEvent, onIAMEventType, getIAMEventLog, clearIAMEventLog } from '@/domains/iam/iam.events';
export type {
  IAMEventType, IAMDomainEvent,
  UserInvitedPayload, UserRoleAssignedPayload, UserRoleRemovedPayload,
  RolePermissionsUpdatedPayload, AccessGraphRebuiltPayload,
} from '@/domains/iam/iam.events';

// ── Identity Intelligence Layer ────────────────────────────
export { IdentityIntelligenceService, identityIntelligence, onIILEvent, getIILEventLog } from './identity-intelligence';
export { useIdentityIntelligence } from './identity-intelligence';
export type { UseIdentityIntelligenceReturn } from './identity-intelligence';
export type {
  // Core session
  UnifiedIdentitySession, UnifiedRealIdentity, TenantWorkspace,
  GroupEntry, ActiveContext, ImpersonationState,
  // FSM
  IdentityPhase, IdentityTrigger, IdentityTransition,
  // Detection
  DetectedUserType, UserTypeDetection,
  // Workspace
  WorkspaceEntry, RecentContext,
  // Risk
  RiskLevel, RiskSignal, RiskAssessment,
  // Snapshot
  IdentitySnapshot, DecisionAction, IntelligenceDecision,
  // Events
  IILEventType, IILEvent,
  IILPhaseTransitionEvent, IILRiskEscalationEvent,
  IILAnomalyDetectedEvent, IILDecisionIssuedEvent,
  IILUserTypeDetectedEvent, IILWorkspaceSwitchedEvent,
} from './identity-intelligence';

// ── Platform Domain Events (re-exported for kernel consumers) ──
export { emitPlatformEvent, onPlatformEvent, onPlatformEventType, getPlatformEventLog, clearPlatformEventLog } from '@/domains/platform/platform.events';
export type {
  PlatformEventType, PlatformDomainEvent,
  PlatformRoleCreatedPayload, PlatformRoleUpdatedPayload,
  PlatformPermissionAssignedPayload, PlatformPermissionRevokedPayload,
  PlatformAccessGraphRebuiltPayload,
} from '@/domains/platform/platform.events';

// ── Unified Graph Engine (UGE) ──
export { unifiedGraphEngine, graphRegistry } from './unified-graph-engine';
export type {
  GraphDomain, UnifiedNode, UnifiedEdge, UnifiedNodeType, UnifiedEdgeRelation,
  UnifiedGraphSnapshot, GraphQuery, GraphQueryResult,
  RiskAssessment as UGERiskAssessment, RiskSignal as UGERiskSignal, RiskLevel as UGERiskLevel,
  VisualizationData, VisualizationNode, VisualizationEdge,
  AnalysisResult, GraphProvider,
} from './unified-graph-engine';
