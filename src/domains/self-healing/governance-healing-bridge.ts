/**
 * GovernanceHealingBridge — Connects Self-Healing incidents to GovernanceAI.
 *
 * When an incident with severity ≥ major is detected, the bridge asks
 * GovernanceAI to produce permission-related suggestions for the affected
 * modules. Suggestions are emitted as GovernanceRiskDetected events and
 * stored locally so the UI can display them.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CRITICAL INVARIANT:                                            ║
 * ║  This bridge NEVER mutates permissions. It only SUGGESTS.       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { Incident } from './types';
import { emitGovernanceEvent } from '@/domains/governance-ai/governance-events';
import type { GovernanceInsight, InsightSeverity } from '@/domains/governance-ai/types';

// ── Suggestion type ────────────────────────────────────────────

export interface GovernanceHealingSuggestion {
  id: string;
  incident_id: string;
  module_id: string;
  severity: InsightSeverity;
  suggestion: string;
  created_at: number;
  acknowledged: boolean;
}

// ── Bridge ─────────────────────────────────────────────────────

const MAX_SUGGESTIONS = 200;

let _suggestionCounter = 0;

export class GovernanceHealingBridge {
  private suggestions: GovernanceHealingSuggestion[] = [];
  private listeners = new Set<() => void>();

  /**
   * Called by SelfHealingEngine when an incident is detected.
   * Only acts on major/critical incidents.
   */
  evaluate(incident: Incident): void {
    if (incident.severity === 'minor') return;

    for (const moduleId of incident.affected_modules) {
      const suggestion = this.buildSuggestion(incident, moduleId);
      this.suggestions.push(suggestion);

      // Emit as GovernanceRiskDetected so existing dashboards pick it up
      const insight: GovernanceInsight = {
        id: suggestion.id,
        category: 'anomalous_pattern',
        title: `Revisar permissões: ${moduleId}`,
        description: suggestion.suggestion,
        severity: incident.severity === 'critical' ? 'critical' : 'warning',
        confidence: 0.85,
        affected_entities: [
          { type: 'module' as any, id: moduleId, label: moduleId },
        ],
        recommendation: `Auditar permissões administrativas do módulo "${moduleId}" e aplicar princípio de menor privilégio.`,
        auto_remediable: false,
        source: 'heuristic',
        detected_at: Date.now(),
      };

      emitGovernanceEvent({
        type: 'GovernanceRiskDetected',
        timestamp: Date.now(),
        severity: insight.severity,
        insight_count: 1,
        critical_count: insight.severity === 'critical' ? 1 : 0,
        warning_count: insight.severity === 'warning' ? 1 : 0,
        top_insight: {
          id: insight.id,
          category: insight.category,
          title: insight.title,
          severity: insight.severity,
          confidence: insight.confidence,
        },
      });
    }

    // Trim
    if (this.suggestions.length > MAX_SUGGESTIONS) {
      this.suggestions.splice(0, this.suggestions.length - MAX_SUGGESTIONS);
    }

    this.notify();
  }

  /** Get all suggestions, optionally filtered by module. */
  getSuggestions(moduleId?: string): ReadonlyArray<GovernanceHealingSuggestion> {
    if (moduleId) return this.suggestions.filter(s => s.module_id === moduleId);
    return [...this.suggestions];
  }

  /** Get only unacknowledged suggestions. */
  getPending(): ReadonlyArray<GovernanceHealingSuggestion> {
    return this.suggestions.filter(s => !s.acknowledged);
  }

  /** Mark a suggestion as acknowledged (no mutation, just visibility). */
  acknowledge(suggestionId: string): void {
    const s = this.suggestions.find(x => x.id === suggestionId);
    if (s) {
      s.acknowledged = true;
      this.notify();
    }
  }

  onUpdate(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ── Internal ──────────────────────────────────────────────────

  private buildSuggestion(incident: Incident, moduleId: string): GovernanceHealingSuggestion {
    _suggestionCounter++;

    const severityText = incident.severity === 'critical'
      ? 'risco crítico'
      : 'risco elevado';

    return {
      id: `gov-heal-${_suggestionCounter}-${Date.now()}`,
      incident_id: incident.id,
      module_id: moduleId,
      severity: incident.severity === 'critical' ? 'critical' : 'warning',
      suggestion: `Módulo "${moduleId}" apresentou ${severityText} (incidente: ${incident.title}). ` +
        `Revisar permissões administrativas relacionadas a este módulo. ` +
        `Recomenda-se verificar acessos elevados e aplicar princípio de menor privilégio.`,
      created_at: Date.now(),
      acknowledged: false,
    };
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }
}
