/**
 * DashboardAutoConfig — Future: AI-driven automatic dashboard configuration.
 *
 * Planned capabilities:
 *   - Analyse user role, behavior profile, and tenant data to recommend
 *     a personalised dashboard layout on first login
 *   - Auto-pin relevant widgets (KPIs, charts, alerts) per role
 *   - Re-arrange dashboard cards based on usage frequency over time
 *   - Suggest new widgets when new modules are activated
 *   - Allow "reset to AI-recommended" at any time
 *
 * SECURITY CONTRACT:
 *   Dashboard config changes are NON-DESTRUCTIVE. They only affect
 *   the user's personal layout preferences. No business data is
 *   modified. All changes require user confirmation.
 */

import type { BehaviorProfile } from '../types';

// ── Types ────────────────────────────────────────────────────────

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'alert' | 'shortcut';
  title: string;
  module: string;
  /** Grid position (col, row, width, height) */
  position: { col: number; row: number; w: number; h: number };
  config?: Record<string, unknown>;
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
  columns: number;
  generated_at: number;
  source: 'ai' | 'user' | 'default';
}

export interface DashboardConfigSuggestion {
  layout: DashboardLayout;
  reason: string;
  confidence: number;
}

// ── Role → Widget Templates ──────────────────────────────────────

const ROLE_WIDGET_TEMPLATES: Record<string, DashboardWidget[]> = {
  platform_admin: [
    { id: 'w_tenants', type: 'kpi', title: 'Tenants Ativos', module: 'platform', position: { col: 0, row: 0, w: 3, h: 1 } },
    { id: 'w_users', type: 'kpi', title: 'Usuários Totais', module: 'platform', position: { col: 3, row: 0, w: 3, h: 1 } },
    { id: 'w_security', type: 'alert', title: 'Alertas de Segurança', module: 'security', position: { col: 6, row: 0, w: 6, h: 2 } },
  ],
  tenant_admin: [
    { id: 'w_employees', type: 'kpi', title: 'Colaboradores', module: 'employees', position: { col: 0, row: 0, w: 4, h: 1 } },
    { id: 'w_compliance', type: 'alert', title: 'Pendências', module: 'compliance', position: { col: 4, row: 0, w: 4, h: 1 } },
    { id: 'w_payroll', type: 'chart', title: 'Folha Mensal', module: 'payroll', position: { col: 8, row: 0, w: 4, h: 2 } },
  ],
};

// ── Stub Service ─────────────────────────────────────────────────

export class DashboardAutoConfigService {
  /**
   * Generate a recommended dashboard layout for a user.
   *
   * Future: uses AI to personalise based on behavior + tenant data.
   * Current: returns role-based template.
   */
  async suggest(
    role: string,
    _behaviorProfile?: BehaviorProfile,
    _availableModules?: string[],
  ): Promise<DashboardConfigSuggestion> {
    const widgets = ROLE_WIDGET_TEMPLATES[role] ?? ROLE_WIDGET_TEMPLATES['tenant_admin'] ?? [];

    return {
      layout: {
        widgets,
        columns: 12,
        generated_at: Date.now(),
        source: 'default',
      },
      reason: `Layout padrão para o perfil "${role}". Personalização por IA será ativada em breve.`,
      confidence: 0.5,
    };
  }

  /**
   * Apply a layout to user preferences (stub).
   *
   * Future: persists to user_dashboard_preferences table.
   */
  async apply(_userId: string, _layout: DashboardLayout): Promise<void> {
    console.info('[DashboardAutoConfig] stub apply — will persist when feature is active.');
  }
}

/** Singleton */
export const dashboardAutoConfig = new DashboardAutoConfigService();
