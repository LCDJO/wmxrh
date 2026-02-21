/**
 * PromoteLandingButton — Wizard de 4 passos para criar campanha na Meta Ads.
 * URL do anúncio: {subdomain}.{cliente}.minha-plataforma.com
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Megaphone, CheckCircle2, ExternalLink,
  ChevronRight, ChevronLeft, User, Users, DollarSign, Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromoteLandingButtonProps {
  pageId: string;
  pageName: string;
  tenantId: string;
  /** Full deploy URL e.g. https://slug.cliente.minha-plataforma.com */
  deployUrl: string;
  disabled?: boolean;
  className?: string;
}

const STEPS = [
  { label: 'Conta Meta', icon: User },
  { label: 'Público', icon: Users },
  { label: 'Orçamento', icon: DollarSign },
  { label: 'Publicar', icon: Rocket },
] as const;

export function PromoteLandingButton({
  pageId,
  pageName,
  tenantId,
  deployUrl,
  disabled,
  className,
}: PromoteLandingButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [promoting, setPromoting] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const [checkingMeta, setCheckingMeta] = useState(false);
  const [result, setResult] = useState<{
    campaign_id: string;
    adset_id: string;
    ad_id: string;
  } | null>(null);

  // Form state
  const [form, setForm] = useState({
    // Targeting
    countries: 'BR',
    age_min: '18',
    age_max: '65',
    interests: '',
    // Budget
    daily_budget: '10.00',
  });

  // Check Meta connection on open
  useEffect(() => {
    if (!open || !tenantId) return;
    setCheckingMeta(true);
    supabase.functions
      .invoke('meta-ads-engine', {
        body: { action: 'get_connection', tenant_id: tenantId },
      })
      .then(({ data }) => {
        setMetaConnected(!!data?.connection);
      })
      .finally(() => setCheckingMeta(false));
  }, [open, tenantId]);

  const handleReset = () => {
    setStep(0);
    setResult(null);
    setForm({ countries: 'BR', age_min: '18', age_max: '65', interests: '', daily_budget: '10.00' });
  };

  const handlePromote = async () => {
    setPromoting(true);
    try {
      const budgetCents = Math.round(parseFloat(form.daily_budget) * 100);
      if (isNaN(budgetCents) || budgetCents < 100) {
        toast({ title: 'Orçamento inválido', description: 'Mínimo R$1,00.', variant: 'destructive' });
        setPromoting(false);
        return;
      }

      const countries = form.countries
        .split(',')
        .map(c => c.trim().toUpperCase())
        .filter(Boolean);

      const targeting: Record<string, unknown> = {
        geo_locations: { countries },
        age_min: parseInt(form.age_min) || 18,
        age_max: parseInt(form.age_max) || 65,
      };

      if (form.interests.trim()) {
        targeting.flexible_spec = [
          {
            interests: form.interests.split(',').map(i => ({ name: i.trim() })),
          },
        ];
      }

      const { data, error } = await supabase.functions.invoke('meta-ads-engine', {
        body: {
          action: 'promote_landing',
          landing_page_id: pageId,
          tenant_id: tenantId,
          daily_budget_cents: budgetCents,
          targeting,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({
        campaign_id: data.campaign_id,
        adset_id: data.adset_id,
        ad_id: data.ad_id,
      });
      toast({ title: 'Campanha criada!', description: data.message });
    } catch (err: any) {
      toast({ title: 'Erro ao promover', description: err.message, variant: 'destructive' });
    }
    setPromoting(false);
  };

  const canAdvance = () => {
    if (step === 0) return metaConnected;
    if (step === 1) return form.countries.trim().length > 0;
    if (step === 2) return parseFloat(form.daily_budget) >= 1;
    return true;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        setOpen(v);
        if (!v) handleReset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            'gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10',
            className
          )}
          disabled={disabled}
        >
          <Megaphone className="h-3.5 w-3.5" />
          Promover Landing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Promover: {pageName}
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        {!result && (
          <div className="flex items-center gap-1 mb-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={s.label} className="flex items-center gap-1 flex-1">
                  <div
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-colors w-full justify-center',
                      isActive && 'bg-primary/10 text-primary',
                      isDone && 'bg-primary/5 text-primary/60',
                      !isActive && !isDone && 'text-muted-foreground'
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Icon className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step Content */}
        {!result && (
          <div className="min-h-[200px]">
            {/* Step 0: Conta Meta */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Verificação de conexão</p>
                  <p>O Meta Ads precisa estar conectado nas configurações da plataforma.</p>
                </div>

                {checkingMeta ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : metaConnected ? (
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Meta Ads conectado</p>
                      <p className="text-xs text-muted-foreground">Conta vinculada e pronta para criar campanhas.</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                    <p className="text-sm font-medium text-foreground">Meta Ads não conectado</p>
                    <p className="text-xs text-muted-foreground">
                      Acesse <strong>Configurações → Parametrizações do SaaS</strong> e conecte sua conta Meta Ads antes de prosseguir.
                    </p>
                  </div>
                )}

                <div className="rounded-md bg-muted/30 p-3 text-xs space-y-1">
                  <p className="font-medium text-foreground">URL do anúncio:</p>
                  <code className="text-primary break-all">{deployUrl}</code>
                </div>
              </div>
            )}

            {/* Step 1: Público */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Países (códigos separados por vírgula)</Label>
                  <Input
                    placeholder="BR, PT, US"
                    value={form.countries}
                    onChange={e => setForm(f => ({ ...f, countries: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Idade mínima</Label>
                    <Input
                      type="number"
                      min="13"
                      max="65"
                      value={form.age_min}
                      onChange={e => setForm(f => ({ ...f, age_min: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Idade máxima</Label>
                    <Input
                      type="number"
                      min="13"
                      max="65"
                      value={form.age_max}
                      onChange={e => setForm(f => ({ ...f, age_max: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Interesses (opcional, separados por vírgula)</Label>
                  <Input
                    placeholder="tecnologia, marketing digital, empreendedorismo"
                    value={form.interests}
                    onChange={e => setForm(f => ({ ...f, interests: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Deixe em branco para segmentação ampla.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Orçamento */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Orçamento diário (R$)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.daily_budget}
                    onChange={e => setForm(f => ({ ...f, daily_budget: e.target.value }))}
                    className="max-w-40"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Mínimo R$1,00. A campanha será criada <strong>pausada</strong>.
                  </p>
                </div>

                <div className="rounded-md bg-muted/50 p-3 text-xs space-y-2">
                  <p className="font-medium text-foreground">Resumo da campanha</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">Objetivo: Tráfego</Badge>
                    <Badge variant="outline" className="text-[10px]">Otimização: Cliques</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Países: {form.countries || 'BR'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Idade: {form.age_min}-{form.age_max}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      R${form.daily_budget}/dia
                    </Badge>
                  </div>
                </div>

                <div className="rounded-md bg-muted/30 p-3 text-xs">
                  <p className="text-muted-foreground">URL de destino:</p>
                  <code className="text-primary break-all">{deployUrl}</code>
                </div>
              </div>
            )}

            {/* Step 3: Publicar */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-md bg-muted/50 p-4 text-xs space-y-3">
                  <p className="font-medium text-foreground text-sm">Confirme os dados da campanha</p>

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Landing Page</span>
                      <span className="font-medium text-foreground">{pageName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">URL</span>
                      <span className="font-medium text-primary truncate max-w-[200px]">{deployUrl}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Países</span>
                      <span className="font-medium text-foreground">{form.countries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Idade</span>
                      <span className="font-medium text-foreground">{form.age_min} – {form.age_max}</span>
                    </div>
                    {form.interests && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Interesses</span>
                        <span className="font-medium text-foreground truncate max-w-[200px]">{form.interests}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Orçamento/dia</span>
                      <span className="font-medium text-foreground">R${form.daily_budget}</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handlePromote}
                  disabled={promoting}
                  className="w-full gap-1.5"
                >
                  {promoting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando campanha…
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" />
                      Criar Campanha na Meta
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-medium text-foreground">Campanha criada com sucesso!</p>
              <p className="text-xs text-muted-foreground">
                Criada pausada. Ative no Meta Ads Manager.
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Campaign ID</span>
                <code className="text-foreground">{result.campaign_id}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">AdSet ID</span>
                <code className="text-foreground">{result.adset_id}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ad ID</span>
                <code className="text-foreground">{result.ad_id}</code>
              </div>
            </div>

            <Button variant="outline" className="w-full gap-1.5 text-xs" asChild>
              <a
                href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${result.campaign_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir no Meta Ads Manager
              </a>
            </Button>
          </div>
        )}

        {/* Navigation */}
        {!result && (
          <div className="flex justify-between pt-2 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              disabled={step === 0}
              onClick={() => setStep(s => s - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Voltar
            </Button>
            {step < 3 && (
              <Button
                size="sm"
                className="gap-1 text-xs"
                disabled={!canAdvance()}
                onClick={() => setStep(s => s + 1)}
              >
                Próximo
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
