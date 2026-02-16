/**
 * UpgradePrompt — Cognitive-powered card suggesting a plan upgrade.
 *
 * Usage:
 *   <UpgradePrompt
 *     currentTier="free"
 *     suggestedTier="pro"
 *     reason="Seu uso indica que o plano PRO pode ser mais adequado."
 *     onUpgradeClick={() => navigate('/platform/plans')}
 *   />
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlanBadge } from './PlanBadge';
import { cn } from '@/lib/utils';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

interface UpgradePromptProps {
  currentTier: string;
  suggestedTier: string;
  reason: string;
  onUpgradeClick?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function UpgradePrompt({
  currentTier,
  suggestedTier,
  reason,
  onUpgradeClick,
  onDismiss,
  className,
}: UpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Card className={cn(
      'relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-background to-accent/10',
      className,
    )}>
      {/* Decorative accent line */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-primary/60 to-accent" />

      <CardContent className="flex items-start gap-4 p-4">
        {/* Icon */}
        <div className="flex-shrink-0 rounded-lg bg-primary/10 p-2.5">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">Sugestão de upgrade</span>
            <PlanBadge tier={currentTier} size="sm" />
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <PlanBadge tier={suggestedTier} size="sm" />
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {reason}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={onUpgradeClick}
              className="h-8 text-xs"
            >
              Ver planos
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 text-xs text-muted-foreground"
            >
              Agora não
            </Button>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
