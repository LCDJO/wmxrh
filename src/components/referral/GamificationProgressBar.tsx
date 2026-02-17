/**
 * GamificationProgressBar — Barra de progresso do nível + pontos do usuário.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Shield, Crown, Zap } from 'lucide-react';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { GamificationProfile, GamificationLevel } from '@/domains/revenue-intelligence';
import { useAuth } from '@/contexts/AuthContext';

const TIER_ICONS: Record<string, typeof Star> = {
  bronze: Star,
  silver: Shield,
  gold: Crown,
  platinum: Trophy,
  diamond: Zap,
};

export default function GamificationProgressBar() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [levels, setLevels] = useState<GamificationLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const engine = getRevenueIntelligenceEngine();
    Promise.all([
      engine.gamification.getProfile(user.id),
      engine.gamification.getLevels(),
    ]).then(([p, l]) => {
      setProfile(p);
      setLevels(l.sort((a, b) => a.sort_order - b.sort_order));
      setLoading(false);
    });
  }, [user?.id]);

  if (loading) return <Card><CardContent className="pt-5"><Skeleton className="h-32 w-full" /></CardContent></Card>;

  const currentLevel = profile?.level ?? levels[0];
  const nextLevel = currentLevel
    ? levels.find(l => l.min_points > (currentLevel.min_points ?? 0))
    : levels[1];

  const points = profile?.total_points ?? 0;
  const currentMin = currentLevel?.min_points ?? 0;
  const nextMin = nextLevel?.min_points ?? currentMin + 1000;
  const progressPct = Math.min(100, ((points - currentMin) / (nextMin - currentMin)) * 100);

  const TierIcon = TIER_ICONS[currentLevel?.slug ?? 'bronze'] ?? Star;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> Seu Progresso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current level info */}
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center h-14 w-14 rounded-full border-2"
            style={{ borderColor: currentLevel?.color ?? 'hsl(var(--border))' }}
          >
            <TierIcon className="h-6 w-6" style={{ color: currentLevel?.color }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">{currentLevel?.name ?? 'Bronze'}</span>
              <Badge variant="outline" className="text-xs font-mono">{points} pts</Badge>
            </div>
            {nextLevel && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Faltam <span className="font-semibold text-foreground">{nextMin - points}</span> pts para{' '}
                <span className="font-semibold" style={{ color: nextLevel.color }}>{nextLevel.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <Progress value={progressPct} className="h-2.5" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{currentLevel?.name ?? 'Bronze'} ({currentMin} pts)</span>
            {nextLevel && <span>{nextLevel.name} ({nextMin} pts)</span>}
          </div>
        </div>

        {/* Badges */}
        {profile?.badges && profile.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.badges.map(badge => (
              <Badge key={badge} variant="secondary" className="text-[10px]">{badge}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
