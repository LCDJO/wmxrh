/**
 * AI Identity Assistant Module — Public API
 *
 * Future feature: LLM-powered intelligent context navigation.
 * Currently exports types and stub service with rule-based fallback.
 */

export { AIIdentityAssistantService, aiIdentityAssistant } from './ai-identity-assistant.service';

export type {
  AssistantQuery,
  AssistantResponse,
  AssistantSuggestion,
  AssistantAction,
  AssistantIntentType,
  ContextSignal,
  AssistantEvent,
  AssistantEventType,
} from './types';
