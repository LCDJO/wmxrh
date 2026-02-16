/**
 * AIIdentityAssistantService — Future: LLM-powered context navigator
 *
 * Stub service. Full implementation will:
 *   - Accept natural language queries
 *   - Use Lovable AI Gateway (via edge function) for intent classification
 *   - Return ranked suggestions for workspace/scope/navigation changes
 *   - Learn from accepted/dismissed suggestions
 *   - Fall back to rule-based matching when AI unavailable
 */

import type {
  AssistantQuery,
  AssistantResponse,
  AssistantSuggestion,
  AssistantEvent,
  ContextSignal,
} from './types';

type AssistantListener = (event: AssistantEvent) => void;

export class AIIdentityAssistantService {
  private _listeners: AssistantListener[] = [];
  private _queryCounter = 0;

  // ── Primary API ──

  /**
   * Submit a natural language query and receive suggestions.
   * Future: calls edge function → Lovable AI Gateway → returns structured suggestions.
   */
  async query(input: AssistantQuery): Promise<AssistantResponse> {
    const queryId = `aiq_${++this._queryCounter}_${Date.now()}`;

    this._emit({
      type: 'QuerySubmitted',
      timestamp: Date.now(),
      query_id: queryId,
      metadata: { text: input.text },
    });

    // ── Stub: rule-based fallback ──
    const suggestions = this._ruleBasedSuggestions(input);

    const response: AssistantResponse = {
      query_id: queryId,
      suggestions,
      processing_time_ms: 0,
      model_used: 'rule-based-stub',
      fallback_used: true,
    };

    this._emit({
      type: 'SuggestionsReturned',
      timestamp: Date.now(),
      query_id: queryId,
      metadata: { count: suggestions.length },
    });

    return response;
  }

  /**
   * Record that a suggestion was accepted (for future learning).
   */
  acceptSuggestion(queryId: string, suggestionId: string): void {
    this._emit({
      type: 'SuggestionAccepted',
      timestamp: Date.now(),
      query_id: queryId,
      metadata: { suggestion_id: suggestionId },
    });
  }

  /**
   * Record that a suggestion was dismissed.
   */
  dismissSuggestion(queryId: string, suggestionId: string): void {
    this._emit({
      type: 'SuggestionDismissed',
      timestamp: Date.now(),
      query_id: queryId,
      metadata: { suggestion_id: suggestionId },
    });
  }

  /**
   * Build context signal from current state (to be sent to AI).
   */
  buildContextSignal(): ContextSignal {
    // Stub — in production, aggregated from navigation history + notification system
    return {
      recent_paths: [],
      frequent_tenants: [],
      local_hour: new Date().getHours(),
      day_of_week: new Date().getDay(),
      pending_alert_count: 0,
      pending_alert_tenants: [],
    };
  }

  // ── Rule-based fallback ──

  private _ruleBasedSuggestions(input: AssistantQuery): AssistantSuggestion[] {
    const text = input.text.toLowerCase().trim();
    const suggestions: AssistantSuggestion[] = [];

    // Simple keyword matching for navigation
    const navKeywords: Record<string, string> = {
      'folha': '/payroll-simulation',
      'payroll': '/payroll-simulation',
      'colaborador': '/employees',
      'employee': '/employees',
      'dashboard': '/dashboard',
      'benefício': '/benefits',
      'saúde': '/health',
      'treinamento': '/nr-compliance',
      'auditoria': '/audit',
      'remuneração': '/compensation',
    };

    for (const [keyword, path] of Object.entries(navKeywords)) {
      if (text.includes(keyword)) {
        suggestions.push({
          id: `nav_${keyword}`,
          intent: 'navigate',
          confidence: 0.7,
          label: `Ir para ${path}`,
          explanation: `Detectei que você quer acessar ${path}`,
          action: { type: 'navigate', path },
          icon_hint: 'ArrowRight',
        });
      }
    }

    // If no matches, return a noop suggestion
    if (suggestions.length === 0) {
      suggestions.push({
        id: 'noop_1',
        intent: 'unknown',
        confidence: 0.1,
        label: 'Não entendi',
        explanation: 'Tente descrever o que deseja fazer. Ex: "mostrar folha da Empresa X"',
        action: { type: 'noop', reason: 'no_match' },
        icon_hint: 'HelpCircle',
      });
    }

    return suggestions;
  }

  // ── Event Bus ──

  onEvent(listener: AssistantListener): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  private _emit(event: AssistantEvent): void {
    this._listeners.forEach(l => {
      try { l(event); } catch (e) { console.error('[AIAssistant] listener error', e); }
    });
  }
}

/** Singleton */
export const aiIdentityAssistant = new AIIdentityAssistantService();
