import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security/use-permissions';
import {
  getPlanAllowedSignatureProviders,
  PLAN_SCOPED_SIGNATURE_PROVIDERS,
  SIGNATURE_PROVIDER_DESCRIPTIONS,
  SIGNATURE_PROVIDER_LABELS,
  type PlanScopedSignatureProvider,
} from '@/domains/employee-agreement/signature-provider-governance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { FileSignature, Save, Loader2, KeyRound } from 'lucide-react';
import { buildAgreementWebhookUrl } from '@/domains/employee-agreement/signature-webhook-url';

const formSchema = z.object({
  integrationKey: z.string().trim().min(1, 'Integration Key é obrigatória.').max(255),
  userId: z.string().trim().min(1, 'User ID é obrigatório.').max(255),
  accountId: z.string().trim().min(1, 'Account ID é obrigatório.').max(255),
  authServer: z.string().trim().min(1, 'Auth Server é obrigatório.').max(255),
  baseUrl: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v ? v.replace(/\/$/, '') : '')),
  webhookSecret: z.string().max(500).optional(),
  privateKey: z.string().max(12000).optional(),
  isEnabled: z.boolean(),
  isDefault: z.boolean(),
});

function AccessDenied() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acesso restrito</CardTitle>
        <CardDescription>Apenas admins/owners do tenant podem gerenciar credenciais de assinatura.</CardDescription>
      </CardHeader>
    </Card>
  );
}

function ProviderLockedByPlan() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider indisponível no plano</CardTitle>
        <CardDescription>O tenant só pode configurar provedores liberados no plano contratado.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Peça ao administrador da plataforma para liberar o provider desejado no cadastro do plano.
        </p>
      </CardContent>
    </Card>
  );
}

