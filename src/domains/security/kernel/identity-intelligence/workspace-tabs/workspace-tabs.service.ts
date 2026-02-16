/**
 * WorkspaceTabsService — Future: browser-style tabs per workspace
 *
 * Stub service. Full implementation will:
 *   - Manage tab strip with open/close/reorder/pin
 *   - Preserve route + scroll + form drafts per tab
 *   - Sync badge counts from notification system
 *   - Persist tab layout to localStorage/sessionStorage
 */

import type {
  WorkspaceTab,
  TabStripState,
  TabEvent,
  OpenTabCommand,
  CloseTabCommand,
  ReorderTabCommand,
  UpdateTabBadgeCommand,
} from './types';

type TabListener = (event: TabEvent) => void;

export class WorkspaceTabsService {
  private _state: TabStripState = {
    tabs: [],
    active_tab_id: null,
    max_tabs: 8,
    overflow_policy: 'close_oldest',
  };

  private _listeners: TabListener[] = [];

  // ── Queries ──

  get state(): TabStripState {
    return this._state;
  }

  get activeTab(): WorkspaceTab | null {
    if (!this._state.active_tab_id) return null;
    return this._state.tabs.find(t => t.id === this._state.active_tab_id) ?? null;
  }

  getTabByTenant(tenantId: string): WorkspaceTab | null {
    return this._state.tabs.find(t => t.tenant_id === tenantId) ?? null;
  }

  get tabCount(): number {
    return this._state.tabs.length;
  }

  get canOpenTab(): boolean {
    return this._state.tabs.length < this._state.max_tabs
      || this._state.overflow_policy !== 'block';
  }

  // ── Commands (stubs) ──

  openTab(_cmd: OpenTabCommand): WorkspaceTab | null {
    console.info('[WorkspaceTabs] openTab — stub', _cmd);
    return null;
  }

  closeTab(_cmd: CloseTabCommand): boolean {
    console.info('[WorkspaceTabs] closeTab — stub', _cmd);
    return false;
  }

  focusTab(tabId: string): boolean {
    console.info('[WorkspaceTabs] focusTab — stub', tabId);
    return false;
  }

  reorderTab(_cmd: ReorderTabCommand): boolean {
    console.info('[WorkspaceTabs] reorderTab — stub', _cmd);
    return false;
  }

  pinTab(tabId: string): boolean {
    console.info('[WorkspaceTabs] pinTab — stub', tabId);
    return false;
  }

  unpinTab(tabId: string): boolean {
    console.info('[WorkspaceTabs] unpinTab — stub', tabId);
    return false;
  }

  updateBadge(_cmd: UpdateTabBadgeCommand): void {
    console.info('[WorkspaceTabs] updateBadge — stub', _cmd);
  }

  /** Save current tab's draft state to sessionStorage */
  saveDraft(tabId: string, _draftData: unknown): void {
    console.info('[WorkspaceTabs] saveDraft — stub', tabId);
  }

  /** Restore draft state when re-focusing a tab */
  restoreDraft(tabId: string): unknown | null {
    console.info('[WorkspaceTabs] restoreDraft — stub', tabId);
    return null;
  }

  // ── Event Bus ──

  onEvent(listener: TabListener): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  private _emit(event: TabEvent): void {
    this._listeners.forEach(l => {
      try { l(event); } catch (e) { console.error('[WorkspaceTabs] listener error', e); }
    });
  }
}

/** Singleton */
export const workspaceTabsService = new WorkspaceTabsService();
