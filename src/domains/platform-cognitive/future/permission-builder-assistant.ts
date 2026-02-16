/**
 * PermissionBuilderAssistant — Future: AI-powered assistant inside the Permission Builder.
 *
 * Planned capabilities:
 *   - Natural language role creation: "Crie um cargo de analista financeiro"
 *   - Auto-suggest permissions based on role name and department context
 *   - Warn about excessive privileges in real-time as user toggles permissions
 *   - Compare role against industry best-practices (via AI)
 *   - Explain what each permission grants in plain language
 *
 * SECURITY CONTRACT:
 *   This assistant is READ-ONLY. It generates suggestions that MUST be
 *   confirmed by the user in the VisualPermissionBuilder UI. It NEVER
 *   writes roles, permissions, or any data directly.
 */

import type { CognitiveSuggestion, CognitiveResponse } from '../types';

// ── Types ────────────────────────────────────────────────────────

export interface PermissionAssistantQuery {
  /** Natural language input from the user */
  text: string;
  /** Current role being edited (if any) */
  current_role?: {
    name: string;
    slug: string;
    permission_codes: string[];
  };
  /** Available permissions in the system */
  available_permissions: { code: string; module: string; description: string | null }[];
  /** Tenant context */
  tenant_id: string;
}

export interface PermissionAssistantSuggestion extends CognitiveSuggestion {
  /** Permission codes to toggle on/off */
  permission_codes?: string[];
  /** Whether this suggestion adds or removes permissions */
  action: 'add' | 'remove' | 'info' | 'warn';
}

export interface PermissionAssistantResponse {
  suggestions: PermissionAssistantSuggestion[];
  explanation: string;
  risk_level: 'low' | 'medium' | 'high' | 'none';
}

// ── Stub Service ─────────────────────────────────────────────────

export class PermissionBuilderAssistant {
  /**
   * Query the assistant with natural language inside the Permission Builder.
   *
   * Future: calls CognitiveInsightsService with intent 'permission-builder-assist'
   * and returns structured suggestions for the builder UI.
   */
  async query(input: PermissionAssistantQuery): Promise<PermissionAssistantResponse> {
    // Stub — returns empty suggestions until AI integration is wired
    console.info('[PermissionBuilderAssistant] stub query:', input.text);

    return {
      suggestions: [],
      explanation: 'Assistente de permissões será ativado em breve.',
      risk_level: 'none',
    };
  }

  /**
   * Analyse current permission set and warn about risks in real-time.
   *
   * Future: runs rule-based checks locally, with optional AI enhancement.
   */
  analyseRiskRealtime(permissionCodes: string[]): { risk_level: 'low' | 'medium' | 'high'; warnings: string[] } {
    const warnings: string[] = [];
    const sensitive = permissionCodes.filter(c => /delete|admin|salary|payroll/i.test(c));

    if (sensitive.length > 3) {
      warnings.push(`${sensitive.length} permissões sensíveis ativas — revise se necessário.`);
    }

    return {
      risk_level: sensitive.length > 5 ? 'high' : sensitive.length > 2 ? 'medium' : 'low',
      warnings,
    };
  }
}

/** Singleton */
export const permissionBuilderAssistant = new PermissionBuilderAssistant();
