/**
 * OnboardingProgressCard — Visual onboarding progress for the dashboard.
 * Reads from onboarding_progress table and shows step-by-step status.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Rocket, Building2, Network, Shield, UserPlus, CreditCard,
  CheckCircle, Circle, ArrowRight,
} from 'lucide-react';

const WIZARD_STEPS = [
  { id: 'empresa', label: 'Empresa', icon: Building2 },
  { id: 'estrutura', label: 'Estrutura', icon: Network },
  { id: 'cargos', label: 'Cargos', icon: Shield },
  { id: 'convites', label: 'Equipe', icon: UserPlus },
  { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard },
] as const;

interface OnboardingRow {
  tenant_id: string;
  steps_completed: string[];
  steps_skipped: string[];
  last_step: string | null;
  is_completed: boolean;
}

export function OnboardingProgressCard() {
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<OnboardingRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentTenant?.id) { setLoading(false); return; }

    const fetch = async () => {
      const { data } = await supabase
        .from('onboarding_progress')
        .select('tenant_id, steps_completed, steps_skipped, last_step, is_completed')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();
      setProgress(data as OnboardingRow | null);
      setLoading(false);
    };
    fetch();
  }, [currentTenant?.id]);

  if (loading) return null;

  // No progress row → show "Start onboarding" prompt
  if (!progress) {
    return (
      <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in border border-primary/20">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-card-foreground">Configure sua organização</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete o assistente de configuração para começar a usar o sistema.
            </p>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => navigate('/onboarding')}>
            Iniciar <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // Completed → don't render
  if (progress.is_completed) return null;

  const done = new Set([...progress.steps_completed, ...progress.steps_skipped]);
  const completedCount = done.size;
  const totalSteps = WIZARD_STEPS.length;
  const pct = Math.round((completedCount / totalSteps) * 100);

  // Find next pending step
  const nextStep = WIZARD_STEPS.find(s => !done.has(s.id));

  return (
    <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in border border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-card-foreground">Progresso do Onboarding</h2>
        </div>
        <Badge variant="secondary" className="text-xs">{pct}%</Badge>
      </div>

      <Progress value={pct} className="h-1.5 mb-4" />

      <div className="flex items-center gap-2 mb-4">
        {WIZARD_STEPS.map((step) => {
          const Icon = step.icon;
          const isDone = done.has(step.id);
          const isCurrent = nextStep?.id === step.id;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-colors',
                isDone && 'bg-primary/10 text-primary',
                isCurrent && 'bg-accent text-accent-foreground ring-1 ring-primary/30',
                !isDone && !isCurrent && 'text-muted-foreground/40',
              )}
            >
              {isDone ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              <span className="hidden md:inline">{step.label}</span>
            </div>
          );
        })}
      </div>

      {nextStep && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Próximo: <span className="font-medium text-foreground">{nextStep.label}</span>
          </p>
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => navigate('/onboarding')}>
            Continuar <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
