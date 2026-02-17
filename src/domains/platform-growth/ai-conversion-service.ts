/**
 * AIConversionService — Frontend service for the AI Conversion Designer edge function.
 *
 * Provides typed methods for:
 *  - suggestHeadlines()
 *  - organizeFAB()
 *  - optimizeCTA()
 *  - suggestLayout()
 */
import { supabase } from '@/integrations/supabase/client';

// ── Response types ──────────────────────────

export interface HeadlineSuggestion {
  text: string;
  style: 'direct' | 'question' | 'statistic' | 'emotional' | 'social_proof';
  estimated_impact: string;
  reasoning: string;
}

export interface FABBlockSuggestion {
  order: number;
  feature: string;
  advantage: string;
  benefit: string;
  section_type: string;
  impact_score: number;
}

export interface FABOrganization {
  blocks: FABBlockSuggestion[];
  strategy_notes: string;
}

export interface CTASuggestion {
  headline: string;
  button_text: string;
  subtext: string;
  urgency_element: string;
  placement: 'hero' | 'mid_page' | 'footer' | 'sticky';
  estimated_ctr: string;
}

export interface LayoutSection {
  order: number;
  section_type: string;
  title: string;
  reasoning: string;
  conversion_role: string;
}

export interface LayoutSuggestion {
  sections: LayoutSection[];
  layout_strategy: string;
  expected_improvement: string;
}

// ── Context types ───────────────────────────

export interface ConversionDesignerContext {
  industry?: string;
  modules?: string[];
  audience?: string;
  currentHeadline?: string;
  currentCTA?: string;
  currentContent?: unknown;
  features?: unknown[];
  sections?: string[];
  goal?: string;
}

// ── Service ─────────────────────────────────

class AIConversionService {

  async suggestHeadlines(ctx: ConversionDesignerContext = {}): Promise<HeadlineSuggestion[]> {
    const res = await this.call('suggest_headlines', ctx);
    return res.headlines;
  }

  async organizeFAB(ctx: ConversionDesignerContext = {}): Promise<FABOrganization> {
    return this.call('organize_fab', ctx);
  }

  async optimizeCTA(ctx: ConversionDesignerContext = {}): Promise<CTASuggestion[]> {
    const res = await this.call('optimize_cta', ctx);
    return res.ctas;
  }

  async suggestLayout(ctx: ConversionDesignerContext = {}): Promise<LayoutSuggestion> {
    return this.call('suggest_layout', ctx);
  }

  // ── Internal ──────────────────────────────

  private async call(action: string, context: ConversionDesignerContext): Promise<any> {
    const { data, error } = await supabase.functions.invoke('ai-conversion-designer', {
      body: { action, context },
    });

    if (error) {
      console.error('[AIConversionService] Edge function error:', error);
      throw new Error(error.message ?? 'AI Conversion Designer unavailable');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data?.result;
  }
}

export const aiConversionService = new AIConversionService();
