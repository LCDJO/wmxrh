/**
 * CognitiveHint — Inline contextual hint powered by cognitive layer.
 * Lightweight banner showing a single AI-generated tip or observation.
 *
 * SECURITY: This component is display-only. It shows suggestions
 * but NEVER executes any mutation. Actions require explicit user click.
 *
 * Usage:
 *   <CognitiveHint message="Este cargo possui acesso financeiro elevado." />
 *   <CognitiveHint message="..." severity="warn" dismissible />
 */
import { useState } from 'react';
import { Lightbulb, AlertTriangle, Info, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type Severity = 'info' | 'warn' | 'success';

interface Props {
  message: string;
  severity?: Severity;
  dismissible?: boolean;
  className?: string;
  icon?: React.ReactNode;
  /** Optional action label + callback */
  actionLabel?: string;
  onAction?: () => void;
}

const SEVERITY_STYLES: Record<Severity, { container: string; icon: string; IconComp: React.ElementType }> = {
  info: {
    container: 'border-primary/20 bg-primary/[0.04]',
    icon: 'text-primary',
    IconComp: Lightbulb,
  },
  warn: {
    container: 'border-warning/25 bg-warning/[0.04]',
    icon: 'text-warning',
    IconComp: AlertTriangle,
  },
  success: {
    container: 'border-success/25 bg-success/[0.04]',
    icon: 'text-success',
    IconComp: Info,
  },
};

export function CognitiveHint({
  message,
  severity = 'info',
  dismissible = false,
  className,
  icon,
  actionLabel,
  onAction,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const style = SEVERITY_STYLES[severity];
  const Icon = style.IconComp;

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 animate-fade-in',
        style.container,
        className,
      )}
    >
      <div className={cn('shrink-0 mt-0.5', style.icon)}>
        {icon ?? <Icon className="h-4 w-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Sparkles className="h-2.5 w-2.5 text-muted-foreground" />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Insight cognitivo
          </span>
        </div>
        <p className="text-xs text-card-foreground leading-relaxed">{message}</p>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-1.5 text-[11px] font-medium text-primary hover:underline"
          >
            {actionLabel} →
          </button>
        )}
      </div>

      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
