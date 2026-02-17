/**
 * /platform/gamification — Gamification dashboard com leaderboard e tiers.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Shield, Crown, Trophy, Zap, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { GamificationLevel } from '@/domains/revenue-intelligence';
import TopReferrersLeaderboard from '@/components/platform/widgets/TopReferrersLeaderboard';

const TIER_ICONS: Record<string, typeof Star> = {
  bronze: Star,
  silver: Shield,
  gold: Crown,
  platinum: Trophy,
  diamond: Zap,
};

export default function PlatformGamification() {
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState<GamificationLevel[]>([]);

  const engine = getRevenueIntelligenceEngine();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const l = await engine.gamification.getLevels();
      setLevels(l);
    } catch {
      toast.error('Erro ao carregar gamificação');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Gamificação</h1>
          <p className="text-sm text-muted-foreground mt-1">Leaderboard, tiers e pontuação dos referrers.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { fetchAll(); toast.success('Atualizado'); }}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Tier overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Tiers de Gamificação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {levels.sort((a, b) => a.sort_order - b.sort_order).map(level => {
              const TierIcon = TIER_ICONS[level.slug] ?? Star;
              return (
                <div key={level.id} className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border">
                  <TierIcon className="h-5 w-5" style={{ color: level.color }} />
                  <div>
                    <span className="text-sm font-semibold" style={{ color: level.color }}>{level.name}</span>
                    <p className="text-[10px] text-muted-foreground">{level.min_points}+ pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Widget */}
      <TopReferrersLeaderboard limit={20} />
    </div>
  );
}
