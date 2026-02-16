/**
 * Workspace Tabs Module — Public API
 *
 * Future feature: browser-style tabs per workspace.
 * Currently exports types and stub service for architectural readiness.
 */

export { WorkspaceTabsService, workspaceTabsService } from './workspace-tabs.service';

export type {
  WorkspaceTab,
  WorkspaceTabStatus,
  TabStripState,
  TabEvent,
  TabEventType,
  OpenTabCommand,
  CloseTabCommand,
  ReorderTabCommand,
  UpdateTabBadgeCommand,
} from './types';
