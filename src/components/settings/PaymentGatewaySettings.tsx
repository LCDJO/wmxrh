/**
 * PaymentGatewaySettings — Configuração do gateway de pagamento por tenant.
 * Permite configurar provider, chave API e ambiente (sandbox/production).
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  tenantId: string;
}

interface GatewayConfig {
  provider: string;
  environment: string;
  is_active: boolean;
  has_api_key: boolean;
}

export function PaymentGatewaySettings({ tenantId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<GatewayConfig | null>(null);

  // Form state
  const [provider, setProvider] = useState('stripe');
  const [environment, setEnvironment] = useState('sandbox');
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [tenantId]);

  async function loadConfig() {
    try {
      const { data, error } = await supabase.functions.invoke('payment-gateway', {
        body: { tenant_id: tenantId },
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      // Use query param approach
      const res = await supabase.functions.invoke('payment-gateway?action=get-config', {
        body: { tenant_id: tenantId },
      });

      if (res.data?.config) {
        const c = res.data.config;
        setConfig(c);
        setProvider(c.provider);
        setEnvironment(c.environment);
        setIsActive(c.is_active);
      }
    } catch {
      // No config yet — that's fine
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await supabase.functions.invoke('payment-gateway?action=save-config', {
        body: {
          tenant_id: tenantId,
          provider,
          environment,
          api_key: apiKey || undefined,
          webhook_secret: webhookSecret || undefined,
          is_active: isActive,
        },
      });

      if (res.error) throw res.error;

      toast({
        title: 'Configuração salva',
        description: 'Gateway de pagamento atualizado com sucesso.',
      });

      setApiKey('');
      setWebhookSecret('');
      await loadConfig();
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message ?? 'Falha ao salvar configuração do gateway.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle>Gateway de Pagamento</CardTitle>
          {config?.is_active ? (
            <Badge variant="default" className="ml-auto gap-1">
              <CheckCircle2 className="h-3 w-3" /> Ativo
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-auto gap-1">
              <AlertTriangle className="h-3 w-3" /> Inativo
            </Badge>
          )}
        </div>
        <CardDescription>
          Configure o provedor de pagamentos para processar cobranças automaticamente.
          As chaves são armazenadas de forma segura no servidor.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Provider */}
        <div className="space-y-2">
          <Label>Provedor</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="pagarme">Pagar.me</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Environment */}
        <div className="space-y-2">
          <Label>Ambiente</Label>
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
              <SelectItem value="production">Produção</SelectItem>
            </SelectContent>
          </Select>
          {environment === 'production' && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Atenção: transações em produção são reais.
            </p>
          )}
        </div>

        {/* API Key */}
        {provider !== 'manual' && (
          <div className="space-y-2">
            <Label>Chave de API (Secret Key)</Label>
            <Input
              type="password"
              placeholder={config?.has_api_key ? '••••••••••••••••' : 'sk_test_... ou sk_live_...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {config?.has_api_key
                ? 'Uma chave já está configurada. Deixe em branco para manter a atual.'
                : 'Use uma chave restrita (Restricted Key) com permissões mínimas.'}
            </p>
          </div>
        )}

        {/* Webhook Secret */}
        {provider !== 'manual' && (
          <div className="space-y-2">
            <Label>Webhook Secret</Label>
            <Input
              type="password"
              placeholder="whsec_..."
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Configure o webhook no painel do provedor apontando para o endpoint de webhook.
            </p>
          </div>
        )}

        {/* Active toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label>Ativar gateway</Label>
            <p className="text-xs text-muted-foreground">
              Habilita cobranças automáticas via este provedor.
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Salvando...' : 'Salvar Configuração'}
        </Button>
      </CardContent>
    </Card>
  );
}
