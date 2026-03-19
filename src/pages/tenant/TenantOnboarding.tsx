import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useScope } from '@/contexts/ScopeContext';
import { supabase } from '@/integrations/supabase/client';
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant, needsOnboarding, loading } = useTenant();
  const { effectiveRoles } = useScope();
  const [showWizard, setShowWizard] = useState(true); // auto-open wizard on first load
  const [startedAt] = useState(Date.now());
  const { toast } = useToast();

  const TENANT_ID = currentTenant?.id ?? 'preview-tenant';
  const USER_ID = user?.id ?? 'current-user';

  // ── Fetch tenant's active plan ──
  const { data: tenantPlan } = useQuery({
    queryKey: ['tenant-plan', TENANT_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_plans')
        .select('*, saas_plans(name, allowed_modules)')
        .eq('tenant_id', TENANT_ID)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  const planTier = (tenantPlan?.saas_plans as any)?.name?.toLowerCase() ?? 'starter';
  const allowedModules: string[] = (tenantPlan?.saas_plans as any)?.allowed_modules
    ?? ['employees', 'companies', 'departments'];

  // Security context — memoized with real roles from ScopeContext
  const securityCtx = useMemo<OnboardingSecurityContext>(() => ({
    user_id: USER_ID,
    tenant_id: TENANT_ID,
    effective_roles: effectiveRoles,
  }), [USER_ID, TENANT_ID, effectiveRoles]);

  // Adaptive onboarding engine
  const onboarding = useAdaptiveOnboarding({
    tenantId: TENANT_ID,
    planTier,
    allowedModules,
    userRole: 'tenant_admin',
  });

  // ── Redirect if no tenant or onboarding not needed ──
  useEffect(() => {
    if (loading) return;
    if (!currentTenant) {
      navigate('/auth/login', { replace: true });
      return;
    }
    if (!needsOnboarding) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentTenant, needsOnboarding, loading, navigate]);

  // Emit onboarding started on mount
  useEffect(() => {
    if (!currentTenant?.id) return;
    emitTenantOnboardingStarted(TENANT_ID, USER_ID, {
      plan_tier: planTier,
      total_steps: onboarding.flow.steps.length,
      estimated_minutes: onboarding.flow.estimated_total_minutes,
    });
    saveProgressToCache(onboarding.progress);
  }, [currentTenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Skip handler ──
  const handleSkipOnboarding = useCallback(() => {
    toast({
      title: 'Configuração pulada',
      description: 'Você pode completar a configuração a qualquer momento no painel.',
    });
    navigate('/dashboard');
  }, [navigate, toast]);

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

    emitOnboardingStepCompleted(TENANT_ID, USER_ID, {
      step_id: stepId,
      step_title: step?.title ?? stepId,
      phase: step?.phase ?? 'unknown',
      completion_pct: onboarding.completionPct,
      elapsed_ms: Date.now() - startedAt,
    });

    persistProgress();

    if (onboarding.completionPct >= 100) {
      emitOnboardingFinished(TENANT_ID, USER_ID, {
        total_steps: onboarding.flow.steps.length,
        completed_steps: onboarding.progress.completed_steps.length,
        skipped_steps: onboarding.progress.skipped_steps.length,
        total_elapsed_ms: Date.now() - startedAt,
        plan_tier: planTier,
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

  const handleWizardFinish = (config: { selectedModules: string[]; selectedRoles: string[] }) => {
    emitRoleBootstrapCompleted(TENANT_ID, USER_ID, {
      roles_created: config.selectedRoles,
      plan_tier: planTier,
    });

    toast({
      title: 'Setup iniciado!',
      description: `${config.selectedModules.length} módulos e ${config.selectedRoles.length} papéis serão configurados.`,
    });

    handleCompleteStep('welcome');
  };

  if (loading || !currentTenant) return null;

  // ── Onboarding flow — direct to setup (tenant already created by SuperAdmin) ──
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
              {currentTenant.name} — Bem-vindo ao seu espaço de trabalho
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWizard(true)}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              Assistente de Setup
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkipOnboarding}
              className="gap-1.5 text-muted-foreground"
            >
              Pular configuração
            </Button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <OnboardingStepper
              flow={onboarding.flow}
              currentStepId={onboarding.progress.current_step_id}
              hints={onboarding.hints}
              onStepClick={onboarding.goToStep}
            />
          </div>

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
        planTier={planTier}
        tenantName={currentTenant.name}
        availableModules={onboarding.availableModules}
        recommendedModules={onboarding.recommendedModules}
        suggestedRoles={onboarding.suggestedRoles}
        onFinish={handleWizardFinish}
        onSkip={handleSkipOnboarding}
      />
    </div>
  );
}
