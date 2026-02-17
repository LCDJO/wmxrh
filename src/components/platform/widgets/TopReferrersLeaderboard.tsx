/**
 * TopReferrersLeaderboard — Ranking dos melhores referrers com gamificação.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Shield, Crown, Zap } from 'lucide-react';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { GamificationLeaderboardEntry } from '@/domains/revenue-intelligence';

const TIER_COLORS: Record<string, string> = {
  bronze: 'hsl(30 60% 50%)',
  silver: 'hsl(0 0% 65%)',
  gold: 'hsl(45 90% 50%)',
  platinum: 'hsl(200 30% 60%)',
  diamond: 'hsl(200 80% 60%)',
};

const TIER_ICONS: Record<string, typeof Star> = {
  bronze: Star,
  silver: Shield,
  gold: Crown,
  platinum: Trophy,
  diamond: Zap,
};

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export default function TopReferrersLeaderboard({ limit = 10 }: { limit?: number }) {
  const [data, setData] = useState<GamificationLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const engine = getRevenueIntelligenceEngine();
    engine.gamification.getLeaderboard(limit).then(d => { setData(d); setLoading(false); });
  }, [limit]);

  if (loading) return <Card><CardContent className="pt-5"><Skeleton className="h-[400px] w-full" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> Top Referrers — Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Sem dados no leaderboard.</p>
        ) : (
          <div className="space-y-2">
            {data.map((entry, idx) => {
              const color = TIER_COLORS[entry.current_tier] ?? 'hsl(var(--muted-foreground))';
              const TierIcon = TIER_ICONS[entry.current_tier] ?? Star;
              const isTop3 = idx < 3;
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                    isTop3 ? 'border-primary/30 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div
                    className="flex items-center justify-center h-9 w-9 rounded-full border-2 text-sm font-bold shrink-0"
                    style={{ borderColor: color, color }}
                  >
                    {idx + 1}
                  </div>
                  <TierIcon className="h-4 w-4 shrink-0" style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {entry.user_id.slice(0, 12)}…
                    </p>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                      <span>{entry.total_referrals} referrals</span>
                      <span>{entry.total_conversions} conversões</span>
                      <span>{formatBRL(entry.total_reward_brl)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{entry.total_points} pts</p>
                    <Badge variant="outline" className="text-[10px] capitalize" style={{ borderColor: color, color }}>
                      {entry.current_tier}
                    </Badge>
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
