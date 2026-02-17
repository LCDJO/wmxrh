/**
 * Smart Announcements — AI-driven announcement suggestions.
 *
 * Uses tenant data patterns and health scores to proactively
 * suggest announcements before problems escalate.
 *
 * Future: calls Lovable AI (Gemini) via edge function to
 * generate context-aware recommendations.
 */

import type { TenantHealthScore, HealthDimension } from '../sla/sla-alert-engine';
import type { AlertType, Severity } from '../announcement-hub';

// ══════════════════════════════════════════════════════════════
// AI Suggestion Types
// ══════════════════════════════════════════════════════════════

export type SuggestionSource =
  | 'health_score_drop'
  | 'compliance_gap'
  | 'usage_pattern'
  | 'billing_risk'
  | 'seasonal_reminder'
  | 'trend_anomaly';

export interface AnnouncementSuggestion {
  id: string;
  source: SuggestionSource;
  confidence: number; // 0-1
  /** Pre-filled announcement data */
  suggested_title: string;
  suggested_message: string;
  suggested_alert_type: AlertType;
  suggested_severity: Severity;
  /** Why the AI suggests this */
  reasoning: string;
  /** Data points that informed this suggestion */
  evidence: SuggestionEvidence[];
  /** Suggested target */
  target_tenant_id?: string;
  target_plan_id?: string;
  /** When this suggestion was generated */
  generated_at: string;
  /** Whether a human has reviewed this */
  reviewed: boolean;
  reviewed_by?: string;
  /** Accept/reject/modify */
  decision?: 'accepted' | 'rejected' | 'modified';
}

export interface SuggestionEvidence {
  metric: string;
  current_value: string;
  expected_value?: string;
  dimension?: HealthDimension;
  timestamp?: string;
}

// ══════════════════════════════════════════════════════════════
// AI Engine Interface
// ══════════════════════════════════════════════════════════════

export interface SmartAnnouncementEngine {
  /** Generate suggestions based on current tenant data */
  generateSuggestions(context: SuggestionContext): Promise<AnnouncementSuggestion[]>;

  /** Record decision on a suggestion (for AI learning) */
  recordDecision(
    suggestionId: string,
    decision: 'accepted' | 'rejected' | 'modified',
    reviewedBy: string,
    modifications?: Partial<AnnouncementSuggestion>,
  ): Promise<void>;

  /** Get pending (unreviewed) suggestions */
  getPendingSuggestions(tenantId?: string): Promise<AnnouncementSuggestion[]>;
}

export interface SuggestionContext {
  tenant_id: string;
  health_score?: TenantHealthScore;
  /** Recent events that may trigger suggestions */
  recent_events?: {
    type: string;
    count: number;
    last_occurred: string;
  }[];
  /** Current active announcements (to avoid duplicates) */
  active_announcement_count?: number;
  /** Locale for generated text */
  locale?: string;
}

// ══════════════════════════════════════════════════════════════
// Source → prompt mapping (for future Lovable AI integration)
// ══════════════════════════════════════════════════════════════

export const SUGGESTION_SOURCE_CONFIG: Record<SuggestionSource, {
  label: string;
  icon: string;
  prompt_hint: string;
}> = {
  health_score_drop: {
    label: 'Queda no Health Score',
    icon: 'TrendingDown',
    prompt_hint: 'O score de saúde do tenant caiu significativamente. Analise as dimensões afetadas e sugira um aviso preventivo.',
  },
  compliance_gap: {
    label: 'Gap de Conformidade',
    icon: 'ShieldAlert',
    prompt_hint: 'Foram detectadas pendências de conformidade (exames vencidos, documentos faltantes). Sugira um aviso com ações corretivas.',
  },
  usage_pattern: {
    label: 'Padrão de Uso Anômalo',
    icon: 'Activity',
    prompt_hint: 'O padrão de uso do tenant mudou significativamente. Sugira um aviso contextual.',
  },
  billing_risk: {
    label: 'Risco de Faturamento',
    icon: 'CreditCard',
    prompt_hint: 'Indicadores de risco de inadimplência detectados. Sugira um aviso preventivo de billing.',
  },
  seasonal_reminder: {
    label: 'Lembrete Sazonal',
    icon: 'Calendar',
    prompt_hint: 'Período sazonal relevante (dissídio, 13o, férias coletivas). Sugira um lembrete proativo.',
  },
  trend_anomaly: {
    label: 'Anomalia de Tendência',
    icon: 'AlertTriangle',
    prompt_hint: 'Tendência anômala detectada nos dados do tenant. Sugira um aviso investigativo.',
  },
};
