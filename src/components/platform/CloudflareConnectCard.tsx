import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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
} from 'lucide-react';

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

export default function CloudflareConnectCard({ config, onRefresh, canEdit }: CloudflareConnectCardProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    domain_principal: config?.domain_principal || '',
    cloudflare_zone_id: config?.cloudflare_zone_id || '',
    cloudflare_api_token: config?.cloudflare_api_token || '',
  });

  const isConnected = !!config && !!config.cloudflare_api_token;

  const handleOpenConnect = () => {
    setForm({
      domain_principal: config?.domain_principal || '',
      cloudflare_zone_id: config?.cloudflare_zone_id || '',
      cloudflare_api_token: config?.cloudflare_api_token || '',
    });
    setStep(0);
    setShowToken(false);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.domain_principal || !form.cloudflare_zone_id || !form.cloudflare_api_token) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setSaving(true);
    if (config) {
      const { error } = await supabase.from('white_label_config').update({
        domain_principal: form.domain_principal,
        cloudflare_zone_id: form.cloudflare_zone_id,
        cloudflare_api_token: form.cloudflare_api_token,
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
        domain_principal: form.domain_principal,
        cloudflare_zone_id: form.cloudflare_zone_id,
        cloudflare_api_token: form.cloudflare_api_token,
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

  const steps = [
    {
      title: '1. Acesse o Painel Cloudflare',
      description: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Acesse o <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">Painel da Cloudflare <ExternalLink className="h-3 w-3" /></a> e selecione o domínio que deseja configurar.
          </p>
          <div className="p-3 rounded-md border bg-muted/50 space-y-2">
            <Label className="text-xs font-semibold">Domínio Principal</Label>
            <p className="text-xs text-muted-foreground">O domínio raiz que será usado para criar subdomínios das landing pages.</p>
            <Input
              value={form.domain_principal}
              onChange={e => setForm(f => ({ ...f, domain_principal: e.target.value }))}
              placeholder="minha-plataforma.com"
            />
          </div>
        </div>
      ),
    },
    {
      title: '2. Copie o Zone ID',
      description: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No painel do domínio, role até a seção <strong>"API"</strong> na barra lateral direita. Copie o <strong>Zone ID</strong>.
          </p>
          <div className="p-3 rounded-md border bg-muted/50 space-y-2">
            <Label className="text-xs font-semibold">Zone ID</Label>
            <Input
              value={form.cloudflare_zone_id}
              onChange={e => setForm(f => ({ ...f, cloudflare_zone_id: e.target.value }))}
              placeholder="cole o Zone ID aqui"
              className="font-mono text-xs"
            />
          </div>
        </div>
      ),
    },
    {
      title: '3. Crie um API Token',
      description: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Vá em <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">API Tokens <ExternalLink className="h-3 w-3" /></a> → <strong>Create Token</strong> → use o template <strong>"Edit zone DNS"</strong>.
          </p>
          <div className="p-3 rounded-md border bg-muted/50 space-y-2">
            <Label className="text-xs font-semibold">API Token</Label>
            <p className="text-xs text-muted-foreground">Cole o token gerado pela Cloudflare. Ele será armazenado de forma segura.</p>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={form.cloudflare_api_token}
                onChange={e => setForm(f => ({ ...f, cloudflare_api_token: e.target.value }))}
                placeholder="cole o API Token aqui"
                className="font-mono text-xs pr-10"
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
          </div>
        </div>
      ),
    },
  ];

  const canProceed = step === 0
    ? !!form.domain_principal
    : step === 1
    ? !!form.cloudflare_zone_id
    : !!form.cloudflare_api_token;

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

      {/* Connect Dialog — step-by-step */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudCog className="h-5 w-5 text-primary" />
              Conectar Cloudflare
            </DialogTitle>
            <DialogDescription>Siga os passos para vincular sua conta Cloudflare.</DialogDescription>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex items-center gap-2 px-1">
            {steps.map((_, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`h-2 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted/50'}`} />
              </div>
            ))}
          </div>

          <div className="py-2">
            <h4 className="font-semibold text-sm mb-3">{steps[step].title}</h4>
            {steps[step].description}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
            >
              Voltar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed}>
                  Próximo
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={!canProceed || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Conectar
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
