import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bot, Brain, Crown, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlanBadge } from '@/components/shared/PlanBadge';
import { cn } from '@/lib/utils';
import {
  getTalentUsagePercentage,
  talentAddonCatalog,
  talentGrowthStrategies,
  talentMonetizationPlans,
  talentRevenueMetrics,
  talentUpsellTriggers,
  type TalentUsageSnapshot,
} from './monetization-data';

interface TalentMonetizationViewProps {
  currentPlan: TalentUsageSnapshot;
}

function formatPrice(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

export function TalentMonetizationView({ currentPlan }: TalentMonetizationViewProps) {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(currentPlan.billingCycle);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-card">
        <div className="grid gap-5 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div className="space-y-4">
            <Badge className="w-fit rounded-full border-transparent bg-accent px-3 py-1 text-accent-foreground">
              Estratégia de monetização do Talent Intelligence Hub
            </Badge>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Modelo híbrido: assinatura mensal + consumo pay-per-use.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Estrutura pensada para maximizar MRR, capturar expansão por uso e criar gatilhos naturais de upgrade por tenant.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: Crown,
                  title: `Plano atual: ${currentPlan.currentPlanName}`,
                  description: 'Base de entrada para operação enxuta.',
                },
                {
                  icon: Bot,
                  title: `${currentPlan.usage.creditsUsed}/${currentPlan.usage.creditsIncluded} créditos`,
                  description: 'Consumo mensal para consultas e IA.',
                },
                {
                  icon: Brain,
                  title: 'Upsell automático ativo',
                  description: 'Disparo por limite, feature lock e add-on.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-border bg-background/80 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Card className="rounded-[24px] border-primary/20 shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">Uso do tenant</CardTitle>
              <CardDescription>Leitura visual para limites, trial e expansão comercial.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PlanBadge tier={currentPlan.currentTier} planName={`Plano ${currentPlan.currentPlanName}`} />
              {[
                ['Candidatos', currentPlan.usage.candidatesUsed, currentPlan.usage.candidatesLimit],
                ['Vagas ativas', currentPlan.usage.activeJobsUsed, currentPlan.usage.activeJobsLimit],
                ['Créditos mensais', currentPlan.usage.creditsUsed, currentPlan.usage.creditsIncluded],
              ].map(([label, used, limit]) => (
                <div key={String(label)} className="space-y-2 rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{label}</span>
                    <span className="text-muted-foreground">{used}/{limit}</span>
                  </div>
                  <Progress value={getTalentUsagePercentage(Number(used), Number(limit))} />
                </div>
              ))}
              <Button onClick={() => navigate('/plans')} className="w-full rounded-xl">
                Ir para Meu Plano
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-[24px] border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Tabela de planos</p>
          <p className="text-sm text-muted-foreground">Sugestão comercial com desconto no anual equivalente a ~2 meses grátis.</p>
        </div>
        <div className="inline-flex rounded-xl border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-colors', billingCycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-colors', billingCycle === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            Anual
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {talentMonetizationPlans.map((plan) => {
          const price = billingCycle === 'monthly' ? formatPrice(plan.monthlyPrice) : formatPrice(plan.annualMonthlyPrice);
          const cadence = billingCycle === 'monthly' ? '/mês' : '/mês no anual';
          const isCurrent = plan.id === currentPlan.currentTier;

          return (
            <Card key={plan.id} className={cn('rounded-[24px] shadow-card', plan.highlighted && 'border-primary shadow-card-hover')}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <PlanBadge tier={plan.id} planName={plan.name} />
                    <CardTitle className="mt-4 text-2xl">{price}<span className="ml-1 text-sm font-normal text-muted-foreground">{cadence}</span></CardTitle>
                    <CardDescription className="mt-2">{plan.description}</CardDescription>
                  </div>
                  {plan.highlighted && (
                    <Badge className="rounded-full border-transparent bg-accent px-3 py-1 text-accent-foreground">Melhor conversão</Badge>
                  )}
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-xs text-muted-foreground">Cobrado {formatPrice(plan.annualTotalPrice)} por ano.</p>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Candidatos</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{plan.candidateLimit ? plan.candidateLimit.toLocaleString('pt-BR') : 'Ilimitado'}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Vagas ativas</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{plan.activeJobsLimit ?? 'Ilimitado'}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Créditos</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{plan.includedCredits}/mês</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">Incluso no plano</p>
                  <ul className="mt-3 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">Add-ons estratégicos</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {plan.addons.map((addon) => (
                      <Badge key={addon} variant="outline" className="rounded-full bg-background">
                        {addon}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button onClick={() => navigate('/plans')} variant={plan.highlighted ? 'default' : 'outline'} className="w-full rounded-xl">
                  {isCurrent ? 'Gerenciar plano atual' : `Migrar para ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-[24px] shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Add-ons pay-per-use</CardTitle>
          <CardDescription>Margem incremental com consultas e automações de alto valor percebido.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Add-on</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Cobrança</TableHead>
                <TableHead>Posicionamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {talentAddonCatalog.map((addon) => (
                <TableRow key={addon.name}>
                  <TableCell className="font-medium text-foreground">{addon.name}</TableCell>
                  <TableCell>{addon.priceRange}</TableCell>
                  <TableCell>{addon.billingMode}</TableCell>
                  <TableCell className="text-muted-foreground">{addon.positioning}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[24px] shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Métricas de negócio</CardTitle>
            <CardDescription>CAC, LTV, MRR, churn e receita por consulta monitorados em uma camada só.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {talentRevenueMetrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{metric.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{metric.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card className="rounded-[24px] shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">Estratégia de crescimento</CardTitle>
              <CardDescription>Combinação entre ativação, expansão e aumento de ticket por tenant.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {talentGrowthStrategies.map((strategy) => (
                <div key={strategy.title} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                      <Zap className="h-4 w-4" />
                    </div>
                    <p className="font-semibold text-foreground">{strategy.title}</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{strategy.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">Gatilhos de upsell</CardTitle>
              <CardDescription>Regras visuais e contextuais para ampliar conversão sem atrito.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {talentUpsellTriggers.map((trigger) => (
                <div key={trigger} className="flex items-start gap-3 rounded-2xl border border-border p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <p className="text-sm text-muted-foreground">{trigger}</p>
                </div>
              ))}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-foreground">Diferencial competitivo</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  “Background Check integrado ao RH” + “Score inteligente de candidatos” para aumentar ticket e retenção.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
