/**
 * Workspace Tabs — Future: browser-style tabs per workspace
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TAB MODEL                                                       ║
 * ║                                                                  ║
 * ║  Each tab represents a workspace context (tenant + scope).       ║
 * ║  Tabs persist state independently:                                ║
 * ║    - Route/path                                                   ║
 * ║    - Scroll position                                             ║
 * ║    - Form state (draft)                                          ║
 * ║    - Notification badge                                          ║
 * ║                                                                  ║
 * ║  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                           ║
 * ║  │ Org A│ │ Org B│ │ Org C│ │  +   │                           ║
 * ║  │ (★)  │ │ •2   │ │      │ │      │                           ║
 * ║  └──────┘ └──────┘ └──────┘ └──────┘                           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { ScopeType } from '@/domains/shared/types';

// ════════════════════════════════════
// TAB MODEL
// ════════════════════════════════════

export type WorkspaceTabStatus = 'active' | 'background' | 'loading' | 'error';

export interface WorkspaceTab {
  /** Unique tab ID */
  readonly id: string;

  /** Tenant context */
  readonly tenant_id: string;
  readonly tenant_name: string;
  readonly tenant_color: string;  // deterministic hue for visual identification

  /** Scope context within this tab */
  readonly scope_level: ScopeType;
  readonly group_id: string | null;
  readonly company_id: string | null;

  /** Navigation state */
  readonly current_path: string;
  readonly scroll_position: number;

  /** Tab status */
  readonly status: WorkspaceTabStatus;

  /** Badge for unread/pending items */
  readonly badge_count: number;
  readonly badge_type: 'info' | 'warning' | 'error' | null;

  /** Lifecycle */
  readonly created_at: number;
  readonly last_focused_at: number;

  /** Pinned tabs stay open and resist close */
  readonly is_pinned: boolean;

  /** Draft state preservation key (serialized to sessionStorage) */
  readonly draft_key: string | null;
}

// ════════════════════════════════════
// TAB STRIP STATE
// ════════════════════════════════════

export interface TabStripState {
  /** Ordered list of tabs */
  readonly tabs: readonly WorkspaceTab[];

  /** Currently focused tab ID */
  readonly active_tab_id: string | null;

  /** Max tabs allowed */
  readonly max_tabs: number;

  /** Overflow behavior when max is reached */
  readonly overflow_policy: 'close_oldest' | 'block' | 'stack';
}

// ════════════════════════════════════
// TAB COMMANDS
// ════════════════════════════════════

export interface OpenTabCommand {
  tenant_id: string;
  tenant_name: string;
  path?: string;
  focus?: boolean;
  /** If true, reuse existing tab for this tenant instead of creating new */
  reuse?: boolean;
}

export interface CloseTabCommand {
  tab_id: string;
  /** If true, force close even if pinned or has unsaved changes */
  force?: boolean;
}

export interface ReorderTabCommand {
  tab_id: string;
  new_index: number;
}

export interface UpdateTabBadgeCommand {
  tab_id: string;
  badge_count: number;
  badge_type: WorkspaceTab['badge_type'];
}

// ════════════════════════════════════
// TAB EVENTS
// ════════════════════════════════════

export type TabEventType =
  | 'TabOpened'
  | 'TabClosed'
  | 'TabFocused'
  | 'TabReordered'
  | 'TabBadgeUpdated'
  | 'TabDraftSaved'
  | 'TabDraftRestored';

export interface TabEvent {
  readonly type: TabEventType;
  readonly timestamp: number;
  readonly tab_id: string;
  readonly tenant_id: string;
  readonly metadata?: Record<string, unknown>;
}
