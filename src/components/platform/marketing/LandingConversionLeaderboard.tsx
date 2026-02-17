/**
 * LandingConversionLeaderboard — Ranked table of landing pages by conversion rate.
 */
import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import type { PageRanking } from '@/domains/platform-growth/autonomous-marketing';

export default function LandingConversionLeaderboard() {
  const [data, setData] = useState<PageRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: result, error } = await supabase.functions.invoke('top-conversions', {
          method: 'GET',
          body: null,
        });
        if (!error && result?.top_by_conversion) {
          setData(result.top_by_conversion);
        }
      } catch (e) {
        console.error('Leaderboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getRankBadge = (i: number) => {
    if (i === 0) return <span className="text-lg">🥇</span>;
    if (i === 1) return <span className="text-lg">🥈</span>;
    if (i === 2) return <span className="text-lg">🥉</span>;
    return <span className="text-xs font-bold text-muted-foreground w-6 text-center">#{i + 1}</span>;
  };

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-primary" />
          Conversion Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado de conversão disponível.</p>
        ) : (
          <div className="space-y-2">
            {data.map((page, i) => (
              <div
                key={page.landing_page_id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
              >
                <div className="flex-shrink-0 w-8 flex items-center justify-center">
                  {getRankBadge(i)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{page.page_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {page.page_views.toLocaleString()} views · {page.signups_completed} signups
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-primary">{page.conversion_rate}%</p>
                  <p className="text-xs text-muted-foreground">CTR {page.ctr}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