export default function TenantDocumentSignatureIntegration() {
  const { currentTenant } = useTenant();
  const { hasRole, isTenantAdmin, loading: permissionsLoading } = usePermissions();
  const tenantId = currentTenant?.id ?? null;
  const queryClient = useQueryClient();

  const isAdmin = isTenantAdmin || hasRole('owner', 'admin');

  const [selectedProvider, setSelectedProvider] = useState<PlanScopedSignatureProvider>('docusign');
  const [integrationKey, setIntegrationKey] = useState('');
  const [userId, setUserId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [authServer, setAuthServer] = useState('account-d.docusign.com');
  const [baseUrl, setBaseUrl] = useState('https://demo.docusign.net/restapi');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  const [hasApiKeyStored, setHasApiKeyStored] = useState(false);
  const [hasWebhookSecretStored, setHasWebhookSecretStored] = useState(false);
  const [privateKeyConfigured, setPrivateKeyConfigured] = useState(false);

  const { data: planData, isLoading: loadingPlan } = useQuery({
    queryKey: ['tenant-signature-plan-providers', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data: tenantPlan, error: tenantPlanError } = await supabase
        .from('tenant_plans')
        .select('plan_id')
        .eq('tenant_id', tenantId!)
        .in('status', ['active', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tenantPlanError) throw tenantPlanError;
      if (!tenantPlan?.plan_id) return { featureFlags: [] as string[] };

      const { data: plan, error: planError } = await supabase
        .from('saas_plans')
        .select('feature_flags')
        .eq('id', tenantPlan.plan_id)
        .maybeSingle();

      if (planError) throw planError;
      return { featureFlags: (plan?.feature_flags ?? []) as string[] };
    },
  });

  const allowedProviders = useMemo(() => {
    const parsed = getPlanAllowedSignatureProviders(planData?.featureFlags ?? []);
    return parsed.length > 0 ? parsed : PLAN_SCOPED_SIGNATURE_PROVIDERS;
  }, [planData?.featureFlags]);

  const isProviderAllowed = allowedProviders.includes(selectedProvider);

  const { isLoading } = useQuery({
    queryKey: ['tenant-signature-provider', tenantId, selectedProvider],
    enabled: Boolean(tenantId && isAdmin && isProviderAllowed),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_tenant_signature_integrations', {
        _tenant_id: tenantId!,
      });

      if (error) throw error;

      const integration = (data ?? []).find((item) => item.provider_name === selectedProvider);
      const cfg = (integration?.config ?? {}) as Record<string, unknown>;

      setIntegrationKey(String(cfg.client_id ?? ''));
      setUserId(String(cfg.user_id ?? ''));
      setAccountId(String(integration?.account_id ?? ''));
      setAuthServer(String(cfg.auth_server ?? 'account-d.docusign.com'));
      setBaseUrl(String(integration?.base_url ?? 'https://demo.docusign.net/restapi'));
      setIsEnabled(Boolean(integration?.is_enabled ?? false));
      setIsDefault(Boolean(integration?.is_default ?? false));
      setHasApiKeyStored(Boolean(integration?.has_api_key));
      setHasWebhookSecretStored(Boolean(integration?.has_webhook_secret));
      setPrivateKeyConfigured(Boolean(cfg.private_key_configured));

      return integration ?? null;
    },
  });

  const callbackUrl = useMemo(() => {
    try {
      return buildAgreementWebhookUrl();
    } catch {
      return 'URL indisponível (configure VITE_SUPABASE_PROJECT_ID)';
    }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!allowedProviders.includes(selectedProvider)) {
        throw new Error('Este provider não está liberado no plano do cliente.');
      }

      const parsed = formSchema.parse({
        integrationKey,
        userId,
        accountId,
        authServer,
        baseUrl,
        webhookSecret,
        privateKey,
        isEnabled,
        isDefault,
      });

      const trimmedPrivateKey = parsed.privateKey?.trim() ?? '';
      const trimmedWebhookSecret = parsed.webhookSecret?.trim() ?? '';
      const requiresJwtFields = selectedProvider === 'docusign';

      if (parsed.isEnabled) {
        const hasIntegrationConfigured = parsed.integrationKey.trim().length > 0;
        if (!hasIntegrationConfigured) {
          throw new Error('Para habilitar, informe ao menos a credencial principal do provider.');
        }

        if (requiresJwtFields) {
          const hasDocuSignConfigured = parsed.userId.trim().length > 0 && parsed.accountId.trim().length > 0;
          if (!hasDocuSignConfigured) {
            throw new Error('Para DocuSign, informe User ID e Account ID.');
          }

          if (!trimmedPrivateKey && !privateKeyConfigured) {
            throw new Error('Informe a RSA Private Key na primeira configuração do DocuSign.');
          }
        }
      }

      const providerMetadata = {
        client_id: parsed.integrationKey.trim(),
        user_id: parsed.userId.trim(),
        auth_server: parsed.authServer.trim(),
        private_key_configured: selectedProvider === 'docusign'
          ? privateKeyConfigured || Boolean(trimmedPrivateKey)
          : false,
      };

      const { error } = await supabase.rpc('upsert_tenant_signature_integration', {
        _tenant_id: tenantId!,
        _provider_name: selectedProvider,
        _account_id: parsed.accountId.trim() || undefined,
        _client_id: parsed.integrationKey.trim(),
        _is_enabled: parsed.isEnabled,
        _is_default: parsed.isDefault,
        _provider_metadata: providerMetadata,
        _api_key: parsed.integrationKey.trim(),
        _webhook_secret: trimmedWebhookSecret || undefined,
        _private_key: selectedProvider === 'docusign' ? (trimmedPrivateKey || undefined) : undefined,
      });

      if (error) throw error;

      setWebhookSecret('');
      setPrivateKey('');
      setHasApiKeyStored(true);
      setHasWebhookSecretStored(hasWebhookSecretStored || Boolean(trimmedWebhookSecret));
      setPrivateKeyConfigured(selectedProvider === 'docusign' && (privateKeyConfigured || Boolean(trimmedPrivateKey)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-signature-provider'] });
      toast.success(`Configuração de ${SIGNATURE_PROVIDER_LABELS[selectedProvider]} salva com sucesso.`);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Falha ao salvar configuração do provider.';
      toast.error(message);
    },
  });

  if (permissionsLoading || isLoading || loadingPlan) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando integração de assinatura...
      </div>
    );
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  if (!isProviderAllowed) {
    return <ProviderLockedByPlan />;
  }

  const providerLabel = SIGNATURE_PROVIDER_LABELS[selectedProvider];
  const providerDescription = SIGNATURE_PROVIDER_DESCRIPTIONS[selectedProvider];
  const isDocuSign = selectedProvider === 'docusign';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSignature className="h-6 w-6" />
            Assinatura Digital
          </h1>
          <p className="text-sm text-muted-foreground mt-1">O tenant só pode usar os provedores liberados no plano contratado.</p>
        </div>
        <Badge variant={isEnabled ? 'default' : 'secondary'}>{isEnabled ? 'Habilitado' : 'Desabilitado'}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider liberado no plano</CardTitle>
          <CardDescription>Escolha qual integração permitida pelo plano será configurada neste tenant.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {allowedProviders.map((provider) => {
            const active = provider === selectedProvider;
            return (
              <button
                key={provider}
                type="button"
                onClick={() => setSelectedProvider(provider)}
                className={`rounded-md border p-3 text-left transition-colors ${active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'}`}
              >
                <p className="text-sm font-medium text-foreground">{SIGNATURE_PROVIDER_LABELS[provider]}</p>
                <p className="mt-1 text-xs text-muted-foreground">{SIGNATURE_PROVIDER_DESCRIPTIONS[provider]}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estado da integração</CardTitle>
          <CardDescription>{providerLabel}: os segredos ficam criptografados e não são exibidos após salvar.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-border p-3">
            <p className="text-muted-foreground">Credencial principal</p>
            <p className="font-medium text-foreground">{hasApiKeyStored ? 'Configurada' : 'Não configurada'}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-muted-foreground">Webhook Secret</p>
            <p className="font-medium text-foreground">{hasWebhookSecretStored ? 'Configurado' : 'Não configurado'}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-muted-foreground">Chave privada</p>
            <p className="font-medium text-foreground">{isDocuSign ? (privateKeyConfigured ? 'Configurada' : 'Não configurada') : 'Não obrigatória'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Credenciais {providerLabel}</CardTitle>
          <CardDescription>{providerDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="integration-key">Credencial principal {isDocuSign ? '(Integration Key / Client ID)' : ''}</Label>
              <Input id="integration-key" value={integrationKey} onChange={(e) => setIntegrationKey(e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-server">Auth Server</Label>
              <Input id="auth-server" value={authServer} onChange={(e) => setAuthServer(e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-id">Account ID</Label>
              <Input id="account-id" value={accountId} onChange={(e) => setAccountId(e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-id">User ID</Label>
              <Input id="user-id" value={userId} onChange={(e) => setUserId(e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="base-url">Base URL (REST API)</Label>
              <Input id="base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} maxLength={255} />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="webhook-secret">Webhook Secret (opcional)</Label>
              <Input id="webhook-secret" type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} maxLength={500} />
              <p className="text-xs text-muted-foreground">Deixe vazio para manter o valor já salvo.</p>
            </div>
            {isDocuSign && (
              <div className="space-y-1.5">
                <Label htmlFor="private-key">RSA Private Key (PEM)</Label>
                <Textarea
                  id="private-key"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  rows={8}
                  maxLength={12000}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----"
                />
                <p className="text-xs text-muted-foreground">Obrigatória no primeiro setup do DocuSign. Depois pode deixar vazio para manter.</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Habilitar {providerLabel}</p>
                <p className="text-xs text-muted-foreground">Permite envio de assinatura por este provider.</p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Definir como padrão</p>
                <p className="text-xs text-muted-foreground">Torna {providerLabel} o default do tenant.</p>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
          </div>

          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-medium text-foreground">Webhook callback</p>
            <p className="text-xs text-muted-foreground break-all mt-1">{callbackUrl}</p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !tenantId}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar configuração
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

