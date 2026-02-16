/**
 * Future Cognitive Features — barrel export.
 *
 * These modules are STUBS. They define types, interfaces, and
 * singleton services that return default/empty data. They will
 * be wired to AI when the features are activated.
 *
 * ┌─────────────────────────────────────────────────┐
 * │  PermissionBuilderAssistant                     │
 * │  → AI inside the Visual Permission Builder      │
 * ├─────────────────────────────────────────────────┤
 * │  DashboardAutoConfig                            │
 * │  → Auto-configure dashboards per role/behavior  │
 * ├─────────────────────────────────────────────────┤
 * │  WorkspaceOnboardingIntelligence                │
 * │  → Smart onboarding based on CNAE/industry      │
 * └─────────────────────────────────────────────────┘
 */

export { PermissionBuilderAssistant, permissionBuilderAssistant } from './permission-builder-assistant';
export type { PermissionAssistantQuery, PermissionAssistantSuggestion, PermissionAssistantResponse } from './permission-builder-assistant';

export { DashboardAutoConfigService, dashboardAutoConfig } from './dashboard-auto-config';
export type { DashboardWidget, DashboardLayout, DashboardConfigSuggestion } from './dashboard-auto-config';

export { WorkspaceOnboardingIntelligence, workspaceOnboarding } from './workspace-onboarding';
export type { OnboardingStep, OnboardingPlan, OnboardingRecommendation, OnboardingStepStatus } from './workspace-onboarding';
