/**
 * CognitiveSuggestionCard — Reusable card for a single CognitiveSuggestion.
 * Follows the design system tokens and supports interactive actions.
 *
 * SECURITY: This component is display-only. Actions passed via onAction
 * are triggered ONLY by explicit user click — never automatically.
 *
 * Usage:
 *   <CognitiveSuggestionCard suggestion={s} onAction={() => apply(s)} />
 */
import type { CognitiveSuggestion } from '@/domains/platform-cognitive/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Shield, LayoutDashboard, Zap, TrendingUp, Settings, Lightbulb, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<string, React.ElementType> = {
  permission: Shield,
  dashboard: LayoutDashboard,
  shortcut: Zap,
  pattern: TrendingUp,
  setup: Settings,
};

function confidenceTier(c: number) {
  if (c >= 0.75) return { label: 'Alta', cls: 'bg-success/15 text-success border-success/30' };
  if (c >= 0.45) return { label: 'Média', cls: 'bg-warning/15 text-warning border-warning/30' };
  return { label: 'Baixa', cls: 'bg-muted text-muted-foreground border-border' };
}

interface Props {
  suggestion: CognitiveSuggestion;
  onAction?: () => void;
  compact?: boolean;
  className?: string;
}

export function CognitiveSuggestionCard({ suggestion: s, onAction, compact = false, className }: Props) {
  const Icon = TYPE_ICON[s.type] ?? Lightbulb;
  const tier = confidenceTier(s.confidence);

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-md border border-border/50 px-3 py-2 hover:bg-muted/30 transition-colors',
          className,
        )}
      >
        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-card-foreground truncate">{s.title}</p>
        </div>
        <Badge variant="outline" className={cn('text-[8px] shrink-0', tier.cls)}>
          {Math.round(s.confidence * 100)}%
        </Badge>
        {onAction && (
          <button onClick={onAction} className="shrink-0 text-primary hover:text-primary/80">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 p-3.5 space-y-2 hover:shadow-card-hover transition-all',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-card-foreground leading-snug">{s.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>
        </div>
        <Badge variant="outline" className={cn('text-[9px] shrink-0', tier.cls)}>
          {tier.label} · {Math.round(s.confidence * 100)}%
        </Badge>
      </div>

      {(s.action_label || onAction) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-primary hover:text-primary/80"
          onClick={onAction}
        >
          {s.action_label ?? 'Aplicar'} <ChevronRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
