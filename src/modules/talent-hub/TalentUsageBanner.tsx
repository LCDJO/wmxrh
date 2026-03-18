import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PlanBadge } from '@/components/shared/PlanBadge';
import type { TalentUsageSnapshot } from './monetization-data';
import { getTalentUsagePercentage } from './monetization-data';

interface TalentUsageBannerProps {
  snapshot: TalentUsageSnapshot;
  onOpenMonetization: () => void;
}

export function TalentUsageBanner({ snapshot, onOpenMonetization }: TalentUsageBannerProps) {
  const candidateUsage = getTalentUsagePercentage(snapshot.usage.candidatesUsed, snapshot.usage.candidatesLimit);
  const jobsUsage = getTalentUsagePercentage(snapshot.usage.activeJobsUsed, snapshot.usage.activeJobsLimit);
  const creditsUsage = getTalentUsagePercentage(snapshot.usage.creditsUsed, snapshot.usage.creditsIncluded);

  return (
    <Card className="overflow-hidden rounded-[24px] border-primary/20 bg-card shadow-card">
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <PlanBadge tier={snapshot.currentTier} planName={`Plano ${snapshot.currentPlanName}`} />
            {snapshot.trialDaysLeft > 0 && (
              <Badge className="rounded-full border-transparent bg-accent px-3 py-1 text-accent-foreground">
                Trial · {snapshot.trialDaysLeft} dias restantes
              </Badge>
            )}
          </div>

          <div>
            <p className="text-lg font-semibold text-foreground">Monetização ativa do Talent Intelligence Hub</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshot.upsellReason} Upgrade recomendado para <span className="font-medium text-foreground">{snapshot.recommendedTier === 'pro' ? 'Profissional' : 'Enterprise'}</span>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {snapshot.lockedFeatures.map((feature) => (
              <Badge key={feature} variant="outline" className="rounded-full bg-background">
                <Sparkles className="mr-1 h-3 w-3" />
                {feature}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          {[
            {
              label: 'Candidatos',
              value: `${snapshot.usage.candidatesUsed}/${snapshot.usage.candidatesLimit}`,
              progress: candidateUsage,
            },
            {
              label: 'Vagas ativas',
              value: `${snapshot.usage.activeJobsUsed}/${snapshot.usage.activeJobsLimit}`,
              progress: jobsUsage,
            },
            {
              label: 'Créditos mensais',
              value: `${snapshot.usage.creditsUsed}/${snapshot.usage.creditsIncluded}`,
              progress: creditsUsage,
            },
          ].map((item) => (
            <div key={item.label} className="space-y-2 rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="text-muted-foreground">{item.value}</span>
              </div>
              <Progress value={item.progress} />
            </div>
          ))}

          <Button onClick={onOpenMonetization} className="rounded-xl">
            Ver pricing e upsell
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
