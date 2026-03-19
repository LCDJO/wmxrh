import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/core/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Globe,
  CloudCog,
  Check,
  Loader2,
  Link2,
  Unlink,
  Shield,
  ExternalLink,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Server,
  ChevronLeft,
  ArrowRight,
  ChevronsRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhiteLabelConfig {
  id: string;
  domain_principal: string;
  cloudflare_zone_id: string;
  cloudflare_api_token: string;
  is_active: boolean | null;
  tenant_id: string | null;
}

interface CloudflareConnectCardProps {
  config: WhiteLabelConfig | null;
  onRefresh: () => void;
  canEdit: boolean;
}

interface AnalysisResult {
  domain?: string;
  nameservers?: string[];
  a_records?: string[];
  dns_provider?: string;
  is_cloudflare?: boolean;
  valid?: boolean;
  token_status?: string;
  account?: { id: string; name: string } | null;
  zones?: Array<{ id: string; name: string; status: string; name_servers: string[]; plan: string }>;
  matched_zone?: { id: string; name: string; status: string; name_servers: string[]; plan: string } | null;
  error?: string;
}

type AnalysisStep = { label: string; status: 'pending' | 'loading' | 'done' | 'error'; detail?: string };

export default function CloudflareConnectCard({ config, onRefresh, canEdit }: CloudflareConnectCardProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    domain_principal: config?.domain_principal || '',
    cloudflare_api_token: config?.cloudflare_api_token || '',
    cloudflare_zone_id: config?.cloudflare_zone_id || '',
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [showManualSetup, setShowManualSetup] = useState(false);

  const isConnected = !!config && !!config.cloudflare_api_token;

  const handleOpenConnect = () => {
    setForm({
      domain_principal: config?.domain_principal || '',
      cloudflare_api_token: config?.cloudflare_api_token || '',
      cloudflare_zone_id: config?.cloudflare_zone_id || '',
    });
    setStep(0);
    setShowToken(false);
    setAnalysisResult(null);
    setAnalysisSteps([]);
    setAuthorized(false);
    setShowManualSetup(false);
    setShowDialog(true);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisResult(null);
    const steps: AnalysisStep[] = [
      { label: `Analisando ${form.domain_principal}`, status: 'loading' },
      { label: 'Detectando DNS provider', status: 'pending' },
      { label: 'Preparando configuração', status: 'pending' },
    ];
    setAnalysisSteps([...steps]);
    setStep(1);

    await new Promise(r => setTimeout(r, 800));
    steps[0].status = 'done';
    steps[1].status = 'loading';
    setAnalysisSteps([...steps]);

    try {
      const { data, error } = await supabase.functions.invoke('landing-deploy', {
        body: { action: 'lookup_domain', domain: form.domain_principal },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      await new Promise(r => setTimeout(r, 600));
      steps[1].status = 'done';
      steps[1].detail = data.is_cloudflare ? 'Cloudflare' : (data.dns_provider || 'Detectado');
      steps[2].status = 'loading';
      setAnalysisSteps([...steps]);

      await new Promise(r => setTimeout(r, 500));
      steps[2].status = 'done';
      setAnalysisSteps([...steps]);

      setAnalysisResult(data);
    } catch (err: unknown) {
      const failIdx = steps.findIndex(s => s.status === 'loading');
      if (failIdx >= 0) {
        steps[failIdx].status = 'error';
        steps[failIdx].detail = err instanceof Error ? err.message : String(err);
      }
      setAnalysisSteps([...steps]);
      setAnalysisResult({ error: err instanceof Error ? err.message : String(err) });
    }
    setAnalyzing(false);
  };

  const runTokenValidation = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('landing-deploy', {
        body: { action: 'validate_cloudflare', api_token: form.cloudflare_api_token, domain: form.domain_principal },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setAuthorized(true);
      setAnalysisResult(prev => ({ ...prev, ...data }));
      if (data.matched_zone) {
        setForm(f => ({ ...f, cloudflare_zone_id: data.matched_zone.id }));
      }

      // Auto-save after successful authorization
      await handleSaveInternal({
        domain_principal: form.domain_principal,
        cloudflare_api_token: form.cloudflare_api_token,
        cloudflare_zone_id: data.matched_zone?.id || form.cloudflare_zone_id,
      });
    } catch (err: unknown) {
      toast({ title: 'Erro na autorização', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
    setAnalyzing(false);
  };

  const handleSaveInternal = async (formData: { domain_principal: string; cloudflare_api_token: string; cloudflare_zone_id: string }) => {
    if (!formData.domain_principal || !formData.cloudflare_zone_id || !formData.cloudflare_api_token) {
      toast({ title: 'Dados incompletos', variant: 'destructive' });
      return;
    }
    setSaving(true);
    if (config) {
      const { error } = await supabase.from('white_label_config').update({
        domain_principal: formData.domain_principal,
        cloudflare_zone_id: formData.cloudflare_zone_id,
        cloudflare_api_token: formData.cloudflare_api_token,
        is_active: true,
      }).eq('id', config.id);
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Cloudflare conectado!', description: 'Credenciais salvas com sucesso.' });
        setShowDialog(false);
        onRefresh();
      }
    } else {
      const { error } = await supabase.from('white_label_config').insert({
        domain_principal: formData.domain_principal,
        cloudflare_zone_id: formData.cloudflare_zone_id,
        cloudflare_api_token: formData.cloudflare_api_token,
        is_active: true,
      });
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Cloudflare conectado!', description: 'Integração criada.' });
        setShowDialog(false);
        onRefresh();
      }
    }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase.from('white_label_config').update({
      cloudflare_api_token: '',
      cloudflare_zone_id: '',
      is_active: false,
    }).eq('id', config.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Desconectado', description: 'Integração Cloudflare removida.' });
      setShowDisconnect(false);
      onRefresh();
    }
    setSaving(false);
  };

  const maskToken = (token: string) => {
    if (!token || token.length < 8) return '••••••••';
    return token.slice(0, 4) + '••••••••' + token.slice(-4);
  };

  const canAnalyze = !!form.domain_principal;
  const analysisSuccess = !analysisResult?.error && !!analysisResult?.domain;

  // ── Step 0: Domain input ──
  const renderStep0 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Informe o domínio que deseja conectar. Na próxima etapa, analisaremos automaticamente a configuração DNS.
      </p>
      <div className="p-3 rounded-md border bg-muted/30 space-y-2">
        <Label className="text-xs font-semibold">Domínio Principal</Label>
        <p className="text-xs text-muted-foreground">O domínio raiz para subdomínios das landing pages.</p>
        <Input
          value={form.domain_principal}
          onChange={e => setForm(f => ({ ...f, domain_principal: e.target.value }))}
          placeholder="minha-plataforma.com"
        />
      </div>
    </div>
  );

  // ── Step 1: DNS analysis ──
  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="flex flex-col items-center py-4 space-y-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Globe className="h-8 w-8 text-primary" />
        </div>
        <p className="text-base font-semibold">Analisando seu domínio</p>
      </div>
      <div className="space-y-3 px-2">
        {analysisSteps.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            {s.status === 'loading' && <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />}
            {s.status === 'done' && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
            {s.status === 'error' && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
            {s.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
            <div className="flex-1">
              <p className={cn('text-sm', s.status === 'pending' && 'text-muted-foreground')}>
                {s.label}
                {s.detail && (
                  <span className="ml-2 font-medium text-foreground">
                    {s.status === 'done' && s.detail.includes('Cloudflare') ? (
                      <Badge variant="outline" className="text-[10px] ml-1 border-primary/30 text-primary">{s.detail}</Badge>
                    ) : s.detail}
                  </span>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
      {analysisResult?.error && (
        <div className="p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm text-destructive">
          {analysisResult.error}
        </div>
      )}
      {analysisSuccess && (
        <div className="p-3 rounded-md border bg-muted/30 space-y-2 mt-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">DNS Provider</span>
              <p className="font-medium">{analysisResult.dns_provider}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Cloudflare</span>
              <p className="font-medium">{analysisResult.is_cloudflare ? '✓ Sim' : '✗ Não'}</p>
            </div>
            {analysisResult.nameservers && analysisResult.nameservers.length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Nameservers</span>
                <p className="font-mono text-[11px]">{analysisResult.nameservers.join(', ')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ── Step 2: Authorize (final step — matches Lovable/Entri UX) ──
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-6 space-y-5">
        {/* Cloudflare Logo */}
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 48 48" className="h-16 w-16" fill="none">
            <path d="M33.6 28.8c.2-.6.1-1.2-.2-1.6-.3-.4-.8-.6-1.3-.7l-16.4-.2c-.1 0-.2-.1-.3-.1-.1-.1-.1-.2 0-.3.1-.2.2-.3.4-.3l16.5-.2c1.5-.1 3.1-1.3 3.7-2.7l.8-2c0-.1.1-.2 0-.3C35.6 15.6 30.8 12 25.2 12c-5 0-9.3 3-11.2 7.3-.9-.7-2.1-1-3.3-.9-2.2.3-4 2-4.3 4.2-.1.6 0 1.2.1 1.8C3.3 24.6 1 27.1 1 30.1c0 .3 0 .6.1.9.1.1.1.2.3.2h31.7c.2 0 .4-.1.4-.3l.1-2.1z" fill="#F6821F"/>
            <path d="M38.4 24.4h-.3c-.1 0-.2.1-.2.2l-.5 1.8c-.2.6-.1 1.2.2 1.6.3.4.8.6 1.3.7l3.6.2c.1 0 .2.1.3.1.1.1.1.2 0 .3-.1.2-.2.3-.4.3l-3.7.2c-1.5.1-3.1 1.3-3.7 2.7l-.2.6c-.1.1 0 .2.1.2h12c.2 0 .3-.1.3-.3.3-1 .5-2 .5-3.1.1-3-2.3-5.5-5.2-5.5h-4.1z" fill="#FBAD41"/>
          </svg>
          <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Cloudflare</span>
        </div>

        {!authorized && !showManualSetup && (
          <>
            <div className="text-center space-y-1.5 max-w-sm">
              <p className="text-sm text-muted-foreground">
                By authorizing with your Cloudflare account, you give us
              </p>
              <p className="text-sm font-semibold">
                one-time permission to connect your domain.
              </p>
            </div>

            <Button
              size="lg"
              className="w-full max-w-xs gap-2 bg-[#F6821F] hover:bg-[#E5731A] text-white"
              onClick={() => {
                // Open Cloudflare API Tokens page pre-configured for "Edit zone DNS"
                window.open(
                  'https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22zone_dns%22%2C%22type%22%3A%22edit%22%7D%5D&name=LandingPageDeploy&accountId=all&zoneId=all',
                  '_blank',
                  'noopener,noreferrer'
                );
                // Show the token input after opening
                setShowManualSetup(true);
              }}
              disabled={analyzing}
            >
              <CloudCog className="h-5 w-5" />
              Authorize with Cloudflare
            </Button>

            <button
              type="button"
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => setShowManualSetup(true)}
            >
              Go to our manual setup
            </button>

            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
                onClick={() => setStep(0)}
              >
                Change provider
              </button>
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground transition-colors flex items-center gap-1"
              >
                Show added DNS records
                <ChevronsRight className="h-3 w-3" />
              </button>
            </div>
          </>
        )}

        {showManualSetup && !authorized && (
          <div className="w-full max-w-sm space-y-4">
            <div className="p-3 rounded-md border bg-muted/20 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">Cole o API Token</p>
              <p>
                Crie em{' '}
                <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                  Cloudflare → API Tokens <ExternalLink className="h-2.5 w-2.5" />
                </a>
                {' '}usando o template <strong>"Edit zone DNS"</strong>.
              </p>
            </div>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={form.cloudflare_api_token}
                onChange={e => setForm(f => ({ ...f, cloudflare_api_token: e.target.value }))}
                placeholder="Cole o API Token aqui"
                className="font-mono text-xs pr-10"
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <Button
              className="w-full gap-2"
              onClick={runTokenValidation}
              disabled={!form.cloudflare_api_token || analyzing || saving}
            >
              {analyzing || saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              {analyzing ? 'Validando…' : saving ? 'Salvando…' : 'Validar e Conectar'}
            </Button>
          </div>
        )}

        {authorized && (
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-emerald-600">Conectado com sucesso!</p>
            <div className="w-full p-4 rounded-lg border bg-muted/30 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">Domínio:</span>
                <span className="font-medium">{form.domain_principal}</span>
              </div>
              {form.cloudflare_zone_id && (
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">Zone ID:</span>
                  <span className="font-mono text-xs">{form.cloudflare_zone_id.slice(0, 16)}…</span>
                </div>
              )}
              {analysisResult?.account && (
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">Conta:</span>
                  <span className="font-medium">{analysisResult.account.name}</span>
                </div>
              )}
              {analysisResult?.matched_zone?.plan && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-muted-foreground">Plano:</span>
                  <Badge variant="outline" className="text-[10px]">{analysisResult.matched_zone.plan}</Badge>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const stepTitles = ['1. Domínio', '2. Análise DNS', '3. Autorização'];
  const totalSteps = 3;

  const handleNext = () => {
    if (step === 0) {
      runAnalysis();
    } else if (step === 1 && analysisSuccess) {
      setStep(2);
    }
  };

  const canProceed = step === 0
    ? canAnalyze
    : step === 1
    ? analysisSuccess && !analyzing
    : false; // Step 2 handles its own save flow

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-[hsl(var(--primary)/0.1)]">
                <CloudCog className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Cloudflare DNS
                  {isConnected && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                      <Check className="h-3 w-3 mr-0.5" />
                      Conectado
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Integração para deploy automático de landing pages via DNS</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Domínio</p>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-primary" />
                    {config.domain_principal}
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Zone ID</p>
                  <p className="text-sm font-mono text-muted-foreground">{config.cloudflare_zone_id.slice(0, 8)}••••</p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">API Token</p>
                  <p className="text-sm font-mono text-muted-foreground flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    {maskToken(config.cloudflare_api_token)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={handleOpenConnect} disabled={!canEdit}>
                  <Link2 className="h-4 w-4 mr-1" />
                  Reconfigurar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowDisconnect(true)} disabled={!canEdit} className="text-destructive hover:text-destructive">
                  <Unlink className="h-4 w-4 mr-1" />
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                <CloudCog className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Nenhuma integração configurada</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Conecte sua conta Cloudflare para habilitar o deploy automático de landing pages com subdomínios personalizados.
                </p>
              </div>
              <Button onClick={handleOpenConnect} disabled={!canEdit} className="gap-2">
                <CloudCog className="h-4 w-4" />
                Conectar Cloudflare
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect Dialog — 3 steps */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudCog className="h-5 w-5 text-primary" />
              Conectar Cloudflare
            </DialogTitle>
            <DialogDescription>Siga os passos para vincular sua conta Cloudflare.</DialogDescription>
          </DialogHeader>

          {/* Step indicators — dots like in screenshot */}
          <div className="flex items-center justify-center gap-3 py-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={cn(
                  'h-2.5 w-2.5 rounded-full transition-colors',
                  i <= step ? 'bg-foreground' : 'bg-muted-foreground/30'
                )} />
                {i < totalSteps - 1 && (
                  <div className={cn('w-8 h-0.5 transition-colors', i < step ? 'bg-foreground' : 'bg-muted-foreground/20')} />
                )}
              </div>
            ))}
          </div>

          <div className="py-2">
            <h4 className="font-semibold text-sm mb-3">{stepTitles[step]}</h4>
            {step === 0 && renderStep0()}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (step === 1) { setAnalysisResult(null); setAnalysisSteps([]); }
                if (step === 2) { setShowManualSetup(false); setAuthorized(false); }
                setStep(s => Math.max(0, s - 1));
              }}
              disabled={step === 0 || analyzing}
              size="sm"
            >
              <ChevronLeft className="h-4 w-4 mr-0.5" />
              Voltar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              {step < 2 && (
                <Button onClick={handleNext} disabled={!canProceed || analyzing} size="sm">
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {step === 0 ? 'Analisar Domínio' : 'Próximo'}
                </Button>
              )}
              {step === 2 && authorized && (
                <Button size="sm" onClick={() => setShowDialog(false)}>
                  <Check className="h-4 w-4 mr-1" />
                  Fechar
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation */}
      <Dialog open={showDisconnect} onOpenChange={setShowDisconnect}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desconectar Cloudflare?</DialogTitle>
            <DialogDescription>As credenciais serão removidas e o deploy automático ficará indisponível até uma nova conexão.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisconnect(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Unlink className="h-4 w-4 mr-1" />}
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
