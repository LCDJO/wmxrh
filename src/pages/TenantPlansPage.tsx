/**
 * TenantPlansPage — Tenant admin page for viewing current plan,
 * comparing available plans, and requesting upgrade/downgrade.
 * Fully integrated with PXE engine + saas_plans + tenant_plans.
 */

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { usePXE } from '@/hooks/use-pxe';
import { useEmployeeLimit } from '@/hooks/use-employee-limit';
import { PlanBadge } from '@/components/shared/PlanBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Check, Crown, Sparkles, Zap, Star, ArrowLeft, ArrowUp, ArrowDown,
  Users, Building2, HardDrive, Calendar, CreditCard, Shield, Loader2,
  AlertTriangle, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

// ── Types ──

interface SaasPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billing_cycle: string;
  allowed_modules: string[];
  feature_flags: string[];
  is_active: boolean;
  max_employees: number | null;
  annual_price: number | null;
  annual_discount_pct: number | null;
}

type BillingInterval = 'monthly' | 'annual';

// ── Constants ──

const TIER_ICON: Record<string, React.ElementType> = {
  free: Zap,
  basic: Star,
  pro: Sparkles,
  enterprise: Crown,
};

const TIER_GRADIENT: Record<string, string> = {
  free: 'from-muted to-muted/60',
  basic: 'from-primary/10 to-primary/5',
  pro: 'from-primary/20 to-primary/5',
  enterprise: 'from-primary/30 to-primary/10',
};

const MODULE_LABELS: Record<string, string> = {
  employees: 'Colaboradores',
  departments: 'Departamentos',
  positions: 'Cargos',
  companies: 'Empresas',
  compensation: 'Remuneração',
  benefits: 'Benefícios',
  health: 'Saúde Ocupacional',
  compliance: 'Compliance',
  agreements: 'Termos & Acordos',
  labor_rules: 'Regras Trabalhistas',
  labor_compliance: 'Conformidade Trabalhista',
  esocial: 'eSocial',
  payroll_simulation: 'Simulação de Folha',
  workforce_intelligence: 'Inteligência RH',
  audit: 'Auditoria',
  iam: 'Gestão de Acessos',
  groups: 'Grupos Empresariais',
  fleet: 'Frota & Compliance',
};

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Main Component ──

