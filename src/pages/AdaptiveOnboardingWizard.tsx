/**
 * AdaptiveOnboardingWizard — Full-screen wizard for new tenant onboarding.
 *
 * Integrates with PXE and Identity Intelligence to provide a
 * personalised setup experience based on plan, modules, and context.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdaptiveOnboarding } from '@/hooks/use-adaptive-onboarding';
import { useTenant } from '@/contexts/TenantContext';
import { useCreateTenant } from '@/domains/hooks';
import { useToast } from '@/hooks/use-toast';
import { PlanBadge } from '@/components/shared/PlanBadge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Building2, Users, Shield, Puzzle, ClipboardCheck, Sparkles,
  ChevronRight, CheckCircle, SkipForward, Lightbulb, AlertTriangle,
  ArrowRight, Rocket, FolderTree, UserPlus, Info,
} from 'lucide-react';
import type { OnboardingStep, OnboardingHint } from '@/domains/adaptive-onboarding/types';
import type { PlanTier } from '@/domains/platform-experience/types';

const PHASE_ICONS: Record<string, React.ElementType> = {
  welcome: Sparkles,
  company_setup: Building2,
  role_setup: Shield,
  module_activation: Puzzle,
  team_invite: UserPlus,
  compliance_check: ClipboardCheck,
  review: CheckCircle,
};

const HINT_ICONS: Record<string, React.ElementType> = {
  tip: Lightbulb,
  warning: AlertTriangle,
  recommendation: Sparkles,
  compliance: ClipboardCheck,
};

interface Props {
  planTier?: PlanTier;
  onComplete: () => void;
}

export default function AdaptiveOnboardingWizard({ planTier = 'free', onComplete }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const createMutation = useCreateTenant();

  // Tenant creation form
  const [tenantName, setTenantName] = useState('');
  const [tenantDoc, setTenantDoc] = useState('');
  const [tenantCreated, setTenantCreated] = useState(false);
  const [tenantId, setTenantId] = useState('temp-onboarding');

  const onboarding = useAdaptiveOnboarding({
    tenantId,
    planTier,
  });

  const {
    flow,
    currentStep,
    hints,
    suggestedRoles,
    availableModules,
    recommendedModules,
    completeStep,
    skipStep,
    isCompleted,
    completionPct,
  } = onboarding;

  // ── Tenant creation handler ──
  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      { name: tenantName, document: tenantDoc || null },
      {
        onSuccess: (data: any) => {
          setTenantCreated(true);
          if (data?.id) setTenantId(data.id);
          toast({ title: 'Organização criada!', description: 'Prossiga com a configuração.' });
          completeStep('welcome');
        },
        onError: (err) => {
          toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        },
      },
    );
  };

  // ── Phase progress indicator ──
  const phases = [...new Set(flow.steps.map(s => s.phase))];
  const currentPhaseIdx = phases.indexOf(currentStep?.phase ?? 'welcome');

  // ── Render step content ──
  const renderStepContent = () => {
    if (!currentStep) return null;

    switch (currentStep.id) {
      case 'welcome':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold font-display text-foreground">
                Vamos configurar sua organização
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Em poucos passos, sua organização estará pronta para uso.
                O assistente vai adaptar a configuração ao seu plano.
              </p>
              <PlanBadge tier={planTier} size="lg" className="mx-auto" />
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4 max-w-sm mx-auto">
              <div className="space-y-2">
                <Label htmlFor="org-name">Nome da Organização *</Label>
                <Input
                  id="org-name"
                  placeholder="Ex: Grupo Alpha, Contabilidade XYZ"
                  value={tenantName}
                  onChange={e => setTenantName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-doc">CNPJ / CPF</Label>
                <Input
                  id="org-doc"
                  placeholder="00.000.000/0000-00"
                  value={tenantDoc}
                  onChange={e => setTenantDoc(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={createMutation.isPending}>
                <ArrowRight className="h-4 w-4" />
                {createMutation.isPending ? 'Criando...' : 'Criar e Continuar'}
              </Button>
            </form>
          </div>
        );

      case 'create_company':
        return (
          <div className="space-y-4 text-center">
            <Building2 className="h-12 w-12 mx-auto text-primary/60" />
            <h3 className="text-lg font-semibold">Cadastrar Empresa</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Adicione os dados da empresa principal. Você poderá cadastrar mais empresas depois.
            </p>
            <Button onClick={() => { completeStep('create_company'); }} className="gap-2">
              <CheckCircle className="h-4 w-4" /> Marcar como concluído
            </Button>
          </div>
        );

      case 'setup_departments':
        return (
          <div className="space-y-4 text-center">
            <FolderTree className="h-12 w-12 mx-auto text-primary/60" />
            <h3 className="text-lg font-semibold">Criar Departamentos</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Sugestões baseadas no tipo de empresa:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Administrativo', 'RH', 'Financeiro', 'Operações'].map(d => (
                <Badge key={d} variant="secondary">{d}</Badge>
              ))}
            </div>
          </div>
        );

      case 'configure_roles':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto text-primary/60" />
              <h3 className="text-lg font-semibold mt-2">Configurar Papéis</h3>
              <p className="text-muted-foreground text-sm">{suggestedRoles.reason}</p>
            </div>
            <div className="grid gap-3 max-w-lg mx-auto">
              {suggestedRoles.roles.map(role => (
                <Card key={role.slug} className={cn(
                  'border',
                  role.is_recommended ? 'border-primary/30 bg-primary/5' : 'border-border',
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{role.name}</p>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                      {role.is_recommended && (
                        <Badge variant="secondary" className="text-[10px]">Recomendado</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'activate_modules':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Puzzle className="h-12 w-12 mx-auto text-primary/60" />
              <h3 className="text-lg font-semibold mt-2">Ativar Módulos</h3>
              <p className="text-muted-foreground text-sm">
                Módulos disponíveis no seu plano {planTier}:
              </p>
            </div>
            <div className="grid gap-2 max-w-lg mx-auto">
              {availableModules.map(mod => (
                <div
                  key={mod.module_key}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border',
                    mod.recommended ? 'border-primary/30 bg-primary/5' : 'border-border',
                  )}
                >
                  <div>
                    <p className="font-medium text-sm">{mod.label}</p>
                    <p className="text-xs text-muted-foreground">{mod.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {mod.recommended && (
                      <Badge variant="secondary" className="text-[10px]">✓</Badge>
                    )}
                    {mod.requires_setup && (
                      <Badge variant="outline" className="text-[10px]">Setup</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'invite_users':
        return (
          <div className="space-y-4 text-center">
            <UserPlus className="h-12 w-12 mx-auto text-primary/60" />
            <h3 className="text-lg font-semibold">Convidar Equipe</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Convide gestores e administradores. Você pode fazer isso agora ou depois.
            </p>
          </div>
        );

      case 'compliance_check':
        return (
          <div className="space-y-4 text-center">
            <ClipboardCheck className="h-12 w-12 mx-auto text-primary/60" />
            <h3 className="text-lg font-semibold">Verificar Compliance</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Revise as obrigações trabalhistas e de saúde ocupacional identificadas para sua empresa.
            </p>
          </div>
        );

      case 'add_employees':
        return (
          <div className="space-y-4 text-center">
            <Users className="h-12 w-12 mx-auto text-primary/60" />
            <h3 className="text-lg font-semibold">Cadastrar Colaboradores</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Adicione os primeiros colaboradores ao sistema. Importação em lote disponível.
            </p>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6 text-center">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Tudo pronto!</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Sua organização está configurada. Você pode ajustar qualquer configuração a qualquer momento.
            </p>
            <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
              <span>✓ {onboarding.progress.completed_steps.length} etapas concluídas</span>
              {onboarding.progress.skipped_steps.length > 0 && (
                <span>⏭ {onboarding.progress.skipped_steps.length} puladas</span>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center">
            <p className="text-muted-foreground">{currentStep.description}</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Top bar ── */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-display font-semibold text-sm">Assistente de Configuração</span>
        </div>
        <div className="flex items-center gap-3">
          <PlanBadge tier={planTier} size="sm" />
          <span className="text-xs text-muted-foreground">{completionPct}% concluído</span>
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className="px-6 pt-4">
        <Progress value={completionPct} className="h-1.5" />
      </div>

      {/* ── Phase nav ── */}
      <nav className="px-6 py-3 flex items-center gap-1 overflow-x-auto">
        {phases.map((phase, idx) => {
          const Icon = PHASE_ICONS[phase] ?? Info;
          const isActive = idx === currentPhaseIdx;
          const isDone = idx < currentPhaseIdx;
          return (
            <div key={phase} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />}
              <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0',
                isActive && 'bg-primary/10 text-primary',
                isDone && 'bg-muted text-muted-foreground',
                !isActive && !isDone && 'text-muted-foreground/50',
              )}>
                {isDone ? (
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline capitalize">
                  {phase.replace('_', ' ')}
                </span>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-2xl animate-fade-in">
          {renderStepContent()}

          {/* ── Hints ── */}
          {hints.length > 0 && (
            <div className="mt-6 space-y-2">
              {hints.map(hint => {
                const HintIcon = HINT_ICONS[hint.type] ?? Info;
                return (
                  <div
                    key={hint.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border text-sm',
                      hint.type === 'warning' && 'bg-warning/5 border-warning/20',
                      hint.type === 'compliance' && 'bg-destructive/5 border-destructive/20',
                      hint.type === 'tip' && 'bg-primary/5 border-primary/20',
                      hint.type === 'recommendation' && 'bg-accent border-border',
                    )}
                  >
                    <HintIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-xs">{hint.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{hint.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer actions ── */}
      <footer className="border-t border-border px-6 py-4 flex items-center justify-between bg-card">
        <div className="text-xs text-muted-foreground">
          {currentStep && !isCompleted && (
            <>
              Etapa {flow.steps.indexOf(currentStep) + 1} de {flow.steps.length}
              {currentStep.estimated_minutes > 0 && ` · ~${currentStep.estimated_minutes} min`}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentStep && !currentStep.is_mandatory && !isCompleted && currentStep.id !== 'welcome' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => skipStep(currentStep.id)}
              className="gap-1 text-muted-foreground"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Pular
            </Button>
          )}
          {currentStep && currentStep.id !== 'welcome' && !isCompleted && (
            <Button
              size="sm"
              onClick={() => completeStep(currentStep.id)}
              className="gap-1"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Concluir Etapa
            </Button>
          )}
          {isCompleted && (
            <Button size="sm" onClick={onComplete} className="gap-1">
              <Rocket className="h-3.5 w-3.5" />
              Começar a usar
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
