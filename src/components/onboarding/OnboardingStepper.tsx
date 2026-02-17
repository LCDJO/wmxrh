/**
 * OnboardingStepper — Premium vertical stepper grouped by phase.
 *
 * Renders the full onboarding flow with:
 *   - Phase grouping with icons
 *   - Step status indicators (pending, active, completed, skipped)
 *   - Progress bar
 *   - Experience hints per step
 *   - Click-to-navigate between steps
 */

import { useMemo } from 'react';
import {
  Check,
  Circle,
  SkipForward,
  Sparkles,
  Building2,
  Shield,
  Puzzle,
  UserPlus,
  ClipboardCheck,
  CheckCircle,
  ChevronRight,
  Clock,
  Lightbulb,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { OnboardingFlow, OnboardingStep, OnboardingPhase, OnboardingHint, StepStatus } from '@/domains/adaptive-onboarding/types';

// ── Phase Config ────────────────────────────────────────────────

const PHASE_META: Record<OnboardingPhase, { label: string; icon: typeof Sparkles }> = {
  welcome: { label: 'Boas-vindas', icon: Sparkles },
  company_setup: { label: 'Configuração da Empresa', icon: Building2 },
  role_setup: { label: 'Papéis e Permissões', icon: Shield },
  module_activation: { label: 'Módulos', icon: Puzzle },
  team_invite: { label: 'Equipe', icon: UserPlus },
  compliance_check: { label: 'Compliance', icon: ClipboardCheck },
  review: { label: 'Revisão', icon: CheckCircle },
  completed: { label: 'Concluído', icon: CheckCircle },
};

const HINT_ICONS: Record<string, typeof Lightbulb> = {
  tip: Lightbulb,
  warning: AlertTriangle,
  recommendation: Sparkles,
  compliance: Info,
};

const HINT_COLORS: Record<string, string> = {
  tip: 'bg-accent text-accent-foreground',
  warning: 'bg-warning/10 text-warning',
  recommendation: 'bg-primary/10 text-primary',
  compliance: 'bg-info/10 text-info',
};

// ── Status Icon ─────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Check className="h-4 w-4" />
        </div>
      );
    case 'active':
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-primary animate-pulse">
          <Circle className="h-3 w-3 fill-primary" />
        </div>
      );
    case 'skipped':
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SkipForward className="h-4 w-4" />
        </div>
      );
    default:
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground">
          <Circle className="h-3 w-3" />
        </div>
      );
  }
}

// ── Props ────────────────────────────────────────────────────────

interface OnboardingStepperProps {
  flow: OnboardingFlow;
  currentStepId: string | null;
  hints?: OnboardingHint[];
  onStepClick?: (stepId: string) => void;
  onSkip?: (stepId: string) => void;
  onComplete?: (stepId: string) => void;
  className?: string;
}

export function OnboardingStepper({
  flow,
  currentStepId,
  hints = [],
  onStepClick,
  className,
}: OnboardingStepperProps) {
  // Group steps by phase
  const phaseGroups = useMemo(() => {
    const groups: { phase: OnboardingPhase; steps: OnboardingStep[] }[] = [];
    const seen = new Set<OnboardingPhase>();

    for (const step of flow.steps) {
      if (!seen.has(step.phase)) {
        seen.add(step.phase);
        groups.push({ phase: step.phase, steps: [] });
      }
      groups.find(g => g.phase === step.phase)!.steps.push(step);
    }
    return groups;
  }, [flow.steps]);

  const completedCount = flow.steps.filter(s => s.status === 'completed').length;
  const totalCount = flow.steps.length;

  return (
    <TooltipProvider>
      <div className={cn('space-y-6', className)}>
        {/* ── Header with progress ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold font-display text-foreground">
                Configuração Inicial
              </h2>
              <p className="text-sm text-muted-foreground">
                {completedCount} de {totalCount} etapas concluídas
              </p>
            </div>
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 font-medium">
              <Clock className="h-3.5 w-3.5" />
              ~{flow.estimated_total_minutes} min
            </Badge>
          </div>
          <Progress value={flow.completion_pct} className="h-2" />
        </div>

        {/* ── Phase groups ── */}
        <div className="space-y-4">
          {phaseGroups.map(({ phase, steps }) => {
            const meta = PHASE_META[phase];
            const PhaseIcon = meta.icon;
            const allCompleted = steps.every(s => s.status === 'completed' || s.status === 'skipped');
            const hasActive = steps.some(s => s.id === currentStepId);

            return (
              <div
                key={phase}
                className={cn(
                  'rounded-xl border bg-card transition-all duration-200',
                  hasActive && 'border-primary/30 shadow-card-hover ring-1 ring-primary/10',
                  !hasActive && allCompleted && 'border-border/60 opacity-80',
                )}
              >
                {/* Phase header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg',
                      allCompleted
                        ? 'bg-primary/10 text-primary'
                        : hasActive
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <PhaseIcon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold font-display text-foreground">
                    {meta.label}
                  </span>
                  {allCompleted && (
                    <Check className="ml-auto h-4 w-4 text-primary" />
                  )}
                </div>

                {/* Steps */}
                <div className="px-4 py-2">
                  {steps.map((step, idx) => {
                    const isActive = step.id === currentStepId;
                    const stepHints = hints.filter(h => h.step_id === step.id && !h.dismissed);

                    return (
                      <div key={step.id}>
                        <button
                          type="button"
                          onClick={() => onStepClick?.(step.id)}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors',
                            'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isActive && 'bg-accent/40',
                          )}
                        >
                          {/* Status icon + connector line */}
                          <div className="flex flex-col items-center">
                            <StepStatusIcon status={isActive ? 'active' : step.status} />
                            {idx < steps.length - 1 && (
                              <div
                                className={cn(
                                  'w-0.5 flex-1 min-h-[16px] mt-1',
                                  step.status === 'completed' ? 'bg-primary/40' : 'bg-border',
                                )}
                              />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  step.status === 'completed' && 'text-muted-foreground line-through',
                                  isActive && 'text-primary font-semibold',
                                  step.status === 'pending' && 'text-foreground',
                                  step.status === 'skipped' && 'text-muted-foreground',
                                )}
                              >
                                {step.title}
                              </span>
                              {step.is_mandatory && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      Obrigatório
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>Esta etapa é obrigatória</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {step.description}
                            </p>

                            {/* Hints */}
                            {isActive && stepHints.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {stepHints.map(hint => {
                                  const HintIcon = HINT_ICONS[hint.type] ?? Lightbulb;
                                  return (
                                    <div
                                      key={hint.id}
                                      className={cn(
                                        'flex items-start gap-2 rounded-md px-2.5 py-2 text-xs',
                                        HINT_COLORS[hint.type],
                                      )}
                                    >
                                      <HintIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                      <span>{hint.description}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Arrow indicator */}
                          {isActive && (
                            <ChevronRight className="h-4 w-4 text-primary mt-1 shrink-0" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