export default function TenantPlansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { planSnapshot, planTier, planStatus, engine, canUpgrade, canDowngrade } = usePXE();
  const { currentCount, maxAllowed, remaining } = useEmployeeLimit();

  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [changePlanDialog, setChangePlanDialog] = useState<{ plan: SaasPlan; direction: 'upgrade' | 'downgrade' } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [plansRes, subRes] = await Promise.all([
        supabase.from('saas_plans').select('*').eq('is_active', true).order('price', { ascending: true }),
        currentTenant?.id
          ? supabase.from('tenant_plans').select('plan_id, status, billing_cycle').eq('tenant_id', currentTenant.id).eq('status', 'active').maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setPlans((plansRes.data as SaasPlan[]) ?? []);
      if (subRes.data) {
        setCurrentPlanId((subRes.data as any).plan_id);
        if ((subRes.data as any).billing_cycle === 'yearly') setBillingInterval('annual');
      }
      setLoading(false);
    }
    fetchData();
  }, [currentTenant?.id]);

  const currentPlan = useMemo(() => plans.find(p => p.id === currentPlanId), [plans, currentPlanId]);
  const currentPlanIndex = useMemo(() => plans.findIndex(p => p.id === currentPlanId), [plans, currentPlanId]);

  const getDisplayPrice = (plan: SaasPlan) => {
    if (plan.price === 0) return 'Grátis';
    if (billingInterval === 'annual' && plan.annual_price) {
      return formatBRL(plan.annual_price / 12);
    }
    return formatBRL(plan.price);
  };

  const getAnnualSavings = (plan: SaasPlan) => {
    if (plan.price === 0 || !plan.annual_price) return null;
    return plan.price * 12 - plan.annual_price;
  };

  const getPlanDirection = (plan: SaasPlan): 'upgrade' | 'downgrade' | 'current' | null => {
    if (plan.id === currentPlanId) return 'current';
    const planIdx = plans.indexOf(plan);
    if (planIdx > currentPlanIndex) return 'upgrade';
    if (planIdx < currentPlanIndex) return 'downgrade';
    return null;
  };

  const handleChangePlan = async () => {
    if (!changePlanDialog || !currentTenant?.id) return;
    setProcessing(true);
    try {
      const { plan, direction } = changePlanDialog;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Update tenant_plans — upsert active plan
      if (currentPlanId) {
        await supabase
          .from('tenant_plans' as any)
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('tenant_id', currentTenant.id)
          .eq('plan_id', currentPlanId)
          .eq('status', 'active');
      }

      await (supabase.from('tenant_plans' as any) as any).insert({
        tenant_id: currentTenant.id,
        plan_id: plan.id,
        status: 'active',
        billing_cycle: billingInterval === 'annual' ? 'yearly' : 'monthly',
        price_at_signup: billingInterval === 'annual' ? (plan.annual_price ?? plan.price * 12) : plan.price,
        started_at: new Date().toISOString(),
        created_by: user.id,
      });

      // Log in audit
      await supabase.from('audit_logs').insert({
        tenant_id: currentTenant.id,
        user_id: user.id,
        action: direction === 'upgrade' ? 'plan_upgrade' : 'plan_downgrade',
        entity_type: 'tenant_plan',
        entity_id: plan.id,
        metadata: {
          from_plan: currentPlan?.name,
          to_plan: plan.name,
          billing_interval: billingInterval,
        },
      });

      setCurrentPlanId(plan.id);
      setChangePlanDialog(null);
      queryClient.invalidateQueries({ queryKey: ['tenant_plans'] });
      toast.success(
        direction === 'upgrade'
          ? `Upgrade para ${plan.name} realizado com sucesso!`
          : `Downgrade para ${plan.name} realizado.`
      );
    } catch (err: any) {
      toast.error('Erro ao alterar plano', { description: err.message });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      </div>

      {/* ── Current Plan Summary ── */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            Seu Plano Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Plan name + badge */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plano</p>
              <div className="flex items-center gap-2">
                <PlanBadge tier={planTier} size="md" />
                <span className="text-lg font-bold text-foreground">{currentPlan?.name ?? 'Free'}</span>
              </div>
              <Badge variant="outline" className={cn(
                "text-[10px]",
                planStatus === 'active' ? 'border-primary/30 text-primary' :
                planStatus === 'trial' ? 'border-primary/30 text-primary' :
                'border-destructive/30 text-destructive'
              )}>
                {planStatus === 'active' ? 'Ativo' : planStatus === 'trial' ? 'Trial' : planStatus}
              </Badge>
            </div>

            {/* Employee usage */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Users className="h-3 w-3" /> Colaboradores
              </p>
              <p className="text-lg font-bold text-foreground">
                {currentCount} <span className="text-sm font-normal text-muted-foreground">/ {maxAllowed ?? '∞'}</span>
              </p>
              {maxAllowed && (
                <Progress value={(currentCount / maxAllowed) * 100} className="h-1.5" />
              )}
              {remaining !== null && remaining <= 3 && remaining > 0 && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  Restam {remaining} vagas
                </p>
              )}
            </div>

            {/* Billing */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> Faturamento
              </p>
              <p className="text-lg font-bold text-foreground">
                {currentPlan?.price === 0 ? 'Grátis' : formatBRL(currentPlan?.price ?? 0)}
                {(currentPlan?.price ?? 0) > 0 && <span className="text-sm font-normal text-muted-foreground">/mês</span>}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Ciclo: {planSnapshot?.billing_cycle === 'annual' ? 'Anual' : 'Mensal'}
              </p>
            </div>

            {/* Modules count */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Shield className="h-3 w-3" /> Módulos Ativos
              </p>
              <p className="text-lg font-bold text-foreground">
                {currentPlan?.allowed_modules.length ?? 0}
              </p>
              <p className="text-[10px] text-muted-foreground">
                de {Math.max(...plans.map(p => p.allowed_modules.length), 0)} disponíveis
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Billing Toggle ── */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setBillingInterval('monthly')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            billingInterval === 'monthly'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Mensal
        </button>
        <button
          onClick={() => setBillingInterval('annual')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
            billingInterval === 'annual'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Anual
          <Badge variant="outline" className="text-[10px] border-primary/30 bg-primary/10 text-primary ml-1">
            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
            ~17% OFF
          </Badge>
        </button>
      </div>

      {/* ── Plans Grid ── */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const tierKey = plan.name.toLowerCase();
          const Icon = TIER_ICON[tierKey] ?? Star;
          const direction = getPlanDirection(plan);
          const savings = getAnnualSavings(plan);

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col transition-all duration-300 hover:shadow-lg overflow-hidden',
                isCurrent
                  ? 'border-primary shadow-md ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {/* Gradient strip */}
              <div className={cn('h-1 w-full bg-gradient-to-r', TIER_GRADIENT[tierKey] ?? TIER_GRADIENT.basic)} />

              {isCurrent && (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
                    Atual
                  </Badge>
                </div>
              )}

              <CardContent className="flex flex-col flex-1 p-5 pt-4">
                {/* Plan header */}
                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg',
                      isCurrent ? 'bg-primary/15' : 'bg-muted'
                    )}>
                      <Icon className={cn('h-5 w-5', isCurrent ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                  </div>

                  <div>
                    <span className="text-2xl font-bold text-foreground">{getDisplayPrice(plan)}</span>
                    {plan.price > 0 && <span className="text-sm text-muted-foreground">/mês</span>}
                  </div>

                  {billingInterval === 'annual' && savings && savings > 0 && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground line-through">{formatBRL(plan.price)}/mês</p>
                      <p className="text-xs font-semibold text-primary">
                        Economia de {formatBRL(savings)}/ano
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Cobrado {formatBRL(plan.annual_price!)} anualmente
                      </p>
                    </div>
                  )}

                  {billingInterval === 'monthly' && plan.annual_price && plan.price > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      ou {formatBRL(plan.annual_price / 12)}/mês no anual
                    </p>
                  )}
                </div>

                {/* Limits */}
                <div className="space-y-1 mb-4 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> Colaboradores
                    </span>
                    <span className="font-medium text-foreground">
                      {plan.max_employees ? `até ${plan.max_employees}` : 'Ilimitado'}
                    </span>
                  </div>
                </div>

                {/* Module list */}
                <div className="flex-1 space-y-2 mb-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {plan.allowed_modules.length} módulos
                  </p>
                  <ul className="space-y-1">
                    {plan.allowed_modules.slice(0, 6).map((mod) => (
                      <li key={mod} className="flex items-center gap-1.5 text-xs">
                        <Check className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-foreground">{MODULE_LABELS[mod] ?? mod}</span>
                      </li>
                    ))}
                    {plan.allowed_modules.length > 6 && (
                      <li className="text-[10px] text-muted-foreground pl-5">
                        +{plan.allowed_modules.length - 6} módulos
                      </li>
                    )}
                  </ul>
                </div>

                {/* CTA */}
                {isCurrent ? (
                  <Button variant="outline" className="w-full mt-auto" disabled>
                    Plano Ativo
                  </Button>
                ) : direction === 'upgrade' ? (
                  <Button
                    className="w-full mt-auto gap-1.5"
                    onClick={() => setChangePlanDialog({ plan, direction: 'upgrade' })}
                  >
                    <ArrowUp className="h-3.5 w-3.5" /> Fazer Upgrade
                  </Button>
                ) : direction === 'downgrade' ? (
                  <Button
                    variant="outline"
                    className="w-full mt-auto gap-1.5"
                    onClick={() => setChangePlanDialog({ plan, direction: 'downgrade' })}
                  >
                    <ArrowDown className="h-3.5 w-3.5" /> Downgrade
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full mt-auto" onClick={() => setChangePlanDialog({ plan, direction: 'upgrade' })}>
                    Selecionar
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        Sem fidelidade • Cancele a qualquer momento • Todos os preços em BRL
      </p>

      {/* ── Change Plan Dialog ── */}
      {changePlanDialog && (
        <Dialog open onOpenChange={() => setChangePlanDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {changePlanDialog.direction === 'upgrade'
                  ? <><ArrowUp className="h-5 w-5 text-primary" /> Confirmar Upgrade</>
                  : <><ArrowDown className="h-5 w-5 text-muted-foreground" /> Confirmar Downgrade</>
                }
              </DialogTitle>
              <DialogDescription>
                {changePlanDialog.direction === 'upgrade'
                  ? `Você está fazendo upgrade de ${currentPlan?.name ?? 'Free'} para ${changePlanDialog.plan.name}.`
                  : `Você está fazendo downgrade de ${currentPlan?.name ?? 'Free'} para ${changePlanDialog.plan.name}.`
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {/* Price comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Plano Atual</p>
                  <p className="text-lg font-bold text-foreground">{currentPlan?.name ?? 'Free'}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentPlan?.price === 0 ? 'Grátis' : `${formatBRL(currentPlan?.price ?? 0)}/mês`}
                  </p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-[10px] text-primary uppercase font-medium">Novo Plano</p>
                  <p className="text-lg font-bold text-foreground">{changePlanDialog.plan.name}</p>
                  <p className="text-sm text-primary font-medium">
                    {billingInterval === 'annual' && changePlanDialog.plan.annual_price
                      ? `${formatBRL(changePlanDialog.plan.annual_price / 12)}/mês`
                      : changePlanDialog.plan.price === 0 ? 'Grátis' : `${formatBRL(changePlanDialog.plan.price)}/mês`
                    }
                  </p>
                </div>
              </div>

              {/* Downgrade warning */}
              {changePlanDialog.direction === 'downgrade' && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-destructive">Atenção ao downgrade</p>
                    <p className="text-muted-foreground">
                      Módulos não inclusos no novo plano serão desativados.
                      {changePlanDialog.plan.max_employees && currentCount > changePlanDialog.plan.max_employees && (
                        <> Você tem {currentCount} colaboradores, mas o plano permite apenas {changePlanDialog.plan.max_employees}.</>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Billing info */}
              <div className="rounded-lg bg-muted/30 border border-border/50 p-3 text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Ciclo: {billingInterval === 'annual' ? 'Anual' : 'Mensal'}
                </p>
                {billingInterval === 'annual' && changePlanDialog.plan.annual_price && (
                  <p className="flex items-center gap-1.5">
                    <CreditCard className="h-3 w-3" />
                    Total anual: {formatBRL(changePlanDialog.plan.annual_price)}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setChangePlanDialog(null)} disabled={processing}>
                Cancelar
              </Button>
              <Button
                onClick={handleChangePlan}
                disabled={processing}
                variant={changePlanDialog.direction === 'downgrade' ? 'outline' : 'default'}
                className="gap-1.5"
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                {changePlanDialog.direction === 'upgrade' ? 'Confirmar Upgrade' : 'Confirmar Downgrade'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
