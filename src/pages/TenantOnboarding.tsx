import { useState, useCallback } from 'react';
import { useCreateTenant } from '@/domains/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Plus, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdaptiveOnboarding } from '@/hooks/use-adaptive-onboarding';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { SetupWizardModal } from '@/components/onboarding/SetupWizardModal';
import {
  emitTenantOnboardingStarted,
  emitOnboardingStepCompleted,
  emitOnboardingStepSkipped,
  emitOnboardingFinished,
  emitRoleBootstrapCompleted,
} from '@/domains/adaptive-onboarding/onboarding.events';
import { saveProgressToCache } from '@/domains/adaptive-onboarding/onboarding-progress-cache';
import { isOnboardingAdmin, type OnboardingSecurityContext } from '@/domains/adaptive-onboarding/onboarding-security-guard';

export default function TenantOnboarding() {
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [tenantCreated, setTenantCreated] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [startedAt] = useState(Date.now());
  const { toast } = useToast();
  const createMutation = useCreateTenant();

  const TENANT_ID = 'preview-tenant';
  const USER_ID = 'current-user';

  // Security context — in production, derived from JWT/session
  const securityCtx: OnboardingSecurityContext = {
    user_id: USER_ID,
    tenant_id: TENANT_ID,
    effective_roles: ['tenant_admin'],
  };

  // Adaptive onboarding engine
  const onboarding = useAdaptiveOnboarding({
    tenantId: TENANT_ID,
    planTier: 'professional',
    allowedModules: ['employees', 'companies', 'departments', 'compensation', 'benefits', 'compliance', 'health'],
    userRole: 'tenant_admin',
  });

  // ── Persist progress to cache on every change ──
  const persistProgress = useCallback(() => {
    saveProgressToCache(onboarding.progress);
  }, [onboarding.progress]);

  // ── Guarded step completion with event emission ──
  const handleCompleteStep = useCallback((stepId: string) => {
    if (!isOnboardingAdmin(securityCtx)) {
      toast({
        title: 'Acesso negado',
        description: 'Somente administradores podem completar etapas do onboarding.',
        variant: 'destructive',
      });
      return;
    }

    const step = onboarding.flow.steps.find(s => s.id === stepId);
    onboarding.completeStep(stepId);

    // Emit event
    emitOnboardingStepCompleted(TENANT_ID, USER_ID, {
      step_id: stepId,
      step_title: step?.title ?? stepId,
      phase: step?.phase ?? 'unknown',
      completion_pct: onboarding.completionPct,
      elapsed_ms: Date.now() - startedAt,
    });

    // Persist to cache
    persistProgress();

    // Check if onboarding just finished
    if (onboarding.completionPct >= 100) {
      emitOnboardingFinished(TENANT_ID, USER_ID, {
        total_steps: onboarding.flow.steps.length,
        completed_steps: onboarding.progress.completed_steps.length,
        skipped_steps: onboarding.progress.skipped_steps.length,
        total_elapsed_ms: Date.now() - startedAt,
        plan_tier: 'professional',
      });
    }
  }, [onboarding, securityCtx, startedAt, persistProgress, toast]);

  // ── Guarded step skip with event emission ──
  const handleSkipStep = useCallback((stepId: string) => {
    if (!isOnboardingAdmin(securityCtx)) {
      toast({
        title: 'Acesso negado',
        description: 'Somente administradores podem pular etapas do onboarding.',
        variant: 'destructive',
      });
      return;
    }

    const step = onboarding.flow.steps.find(s => s.id === stepId);
    onboarding.skipStep(stepId);

    emitOnboardingStepSkipped(TENANT_ID, USER_ID, {
      step_id: stepId,
      step_title: step?.title ?? stepId,
      phase: step?.phase ?? 'unknown',
      completion_pct: onboarding.completionPct,
    });

    persistProgress();
  }, [onboarding, securityCtx, persistProgress, toast]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, document: document || null }, {
      onSuccess: () => {
        toast({ title: 'Organização criada!', description: 'Sua organização foi criada com sucesso.' });
        setTenantCreated(true);
        setShowWizard(true);

        // Emit onboarding started
        emitTenantOnboardingStarted(TENANT_ID, USER_ID, {
          plan_tier: 'professional',
          total_steps: onboarding.flow.steps.length,
          estimated_minutes: onboarding.flow.estimated_total_minutes,
        });

        // Persist initial progress
        saveProgressToCache(onboarding.progress);
      },
      onError: (err) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
    });
  };

  const handleWizardFinish = (config: { selectedModules: string[]; selectedRoles: string[] }) => {
    // Emit role bootstrap event
    emitRoleBootstrapCompleted(TENANT_ID, USER_ID, {
      roles_created: config.selectedRoles,
      plan_tier: 'professional',
    });

    toast({
      title: 'Setup iniciado!',
      description: `${config.selectedModules.length} módulos e ${config.selectedRoles.length} papéis serão configurados.`,
    });

    // Complete the welcome step automatically
    handleCompleteStep('welcome');
  };

  // ── Creation form (pre-onboarding) ──
  if (!tenantCreated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-accent mb-6">
              <Building2 className="h-7 w-7 text-accent-foreground" />
            </div>
            <h1 className="text-2xl font-bold font-display text-foreground">Criar Organização</h1>
            <p className="text-muted-foreground mt-2">
              Configure sua empresa, grupo ou escritório para começar a gerenciar seus recursos humanos.
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Organização *</Label>
              <Input id="name" placeholder="Ex: Grupo Alpha, Contabilidade XYZ" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc">CNPJ / CPF</Label>
              <Input id="doc" placeholder="00.000.000/0000-00" value={document} onChange={e => setDocument(e.target.value)} />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={createMutation.isPending}>
              <Plus className="h-4 w-4" />
              {createMutation.isPending ? 'Criando...' : 'Criar Organização'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── Onboarding flow (post-creation) ──
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">
              Configuração Inicial
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {name || 'Sua organização'} — Plano Professional
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWizard(true)}
            className="gap-1.5"
          >
            <Sparkles className="h-4 w-4" />
            Assistente de Setup
          </Button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Stepper — left column */}
          <div className="lg:col-span-3">
            <OnboardingStepper
              flow={onboarding.flow}
              currentStepId={onboarding.progress.current_step_id}
              hints={onboarding.hints}
              onStepClick={onboarding.goToStep}
            />
          </div>

          {/* Checklist — right column (compact) */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-8 space-y-4">
              <OnboardingChecklist
                steps={onboarding.flow.steps}
                currentStepId={onboarding.progress.current_step_id}
                completionPct={onboarding.completionPct}
                hints={onboarding.hints}
                onComplete={handleCompleteStep}
                onSkip={handleSkipStep}
                onStepClick={onboarding.goToStep}
                onDismissHint={onboarding.dismissHint}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Setup Wizard Modal */}
      <SetupWizardModal
        open={showWizard}
        onOpenChange={setShowWizard}
        planTier="professional"
        tenantName={name || 'Sua Organização'}
        availableModules={onboarding.availableModules}
        recommendedModules={onboarding.recommendedModules}
        suggestedRoles={onboarding.suggestedRoles}
        onFinish={handleWizardFinish}
      />
    </div>
  );
}
