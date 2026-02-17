/**
 * OnboardingChecklist — Compact inline checklist with action buttons.
 *
 * Features:
 *   - Minimal card layout for embedding in dashboards
 *   - Complete / Skip actions per step
 *   - Inline hints for active step
 *   - Completion celebration state
 */

import {
  Check,
  SkipForward,
  Clock,
  ChevronRight,
  PartyPopper,
  Lightbulb,
  AlertTriangle,
  Sparkles,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { OnboardingStep, OnboardingHint, StepStatus } from '@/domains/adaptive-onboarding/types';

// ── Hint rendering ──────────────────────────────────────────────

const HINT_STYLE: Record<string, { icon: typeof Lightbulb; className: string }> = {
  tip: { icon: Lightbulb, className: 'bg-accent text-accent-foreground' },
  warning: { icon: AlertTriangle, className: 'bg-warning/10 text-warning' },
  recommendation: { icon: Sparkles, className: 'bg-primary/10 text-primary' },
  compliance: { icon: Info, className: 'bg-info/10 text-info' },
};

// ── Props ────────────────────────────────────────────────────────

interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  currentStepId: string | null;
  completionPct: number;
  hints?: OnboardingHint[];
  onComplete: (stepId: string) => void;
  onSkip: (stepId: string) => void;
  onStepClick?: (stepId: string) => void;
  onDismissHint?: (hintId: string) => void;
  className?: string;
}

function ChecklistIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3.5 w-3.5" />
        </div>
      );
    case 'skipped':
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SkipForward className="h-3.5 w-3.5" />
        </div>
      );
    case 'active':
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary/10">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        </div>
      );
    default:
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
          <div className="h-2 w-2 rounded-full bg-border" />
        </div>
      );
  }
}

export function OnboardingChecklist({
  steps,
  currentStepId,
  completionPct,
  hints = [],
  onComplete,
  onSkip,
  onStepClick,
  onDismissHint,
  className,
}: OnboardingChecklistProps) {
  const isFullyComplete = completionPct >= 100;
  const remainingCount = steps.filter(s => s.status === 'pending').length;
  const estimatedMinutes = steps
    .filter(s => s.status === 'pending')
    .reduce((sum, s) => sum + s.estimated_minutes, 0);

  if (isFullyComplete) {
    return (
      <div className={cn('rounded-xl border bg-card p-6 text-center space-y-3', className)}>
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-primary/10">
          <PartyPopper className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold font-display text-foreground">
          Configuração Concluída!
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Sua organização está pronta. Explore os módulos e comece a gerenciar sua equipe.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold font-display text-foreground">
            Checklist de Configuração
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>~{estimatedMinutes} min restantes</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{remainingCount} etapa{remainingCount !== 1 ? 's' : ''} restante{remainingCount !== 1 ? 's' : ''}</span>
            <span className="font-medium text-foreground">{Math.round(completionPct)}%</span>
          </div>
          <Progress value={completionPct} className="h-1.5" />
        </div>
      </div>

      {/* Step list */}
      <div className="divide-y divide-border/40">
        {steps.map(step => {
          const isActive = step.id === currentStepId;
          const isDone = step.status === 'completed' || step.status === 'skipped';
          const stepHints = hints.filter(h => h.step_id === step.id && !h.dismissed);

          return (
            <div
              key={step.id}
              className={cn(
                'px-5 py-3 transition-colors',
                isActive && 'bg-accent/30',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <ChecklistIcon status={isActive ? 'active' : step.status} />
                </div>

                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => onStepClick?.(step.id)}
                    className={cn(
                      'text-sm font-medium text-left transition-colors hover:text-primary',
                      isDone && 'line-through text-muted-foreground',
                      isActive && 'text-primary',
                    )}
                  >
                    {step.title}
                  </button>

                  {isActive && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {step.description}
                    </p>
                  )}

                  {/* Inline hints */}
                  {isActive && stepHints.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {stepHints.map(hint => {
                        const style = HINT_STYLE[hint.type] ?? HINT_STYLE.tip;
                        const HintIcon = style.icon;
                        return (
                          <button
                            key={hint.id}
                            type="button"
                            onClick={() => onDismissHint?.(hint.id)}
                            className={cn(
                              'flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px] w-full text-left',
                              style.className,
                            )}
                            title="Clique para dispensar"
                          >
                            <HintIcon className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{hint.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {isActive && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!step.is_mandatory && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSkip(step.id)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <SkipForward className="h-3 w-3 mr-1" />
                        Pular
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => onComplete(step.id)}
                      className="h-7 px-3 text-xs gap-1"
                    >
                      Concluir
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {isDone && !isActive && (
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {step.status === 'completed' ? 'Feito' : 'Pulado'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
