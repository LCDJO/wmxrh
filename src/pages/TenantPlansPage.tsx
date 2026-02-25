/**
 * TenantPlansPage — Internal LP showing available SaaS plans for the tenant.
 * Reads plans from saas_plans and highlights the current tenant subscription.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useExperienceProfile } from '@/hooks/use-experience-profile';
import { PlanBadge } from '@/components/shared/PlanBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles, Zap, Star, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface SaasPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billing_cycle: string;
  allowed_modules: string[];
  feature_flags: string[];
  is_active: boolean;
}

const TIER_ICON: Record<string, React.ElementType> = {
  free: Zap,
  basic: Star,
  pro: Sparkles,
  enterprise: Crown,
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
  agreements: 'Acordos Coletivos',
  labor_rules: 'Regras Trabalhistas',
  esocial: 'eSocial',
  payroll_simulation: 'Simulação de Folha',
  workforce_intelligence: 'Inteligência RH',
  audit: 'Auditoria',
  iam: 'Gestão de Acessos',
  groups: 'Grupos Empresariais',
};

export default function TenantPlansPage() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { profile } = useExperienceProfile();
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [plansRes, subRes] = await Promise.all([
        supabase.from('saas_plans').select('*').eq('is_active', true).order('price', { ascending: true }),
        currentTenant?.id
          ? supabase.from('tenant_plans').select('plan_id, status').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setPlans((plansRes.data as SaasPlan[]) ?? []);
      if (subRes.data) setCurrentPlanId((subRes.data as any).plan_id);
      setLoading(false);
    }
    fetchData();
  }, [currentTenant?.id]);

  const handleSelectPlan = (plan: SaasPlan) => {
    if (plan.id === currentPlanId) return;
    toast.info(`Para alterar seu plano para ${plan.name}, entre em contato com o suporte ou acesse a área de faturamento.`);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3">
        <button
          onClick={() => navigate(-1)}
          className="absolute left-6 top-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <div className="flex items-center justify-center gap-2">
          <Crown className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold font-display text-foreground">
          Escolha o plano ideal para sua empresa
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Compare os recursos e encontre o plano perfeito para o tamanho e as necessidades do seu negócio.
        </p>
        {profile.plan_tier && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Seu plano atual:</span>
            <PlanBadge tier={profile.plan_tier} size="md" />
          </div>
        )}
      </div>

      {/* Plans grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const tierKey = plan.name.toLowerCase();
          const Icon = TIER_ICON[tierKey] ?? Star;

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col transition-all duration-300 hover:shadow-lg',
                isCurrent
                  ? 'border-primary shadow-md ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-3 py-0.5 shadow-sm">
                    Plano Atual
                  </Badge>
                </div>
              )}

              <CardContent className="flex flex-col flex-1 p-6 pt-8">
                {/* Plan header */}
                <div className="text-center space-y-3 mb-6">
                  <div className={cn(
                    'mx-auto flex h-12 w-12 items-center justify-center rounded-xl',
                    isCurrent ? 'bg-primary/15' : 'bg-muted'
                  )}>
                    <Icon className={cn('h-6 w-6', isCurrent ? 'text-primary' : 'text-muted-foreground')} />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                  </div>

                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2).replace('.', ',')}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm text-muted-foreground">/mês</span>
                    )}
                  </div>
                </div>

                {/* Module list */}
                <div className="flex-1 space-y-2 mb-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Módulos inclusos
                  </p>
                  <ul className="space-y-1.5">
                    {plan.allowed_modules.map((mod) => (
                      <li key={mod} className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-foreground">{MODULE_LABELS[mod] ?? mod}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Feature flags */}
                {plan.feature_flags.length > 0 && (
                  <div className="space-y-2 mb-6">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Recursos extras
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {plan.feature_flags.map((flag) => (
                        <Badge key={flag} variant="secondary" className="text-[10px]">
                          {flag.replace('ui:', '').replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <Button
                  className="w-full mt-auto"
                  variant={isCurrent ? 'outline' : tierKey === 'enterprise' ? 'default' : 'secondary'}
                  disabled={isCurrent}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {isCurrent ? 'Plano ativo' : plan.price === 0 ? 'Começar grátis' : 'Contratar plano'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="text-center pb-8">
        <p className="text-xs text-muted-foreground">
          Todos os planos incluem suporte por e-mail. Precisa de algo personalizado?{' '}
          <button
            onClick={() => toast.info('Entre em contato pelo suporte para planos customizados.')}
            className="text-primary hover:underline font-medium"
          >
            Fale conosco
          </button>
        </p>
      </div>
    </div>
  );
}
