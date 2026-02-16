/**
 * PlanBadge — Displays the current plan tier as a styled badge.
 *
 * Usage:
 *   <PlanBadge tier="pro" />
 *   <PlanBadge tier="enterprise" size="lg" />
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Crown, Sparkles, Zap, Star } from 'lucide-react';

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise' | 'custom';

interface PlanBadgeProps {
  tier: string;
  planName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TIER_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  classes: string;
}> = {
  free: {
    label: 'Free',
    icon: Zap,
    classes: 'bg-muted text-muted-foreground border-border',
  },
  starter: {
    label: 'Starter',
    icon: Star,
    classes: 'bg-info/10 text-info border-info/30',
  },
  pro: {
    label: 'Pro',
    icon: Sparkles,
    classes: 'bg-primary/10 text-primary border-primary/30',
  },
  enterprise: {
    label: 'Enterprise',
    icon: Crown,
    classes: 'bg-warning/10 text-warning border-warning/30',
  },
  custom: {
    label: 'Custom',
    icon: Crown,
    classes: 'bg-accent text-accent-foreground border-accent-foreground/20',
  },
};

const SIZE_CLASSES = {
  sm: 'text-[10px] px-1.5 py-0 gap-0.5',
  md: 'text-xs px-2 py-0.5 gap-1',
  lg: 'text-sm px-3 py-1 gap-1.5',
};

export function PlanBadge({ tier, planName, size = 'md', className }: PlanBadgeProps) {
  const normalizedTier = tier.toLowerCase();
  const config = TIER_CONFIG[normalizedTier] ?? TIER_CONFIG.custom;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center font-semibold border',
        config.classes,
        SIZE_CLASSES[size],
        className,
      )}
    >
      <Icon className={cn(
        size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5',
      )} />
      {planName ?? config.label}
    </Badge>
  );
}
