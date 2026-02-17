/**
 * SetupWizardModal — Multi-step modal wizard for initial tenant setup.
 *
 * Steps:
 *   1. Welcome + Plan overview
 *   2. Module activation (recommended + optional)
 *   3. Role bootstrap preview
 *   4. Review & confirm
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Check,
  Sparkles,
  Puzzle,
  Shield,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Package,
  Star,
  Users,
  Rocket,
  SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModuleSetupOption, BootstrapRole, RoleBootstrapPlan } from '@/domains/adaptive-onboarding/types';
import type { PlanTier } from '@/domains/platform-experience/types';

// ── Wizard Steps ────────────────────────────────────────────────

type WizardStep = 'welcome' | 'modules' | 'roles' | 'review';

const WIZARD_STEPS: { key: WizardStep; label: string; icon: typeof Sparkles }[] = [
  { key: 'welcome', label: 'Boas-vindas', icon: Sparkles },
  { key: 'modules', label: 'Módulos', icon: Puzzle },
  { key: 'roles', label: 'Papéis', icon: Shield },
  { key: 'review', label: 'Revisão', icon: CheckCircle },
];

const PLAN_LABELS: Record<PlanTier, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-muted text-muted-foreground' },
  starter: { label: 'Starter', color: 'bg-info/10 text-info' },
  professional: { label: 'Professional', color: 'bg-primary/10 text-primary' },
  enterprise: { label: 'Enterprise', color: 'bg-warning/10 text-warning' },
  custom: { label: 'Custom', color: 'bg-accent text-accent-foreground' },
};

// ── Props ────────────────────────────────────────────────────────

interface SetupWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planTier: PlanTier;
  tenantName: string;
  availableModules: ModuleSetupOption[];
  recommendedModules: ModuleSetupOption[];
  suggestedRoles: RoleBootstrapPlan;
  onFinish: (config: {
    selectedModules: string[];
    selectedRoles: string[];
  }) => void;
  onSkip?: () => void;
}

export function SetupWizardModal({
  open,
  onOpenChange,
  planTier,
  tenantName,
  availableModules,
  recommendedModules,
  suggestedRoles,
  onFinish,
  onSkip,
}: SetupWizardModalProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [selectedModules, setSelectedModules] = useState<Set<string>>(() =>
    new Set(recommendedModules.map(m => m.module_key as string)),
  );
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(() =>
    new Set(suggestedRoles.roles.filter(r => r.is_recommended).map(r => r.slug)),
  );

  const stepIndex = WIZARD_STEPS.findIndex(s => s.key === currentStep);
  const progressPct = ((stepIndex + 1) / WIZARD_STEPS.length) * 100;

  const canGoNext = useMemo(() => {
    if (currentStep === 'modules') return selectedModules.size > 0;
    return true;
  }, [currentStep, selectedModules]);

  function goNext() {
    if (stepIndex < WIZARD_STEPS.length - 1) {
      setCurrentStep(WIZARD_STEPS[stepIndex + 1].key);
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setCurrentStep(WIZARD_STEPS[stepIndex - 1].key);
    }
  }

  function handleFinish() {
    onFinish({
      selectedModules: Array.from(selectedModules),
      selectedRoles: Array.from(selectedRoles),
    });
    onOpenChange(false);
  }

  function toggleModule(key: string) {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleRole(slug: string) {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  const planMeta = PLAN_LABELS[planTier];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] gap-0 p-0 overflow-hidden">
        {/* ── Step indicator bar ── */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-4">
            {WIZARD_STEPS.map((step, idx) => {
              const isActive = idx === stepIndex;
              const isDone = idx < stepIndex;
              const StepIcon = step.icon;

              return (
                <div key={step.key} className="flex items-center gap-2 flex-1">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-all',
                      isDone && 'bg-primary text-primary-foreground',
                      isActive && 'bg-primary/10 border-2 border-primary text-primary',
                      !isDone && !isActive && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium hidden sm:block',
                      isActive ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 rounded-full',
                        isDone ? 'bg-primary' : 'bg-border',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={progressPct} className="h-1" />
        </div>

        <Separator />

        {/* ── Step content ── */}
        <div className="px-6 py-5 min-h-[320px]">
          {/* WELCOME */}
          {currentStep === 'welcome' && (
            <div className="flex flex-col items-center text-center space-y-5 animate-fade-in">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-xl font-display">
                    Bem-vindo, {tenantName}!
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Vamos configurar sua organização em poucos minutos.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <Badge className={cn('text-xs px-3 py-1', planMeta.color)} variant="outline">
                Plano {planMeta.label}
              </Badge>
              <div className="grid grid-cols-3 gap-4 w-full pt-2">
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <Package className="h-5 w-5 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">{availableModules.length} módulos</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <Users className="h-5 w-5 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">{suggestedRoles.roles.length} papéis</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <Star className="h-5 w-5 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">{recommendedModules.length} recomendados</p>
                </div>
              </div>
            </div>
          )}

          {/* MODULES */}
          {currentStep === 'modules' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-semibold font-display text-foreground">
                  Ativar Módulos
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione os módulos para sua organização. Recomendados já estão marcados.
                </p>
              </div>

              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {availableModules.map(mod => {
                  const isSelected = selectedModules.has(mod.module_key as string);
                  const isRecommended = mod.recommended;

                  return (
                    <div
                      key={mod.module_key}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 transition-all cursor-pointer',
                        isSelected
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border hover:border-border/80 hover:bg-accent/30',
                      )}
                      onClick={() => toggleModule(mod.module_key as string)}
                    >
                      <Switch
                        checked={isSelected}
                        onCheckedChange={() => toggleModule(mod.module_key as string)}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {mod.label}
                          </span>
                          {isRecommended && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                              <Star className="h-2.5 w-2.5" />
                              Recomendado
                            </Badge>
                          )}
                          {mod.requires_setup && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Requer setup
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {mod.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                {selectedModules.size} módulo{selectedModules.size !== 1 ? 's' : ''} selecionado{selectedModules.size !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* ROLES */}
          {currentStep === 'roles' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-semibold font-display text-foreground">
                  Papéis Iniciais
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {suggestedRoles.reason}
                </p>
              </div>

              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {suggestedRoles.roles.map(role => {
                  const isSelected = selectedRoles.has(role.slug);

                  return (
                    <div
                      key={role.slug}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 transition-all cursor-pointer',
                        isSelected
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border hover:border-border/80 hover:bg-accent/30',
                      )}
                      onClick={() => toggleRole(role.slug)}
                    >
                      <Switch
                        checked={isSelected}
                        onCheckedChange={() => toggleRole(role.slug)}
                        className="shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {role.name}
                          </span>
                          {role.is_recommended && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Sugerido
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {role.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {role.permissions.slice(0, 4).map(perm => (
                            <Badge
                              key={perm}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-mono"
                            >
                              {perm}
                            </Badge>
                          ))}
                          {role.permissions.length > 4 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              +{role.permissions.length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* REVIEW */}
          {currentStep === 'review' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold font-display text-foreground">
                  Revisão Final
                </h3>
                <p className="text-sm text-muted-foreground">
                  Confirme as configurações antes de iniciar.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Puzzle className="h-4 w-4 text-primary" />
                    Módulos ({selectedModules.size})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(selectedModules).map(key => {
                      const mod = availableModules.find(m => m.module_key === key);
                      return (
                        <Badge key={key} variant="secondary" className="text-xs">
                          {mod?.label ?? key}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Shield className="h-4 w-4 text-primary" />
                    Papéis ({selectedRoles.size})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(selectedRoles).map(slug => {
                      const role = suggestedRoles.roles.find(r => r.slug === slug);
                      return (
                        <Badge key={slug} variant="secondary" className="text-xs">
                          {role?.name ?? slug}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* ── Footer with actions ── */}
        <DialogFooter className="px-6 py-4 bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goBack}
                disabled={stepIndex === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>

              {onSkip && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSkip();
                    onOpenChange(false);
                  }}
                  className="gap-1 text-muted-foreground hover:text-foreground"
                >
                  <SkipForward className="h-4 w-4" />
                  Pular configuração
                </Button>
              )}
            </div>

            {currentStep === 'review' ? (
              <Button
                size="sm"
                onClick={handleFinish}
                className="gap-1.5 gradient-primary text-primary-foreground"
              >
                <Rocket className="h-4 w-4" />
                Iniciar Configuração
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={goNext}
                disabled={!canGoNext}
                className="gap-1"
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
