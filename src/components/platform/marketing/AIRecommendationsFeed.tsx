/**
 * AIRecommendationsFeed — Live feed of AI-generated marketing recommendations.
 * Aggregates headline suggestions, layout changes, and experiment proposals.
 */
import { useState, useEffect, useMemo } from 'react';
import { Brain, Sparkles, Layout, FlaskConical, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { landingPageBuilder } from '@/domains/platform-growth';
import { growthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
import type { LandingPage } from '@/domains/platform-growth/types';

interface FeedItem {
  id: string;
  type: 'headline' | 'layout' | 'experiment' | 'fab';
  title: string;
  description: string;
  pageName: string;
  liftPct: number;
  priority: 'high' | 'medium' | 'low';
}

const TYPE_CONFIG = {
  headline: { icon: Sparkles, label: 'Headline', color: 'text-primary' },
  layout: { icon: Layout, label: 'Layout', color: 'text-amber-400' },
  experiment: { icon: FlaskConical, label: 'A/B Test', color: 'text-emerald-400' },
  fab: { icon: Brain, label: 'FAB', color: 'text-purple-400' },
};

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export default function AIRecommendationsFeed() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  useEffect(() => { landingPageBuilder.getAll().then(setPages); }, []);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    for (const page of pages) {
      // Headlines
      const headlines = growthAISupportLayer.suggestHeadline(
        (page.blocks?.[0]?.content?.headline as string) ?? page.name,
        { pageType: 'landing' },
      );
      if (headlines.length > 0) {
      const best = headlines.reduce((a: typeof headlines[0], b: typeof headlines[0]) => a.expectedLiftPct > b.expectedLiftPct ? a : b);
        items.push({
          id: `hl-${page.id}`,
          type: 'headline',
          title: `Nova headline para "${page.name}"`,
          description: best.variant,
          pageName: page.name,
          liftPct: best.expectedLiftPct,
          priority: best.expectedLiftPct > 15 ? 'high' : 'medium',
        });
      }

      // Layout
      const layouts = growthAISupportLayer.suggestLayoutChanges(page);
      const topLayout = layouts.find(l => l.priority === 'high');
      if (topLayout) {
        items.push({
          id: `ly-${page.id}`,
          type: 'layout',
          title: topLayout.title,
          description: topLayout.description,
          pageName: page.name,
          liftPct: topLayout.expectedLiftPct,
          priority: topLayout.priority,
        });
      }

      // FAB
      const fab = growthAISupportLayer.suggestFABStructure(page);
      if (fab.missingElements.length > 0) {
        items.push({
          id: `fab-${page.id}`,
          type: 'fab',
          title: `FAB incompleto: "${page.name}"`,
          description: `Faltam: ${fab.missingElements.join(', ')}`,
          pageName: page.name,
          liftPct: fab.expectedImpact === 'high' ? 30 : 15,
          priority: fab.expectedImpact === 'high' ? 'high' : 'medium',
        });
      }
    }

    return items.sort((a, b) => b.liftPct - a.liftPct).slice(0, 10);
  }, [pages]);

  return (
    <Card className="border-border/60 bg-card/60 col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Recomendações AI
          <Badge variant="secondary" className="text-[9px] ml-auto">{feed.length} sugestões</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {feed.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma recomendação disponível.</p>
        ) : (
          <div className="space-y-2">
            {feed.map(item => {
              const config = TYPE_CONFIG[item.type];
              const Icon = config.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/40 hover:border-primary/30 transition-colors"
                >
                  <div className="h-7 w-7 rounded-md flex items-center justify-center bg-muted/40 shrink-0">
                    <Icon className={cn('h-3.5 w-3.5', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                      <Badge variant="outline" className={cn('text-[8px] shrink-0 border', PRIORITY_BADGE[item.priority])}>
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 shrink-0 font-semibold">
                    +{item.liftPct}%
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
