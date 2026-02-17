/**
 * GrowthHeatmap — Visual heatmap of conversion performance across landing pages.
 * Shows a grid where color intensity represents conversion rate.
 */
import { useState, useEffect, useMemo } from 'react';
import { Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { landingPageBuilder } from '@/domains/platform-growth';
import type { LandingPage } from '@/domains/platform-growth/types';

function rateToColor(rate: number): string {
  if (rate >= 8) return 'bg-emerald-500/80 text-white';
  if (rate >= 5) return 'bg-emerald-500/50 text-foreground';
  if (rate >= 3) return 'bg-amber-500/40 text-foreground';
  if (rate >= 1) return 'bg-amber-500/20 text-foreground';
  return 'bg-muted/30 text-muted-foreground';
}

export default function GrowthHeatmap() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  useEffect(() => { landingPageBuilder.getAll().then(setPages); }, []);

  const sorted = useMemo(
    () => [...pages].sort((a, b) => b.analytics.conversionRate - a.analytics.conversionRate),
    [pages],
  );

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Flame className="h-4 w-4 text-primary" />
          Heatmap de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma landing page registrada.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {sorted.map(page => (
              <div
                key={page.id}
                className={cn(
                  'rounded-lg p-3 flex flex-col justify-between min-h-[80px] transition-colors',
                  rateToColor(page.analytics.conversionRate),
                )}
              >
                <p className="text-[10px] font-medium truncate">{page.name}</p>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-lg font-bold leading-none">
                    {page.analytics.conversionRate}%
                  </span>
                  <Badge variant="outline" className="text-[8px] bg-background/20 border-white/20">
                    {page.analytics.views} views
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
