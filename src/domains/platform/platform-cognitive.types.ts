export type CognitiveIntent =
  | "suggest-permissions"
  | "recommend-dashboards"
  | "suggest-shortcuts"
  | "detect-patterns"
  | "quick-setup";

export interface CognitiveSuggestion {
  id: string;
  type: "permission" | "dashboard" | "shortcut" | "pattern" | "setup";
  title: string;
  description: string;
  confidence: number;
  action_label?: string;
  metadata?: Record<string, unknown>;
}

export interface CognitiveResponse {
  suggestions: CognitiveSuggestion[];
  summary: string;
}
