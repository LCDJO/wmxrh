/**
 * NavigationPanelContext — Isolated contexts for SaaS Platform vs Tenant Workspace.
 *
 * Ensures menus are NEVER mixed between the two panels.
 * Each panel has its own resolved navigation tree, scope, and state.
 */

import React, { createContext, useContext, useMemo, useCallback, useState } from 'react';
import type { MenuNode } from './menu-hierarchy-builder';
import type { ResolvedNavigation } from './navigation-refactor-engine';
import { getNavigationRefactorEngine } from './navigation-refactor-engine';
import type { TenantRole } from '@/domains/shared/types';

// ── Types ────────────────────────────────────────────────────

export type PanelScope = 'platform' | 'tenant';

export interface PanelNavigationState {
  scope: PanelScope;
  nodes: MenuNode[];
  activeGroupId: string | null;
  activePath: string | null;
}

interface NavigationPanelContextValue {
  /** Current active panel */
  activePanel: PanelScope;

  /** Isolated state per panel — never mixed */
  platform: PanelNavigationState;
  tenant: PanelNavigationState;

  /** Switch between panels (only for platform users with dual access) */
  switchPanel: (scope: PanelScope) => void;

  /** Get the navigation state for the current active panel */
  currentNavigation: PanelNavigationState;

  /** Resolve and refresh navigation for both panels */
  refreshNavigation: () => void;
}

const NavigationPanelCtx = createContext<NavigationPanelContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

interface NavigationPanelProviderProps {
  children: React.ReactNode;
  initialPanel: PanelScope;
  roles: TenantRole[];
  allowedModules: string[];
  isModuleAccessible?: (key: string) => boolean;
  isPlatformUser: boolean;
}

export function NavigationPanelProvider({
  children,
  initialPanel,
  roles,
  allowedModules,
  isModuleAccessible,
  isPlatformUser,
}: NavigationPanelProviderProps) {
  const [activePanel, setActivePanel] = useState<PanelScope>(initialPanel);

  const resolved = useMemo<ResolvedNavigation>(() => {
    const engine = getNavigationRefactorEngine();
    return engine.resolve({
      roles,
      allowedModules,
      isModuleAccessible,
      scope: 'both',
    });
  }, [roles, allowedModules, isModuleAccessible]);

  const platformState = useMemo<PanelNavigationState>(() => ({
    scope: 'platform' as const,
    nodes: isPlatformUser ? resolved.platform : [],
    activeGroupId: null,
    activePath: null,
  }), [resolved.platform, isPlatformUser]);

  const tenantState = useMemo<PanelNavigationState>(() => ({
    scope: 'tenant' as const,
    nodes: resolved.tenant,
    activeGroupId: null,
    activePath: null,
  }), [resolved.tenant]);

  const switchPanel = useCallback((scope: PanelScope) => {
    // Only platform users can switch to the platform panel
    if (scope === 'platform' && !isPlatformUser) return;
    setActivePanel(scope);
  }, [isPlatformUser]);

  const [, setRefreshKey] = useState(0);
  const refreshNavigation = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const currentNavigation = activePanel === 'platform' ? platformState : tenantState;

  const value = useMemo<NavigationPanelContextValue>(() => ({
    activePanel,
    platform: platformState,
    tenant: tenantState,
    switchPanel,
    currentNavigation,
    refreshNavigation,
  }), [activePanel, platformState, tenantState, switchPanel, currentNavigation, refreshNavigation]);

  return (
    <NavigationPanelCtx.Provider value={value}>
      {children}
    </NavigationPanelCtx.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────

export function useNavigationPanel(): NavigationPanelContextValue {
  const ctx = useContext(NavigationPanelCtx);
  if (!ctx) {
    throw new Error('useNavigationPanel must be used within NavigationPanelProvider');
  }
  return ctx;
}

/**
 * Convenience: get only the current panel's nodes.
 * Guarantees isolation — tenant code never sees platform nodes and vice versa.
 */
export function useCurrentPanelNavigation(): PanelNavigationState {
  return useNavigationPanel().currentNavigation;
}

/**
 * Guard: ensures a component only renders within the expected panel.
 * Throws if rendered in the wrong scope.
 */
export function usePanelGuard(expectedScope: PanelScope): void {
  const { activePanel } = useNavigationPanel();
  if (activePanel !== expectedScope) {
    throw new Error(
      `Component expected panel "${expectedScope}" but is rendering in "${activePanel}". ` +
      `This is a navigation isolation violation.`
    );
  }
}
