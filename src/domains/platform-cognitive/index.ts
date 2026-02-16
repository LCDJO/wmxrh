/**
 * PlatformCognitiveLayer — barrel export.
 *
 * Architecture:
 *  PlatformCognitiveLayer
 *   ├── CognitiveContextCollector
 *   ├── BehaviorAnalyzer
 *   ├── PermissionAdvisor
 *   ├── NavigationAdvisor
 *   ├── RoleSuggestionEngine
 *   └── CognitiveInsightsService  (orchestrator)
 */
export { CognitiveContextCollector } from './cognitive-context-collector';
export { BehaviorAnalyzer, ROLE_FINGERPRINTS } from './behavior-analyzer';
export type { RoleFingerprint, RoleSuggestionMatch } from './behavior-analyzer';
export { PermissionAdvisor } from './permission-advisor';
export { NavigationAdvisor } from './navigation-advisor';
export { RoleSuggestionEngine } from './role-suggestion-engine';
export { CognitiveInsightsService } from './cognitive-insights.service';
export type * from './types';
