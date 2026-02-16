/**
 * PlanRestrictedFeature — Wraps content that requires a specific plan tier.
 *
 * If the user's plan is insufficient, shows a lock overlay with upgrade CTA.
 * If the user's plan is sufficient, renders children normally.
 *
 * Usage:
 *   <PlanRestrictedFeature requiredTier="pro" currentTier="free">
 *     <ExpensiveFeatureComponent />
 *   </PlanRestrictedFeature>
 */

import { cn } from '@/lib/utils';
import { PlanBadge } from './PlanBadge';
import { Button } from '@/components/ui/button';
import { Lock, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

const TIER_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
  custom: 4,
};

interface PlanRestrictedFeatureProps {
  requiredTier: string;
  currentTier: string;
  featureLabel?: string;
  onUpgradeClick?: () => void;
  /** Render children even when restricted (blurred) */
  showPreview?: boolean;
  children: ReactNode;
  className?: string;
}

function tierLevel(tier: string): number {
  return TIER_ORDER[tier.toLowerCase()] ?? 0;
}

export function PlanRestrictedFeature({
  requiredTier,
  currentTier,
  featureLabel,
  onUpgradeClick,
  showPreview = true,
  children,
  className,
}: PlanRestrictedFeatureProps) {
  const hasAccess = tierLevel(currentTier) >= tierLevel(requiredTier);

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative rounded-lg', className)}>
      {/* Blurred preview or hidden content */}
      {showPreview ? (
        <div className="pointer-events-none select-none" aria-hidden="true">
          <div className="blur-[3px] opacity-50">
            {children}
          </div>
        </div>
      ) : (
        <div className="h-32" />
      )}

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs px-4">
          <div className="rounded-full bg-muted p-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {featureLabel ?? 'Recurso restrito'}
            </p>
            <p className="text-xs text-muted-foreground">
              Disponível a partir do plano{' '}
              <PlanBadge tier={requiredTier} size="sm" className="inline-flex align-middle" />
            </p>
          </div>

          {onUpgradeClick && (
            <Button
              size="sm"
              variant="outline"
              onClick={onUpgradeClick}
              className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
            >
              Fazer upgrade
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
