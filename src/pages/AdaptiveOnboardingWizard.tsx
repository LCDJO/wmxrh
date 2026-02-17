/**
 * AdaptiveOnboardingWizard — 5-step visual wizard for tenant onboarding.
 *
 * Steps:
 *   1. Informações da Empresa (Tenant)
 *   2. Estrutura Inicial (Grupos / Empresas)
 *   3. Cargos e Permissões
 *   4. Convidar Usuários
 *   5. Configurar Pagamentos
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateTenant } from '@/domains/hooks';
import { supabase } from '@/integrations/supabase/client';
import { useAdaptiveOnboarding } from '@/hooks/use-adaptive-onboarding';
import { useToast } from '@/hooks/use-toast';
import { PlanBadge } from '@/components/shared/PlanBadge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Building2, Network, Shield, UserPlus, CreditCard,
  ChevronRight, ChevronLeft, CheckCircle, Sparkles,
  Rocket, FolderTree, Briefcase, Users, ArrowRight,
  Lightbulb, Plus, Mail, Check,
} from 'lucide-react';
import type { PlanTier } from '@/domains/platform-experience/types';

// ── Wizard step metadata ────────────────────────────────────────

const WIZARD_STEPS = [
  { id: 'empresa', label: 'Empresa', icon: Building2, description: 'Informações da organização' },
  { id: 'estrutura', label: 'Estrutura', icon: Network, description: 'Grupos e empresas' },
  { id: 'cargos', label: 'Cargos', icon: Shield, description: 'Cargos e permissões' },
  { id: 'convites', label: 'Equipe', icon: UserPlus, description: 'Convidar usuários' },
  { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard, description: 'Configurar pagamentos' },
] as const;

type WizardStepId = typeof WIZARD_STEPS[number]['id'];

interface Props {
  planTier?: PlanTier;
  onComplete: () => void;
}

export default function AdaptiveOnboardingWizard({ planTier = 'free', onComplete }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const createMutation = useCreateTenant();

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStepId>>(new Set());

  // ── Step 1 state ──
  const [tenantName, setTenantName] = useState('');
  const [tenantDoc, setTenantDoc] = useState('');
  const [tenantIndustry, setTenantIndustry] = useState('');
  const [tenantCreated, setTenantCreated] = useState(false);
  const [tenantId, setTenantId] = useState('temp-onboarding');

  // ── Step 2 state ──
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDept, setNewDept] = useState('');

  // ── Step 3 state ──
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  // ── Step 4 state ──
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);

  // ── Onboarding engine (for role suggestions, modules) ──
  const onboarding = useAdaptiveOnboarding({ tenantId, planTier });

  const currentStep = WIZARD_STEPS[currentStepIdx];
  const completionPct = Math.round((completedSteps.size / WIZARD_STEPS.length) * 100);
  const isLastStep = currentStepIdx === WIZARD_STEPS.length - 1;

  // ── Persist progress to DB ──
  const persistProgress = useCallback(async (completed: Set<WizardStepId>, stepId: WizardStepId, done: boolean) => {
    if (tenantId === 'temp-onboarding') return;
    const stepsArr = [...completed];
    await supabase
      .from('onboarding_progress')
      .upsert({
        tenant_id: tenantId,
        steps_completed: stepsArr,
        last_step: stepId,
        is_completed: done,
        completed_at: done ? new Date().toISOString() : null,
      }, { onConflict: 'tenant_id' });
  }, [tenantId]);

  // ── Navigation ──
  const goNext = () => {
    const next = new Set([...completedSteps, currentStep.id]);
    setCompletedSteps(next);
    const done = isLastStep;
    persistProgress(next, currentStep.id, done);
    if (done) {
      onComplete();
    } else {
      setCurrentStepIdx(i => i + 1);
    }
  };

  const goBack = () => {
    if (currentStepIdx > 0) setCurrentStepIdx(i => i - 1);
  };

  const goToStep = (idx: number) => {
    // Allow going to completed steps or the next available one
    if (idx <= currentStepIdx || completedSteps.has(WIZARD_STEPS[idx - 1]?.id)) {
      setCurrentStepIdx(idx);
    }
  };

  // ── Step 1: Criar tenant ──
  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      { name: tenantName, document: tenantDoc || null },
      {
        onSuccess: (data: any) => {
          setTenantCreated(true);
          if (data?.id) setTenantId(data.id);
          toast({ title: 'Organização criada!', description: 'Prossiga com a estrutura.' });
        },
        onError: (err) => {
          toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        },
      },
    );
  };

  // ── Step 2: Add department ──
  const addDepartment = () => {
    const name = newDept.trim();
    if (name && !departments.includes(name)) {
      setDepartments(prev => [...prev, name]);
      setNewDept('');
    }
  };

  // ── Step 4: Add invite ──
  const addInvite = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (email && email.includes('@') && !invitedEmails.includes(email)) {
      setInvitedEmails(prev => [...prev, email]);
      setInviteEmail('');
    }
  };

  // ── Suggested departments by industry ──
  const suggestedDepts = (() => {
    const map: Record<string, string[]> = {
      comercio: ['Vendas', 'Estoque', 'RH', 'Financeiro'],
      industria: ['Produção', 'Qualidade', 'RH', 'Manutenção', 'Logística'],
      servicos: ['Operações', 'Comercial', 'RH', 'TI'],
      construcao: ['Obras', 'Segurança do Trabalho', 'RH', 'Compras'],
      saude: ['Assistencial', 'RH', 'Faturamento', 'Qualidade'],
    };
    return map[tenantIndustry] ?? ['Administrativo', 'RH', 'Financeiro', 'Operações'];
  })();

  // ── Render step content ──────────────────────────────────────

  const renderStepContent = () => {
    switch (currentStep.id) {
      // ═══ STEP 1: EMPRESA ═══
      case 'empresa':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-primary/10">
                <Rocket className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Informações da Empresa</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Comece cadastrando os dados principais da sua organização.
              </p>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="org-name">Nome da Organização *</Label>
                <Input
                  id="org-name"
                  placeholder="Ex: Grupo Alpha, Contabilidade XYZ"
                  value={tenantName}
                  onChange={e => setTenantName(e.target.value)}
                  required
                  disabled={tenantCreated}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-doc">CNPJ / CPF</Label>
                <Input
                  id="org-doc"
                  placeholder="00.000.000/0000-00"
                  value={tenantDoc}
                  onChange={e => setTenantDoc(e.target.value)}
                  disabled={tenantCreated}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-industry">Segmento</Label>
                <select
                  id="org-industry"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={tenantIndustry}
                  onChange={e => setTenantIndustry(e.target.value)}
                  disabled={tenantCreated}
                >
                  <option value="">Selecione...</option>
                  <option value="comercio">Comércio</option>
                  <option value="industria">Indústria</option>
                  <option value="servicos">Serviços</option>
                  <option value="construcao">Construção Civil</option>
                  <option value="saude">Saúde</option>
                </select>
              </div>

              {!tenantCreated ? (
                <Button type="submit" className="w-full gap-2" disabled={createMutation.isPending || !tenantName.trim()}>
                  <ArrowRight className="h-4 w-4" />
                  {createMutation.isPending ? 'Criando...' : 'Criar Organização'}
                </Button>
              ) : (
                <div className="flex items-center gap-2 justify-center text-sm text-primary">
                  <CheckCircle className="h-4 w-4" />
                  <span>Organização criada com sucesso</span>
                </div>
              )}
            </form>

            <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5 max-w-md mx-auto">
              <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                O segmento ajuda a pré-configurar departamentos e requisitos de compliance automaticamente.
              </p>
            </div>
          </div>
        );

      // ═══ STEP 2: ESTRUTURA ═══
      case 'estrutura':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Network className="h-10 w-10 mx-auto text-primary/70" />
              <h2 className="text-xl font-bold text-foreground">Estrutura Inicial</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Configure os departamentos da sua empresa. Sugestões baseadas no seu segmento:
              </p>
            </div>

            {/* Suggested departments */}
            <div className="max-w-md mx-auto space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Sugestões para seu segmento</Label>
                <div className="flex flex-wrap gap-2">
                  {suggestedDepts.map(dept => {
                    const isAdded = departments.includes(dept);
                    return (
                      <Badge
                        key={dept}
                        variant={isAdded ? 'default' : 'outline'}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isAdded ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                        )}
                        onClick={() => {
                          if (!isAdded) setDepartments(prev => [...prev, dept]);
                        }}
                      >
                        {isAdded && <Check className="h-3 w-3 mr-1" />}
                        {dept}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Custom department */}
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar departamento..."
                  value={newDept}
                  onChange={e => setNewDept(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDepartment())}
                />
                <Button variant="outline" size="icon" onClick={addDepartment} disabled={!newDept.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Selected departments */}
              {departments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Departamentos selecionados ({departments.length})</Label>
                  <div className="grid gap-1.5">
                    {departments.map(dept => (
                      <div key={dept} className="flex items-center justify-between p-2 rounded-md border border-border bg-card text-sm">
                        <div className="flex items-center gap-2">
                          <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{dept}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDepartments(prev => prev.filter(d => d !== dept))}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {planTier === 'enterprise' || planTier === 'custom' ? (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                  <p className="text-xs text-muted-foreground">
                    Plano Enterprise: você pode criar <strong>Grupos Econômicos</strong> para gerenciar múltiplas empresas após o onboarding.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        );

      // ═══ STEP 3: CARGOS E PERMISSÕES ═══
      case 'cargos':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Shield className="h-10 w-10 mx-auto text-primary/70" />
              <h2 className="text-xl font-bold text-foreground">Cargos e Permissões</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Selecione os papéis que deseja criar. Recomendações baseadas no plano <strong>{planTier}</strong>.
              </p>
            </div>

            <div className="max-w-lg mx-auto grid gap-3">
              {onboarding.suggestedRoles.roles.map(role => {
                const isSelected = selectedRoles.has(role.slug);
                return (
                  <Card
                    key={role.slug}
                    className={cn(
                      'cursor-pointer transition-all border',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/30',
                    )}
                    onClick={() => {
                      setSelectedRoles(prev => {
                        const next = new Set(prev);
                        if (next.has(role.slug)) next.delete(role.slug);
                        else next.add(role.slug);
                        return next;
                      });
                    }}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        className="mt-0.5"
                        onCheckedChange={() => {}}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{role.name}</p>
                          {role.is_recommended && (
                            <Badge variant="secondary" className="text-[10px]">Recomendado</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {role.permissions.slice(0, 4).map(perm => (
                            <Badge key={perm} variant="outline" className="text-[9px] font-mono">
                              {perm}
                            </Badge>
                          ))}
                          {role.permissions.length > 4 && (
                            <Badge variant="outline" className="text-[9px]">
                              +{role.permissions.length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {selectedRoles.size} papel(éis) selecionado(s) · Permissões podem ser ajustadas depois em IAM
            </p>
          </div>
        );

      // ═══ STEP 4: CONVIDAR USUÁRIOS ═══
      case 'convites':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <UserPlus className="h-10 w-10 mx-auto text-primary/70" />
              <h2 className="text-xl font-bold text-foreground">Convidar Equipe</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Adicione os e-mails dos gestores e administradores que irão acessar o sistema.
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@empresa.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addInvite())}
                />
                <Button variant="outline" onClick={addInvite} disabled={!inviteEmail.trim()} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>

              {invitedEmails.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Convites ({invitedEmails.length})</Label>
                  <div className="grid gap-1.5">
                    {invitedEmails.map(email => (
                      <div key={email} className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{email}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setInvitedEmails(prev => prev.filter(e => e !== email))}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {invitedEmails.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum convite adicionado</p>
                  <p className="text-xs mt-1">Você pode convidar membros depois em Configurações → Usuários</p>
                </div>
              )}
            </div>
          </div>
        );

      // ═══ STEP 5: PAGAMENTOS ═══
      case 'pagamentos':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <CreditCard className="h-10 w-10 mx-auto text-primary/70" />
              <h2 className="text-xl font-bold text-foreground">Configurar Pagamentos</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Configure as informações de faturamento para seu plano.
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">Plano Atual</p>
                      <PlanBadge tier={planTier} size="sm" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {planTier === 'free'
                        ? 'Plano gratuito com funcionalidades essenciais.'
                        : planTier === 'starter'
                          ? 'Ideal para equipes pequenas em crescimento.'
                          : planTier === 'professional'
                            ? 'Para empresas que precisam de compliance e eSocial.'
                            : 'Governança completa para grandes organizações.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {planTier === 'free' && (
                <Card className="border-border">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium">Quer desbloquear mais recursos?</p>
                    <p className="text-xs text-muted-foreground">
                      Faça upgrade para acessar remuneração, compliance, eSocial e muito mais.
                    </p>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/platform/plans')}>
                      <Sparkles className="h-3.5 w-3.5" />
                      Ver Planos
                    </Button>
                  </CardContent>
                </Card>
              )}

              {planTier !== 'free' && (
                <Card className="border-border">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium">Dados de Faturamento</p>
                    <p className="text-xs text-muted-foreground">
                      Configure os dados de cobrança e nota fiscal para sua organização.
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="billing-email" className="text-xs">E-mail de faturamento</Label>
                        <Input id="billing-email" placeholder="financeiro@empresa.com" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="billing-cnpj" className="text-xs">CNPJ para NF</Label>
                        <Input id="billing-cnpj" placeholder="00.000.000/0000-00" defaultValue={tenantDoc} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <p className="text-xs text-muted-foreground">
                  Configurações de pagamento podem ser alteradas a qualquer momento em Configurações → Planos.
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  // ── Main render ──────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Top bar ── */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Assistente de Configuração</span>
        </div>
        <div className="flex items-center gap-3">
          <PlanBadge tier={planTier} size="sm" />
          <span className="text-xs text-muted-foreground">{completionPct}% concluído</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              toast({ title: 'Configuração pulada', description: 'Você pode completar a configuração a qualquer momento.' });
              onComplete();
            }}
          >
            Pular tudo
          </Button>
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className="px-6 pt-4">
        <Progress value={completionPct} className="h-1.5" />
      </div>

      {/* ── Step nav ── */}
      <nav className="px-6 py-4 flex items-center justify-center gap-1">
        {WIZARD_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === currentStepIdx;
          const isDone = completedSteps.has(step.id);
          const isClickable = idx <= currentStepIdx || (idx > 0 && completedSteps.has(WIZARD_STEPS[idx - 1].id));

          return (
            <div key={step.id} className="flex items-center gap-1">
              {idx > 0 && (
                <div className={cn(
                  'h-px w-6 sm:w-10 transition-colors',
                  isDone || isActive ? 'bg-primary' : 'bg-border',
                )} />
              )}
              <button
                onClick={() => isClickable && goToStep(idx)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  isActive && 'bg-primary text-primary-foreground shadow-sm',
                  isDone && !isActive && 'bg-primary/10 text-primary',
                  !isActive && !isDone && 'text-muted-foreground/50',
                  isClickable && !isActive && 'hover:bg-accent cursor-pointer',
                  !isClickable && 'cursor-not-allowed',
                )}
              >
                {isDone && !isActive ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 flex items-start justify-center px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-2xl animate-fade-in" key={currentStep.id}>
          {renderStepContent()}
        </div>
      </main>

      {/* ── Footer actions ── */}
      <footer className="border-t border-border px-6 py-4 flex items-center justify-between bg-card">
        <div className="text-xs text-muted-foreground">
          Etapa {currentStepIdx + 1} de {WIZARD_STEPS.length}
          <span className="hidden sm:inline"> · {currentStep.description}</span>
        </div>
        <div className="flex items-center gap-2">
          {currentStepIdx > 0 && (
            <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
              <ChevronLeft className="h-3.5 w-3.5" />
              Voltar
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={goNext} className="gap-1 text-muted-foreground">
            Pular etapa
          </Button>
          <Button size="sm" onClick={goNext} className="gap-1">
            {isLastStep ? (
              <>
                <Rocket className="h-3.5 w-3.5" />
                Finalizar
              </>
            ) : (
              <>
                Próximo
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}
