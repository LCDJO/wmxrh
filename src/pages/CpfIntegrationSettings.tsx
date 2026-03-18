import { useEffect, useMemo, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security/use-permissions';
import { usePXE } from '@/hooks/use-pxe';
import { externalDataService, type CpfIntegrationConfig, type CpfProvider } from '@/domains/occupational-intelligence/external-data.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, IdCard, KeyRound, ExternalLink, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const PROVIDER_DEFAULTS: Record<CpfProvider, CpfIntegrationConfig> = {
  serpro: {
    provider: 'serpro',
    is_active: false,
    has_consumer_key: false,
    has_consumer_secret: false,
    has_api_key: false,
    api_base_url: 'https://gateway.apiserpro.serpro.gov.br',
    endpoint_path_template: '/consulta-cpf-df-trial/v1/cpf/{cpf}',
    docs_url: 'https://apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cpf/',
  },
  cpfhub: {
    provider: 'cpfhub',
    is_active: false,
    has_consumer_key: false,
    has_consumer_secret: false,
    has_api_key: false,
    api_base_url: 'https://api.cpfhub.io',
    endpoint_path_template: '/cpf/{cpf}',
    docs_url: 'https://app.cpfhub.io/docs',
  },
};

const PROVIDER_LABELS: Record<CpfProvider, string> = {
  serpro: 'SERPRO',
  cpfhub: 'CPFHub',
};

const PROVIDER_DESCRIPTIONS: Record<CpfProvider, string> = {
  serpro: 'Indicado para operações maiores com credenciais contratuais do SERPRO.',
  cpfhub: 'Opção simplificada para pequenas empresas usando API Key do CPFHub.',
};

function AccessDenied() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Acesso restrito
        </CardTitle>
        <CardDescription>Apenas administradores do tenant podem configurar a consulta automática de CPF.</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function CpfIntegrationSettings() {
  const { currentTenant } = useTenant();
  const { hasRole, isTenantAdmin, loading: permissionsLoading } = usePermissions();
  const { ready: pxeReady, isModuleAccessible } = usePXE();
  const tenantId = currentTenant?.id ?? null;
  const isAdmin = isTenantAdmin || hasRole('owner', 'admin');

  const availableProviders = useMemo<CpfProvider[]>(() => {
    const providers: CpfProvider[] = [];
    if (isModuleAccessible('cpf_lookup_serpro')) providers.push('serpro');
    if (isModuleAccessible('cpf_lookup_cpfhub')) providers.push('cpfhub');
    return providers;
  }, [isModuleAccessible]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<CpfIntegrationConfig>(PROVIDER_DEFAULTS.serpro);
  const [provider, setProvider] = useState<CpfProvider>('serpro');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState(PROVIDER_DEFAULTS.serpro.api_base_url);
  const [endpointPathTemplate, setEndpointPathTemplate] = useState(PROVIDER_DEFAULTS.serpro.endpoint_path_template);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!tenantId || !isAdmin || !pxeReady) return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await externalDataService.getCpfConfig(tenantId);
        setConfig(data);
        setProvider(data.provider);
        setApiBaseUrl(data.api_base_url);
        setEndpointPathTemplate(data.endpoint_path_template);
        setIsActive(data.is_active);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao carregar integração de CPF.';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [tenantId, isAdmin, pxeReady]);

  function handleProviderChange(nextProvider: CpfProvider) {
    const defaults = PROVIDER_DEFAULTS[nextProvider];
    setProvider(nextProvider);
    setIsActive(false);
    setApiBaseUrl(defaults.api_base_url);
    setEndpointPathTemplate(defaults.endpoint_path_template);
    setConsumerKey('');
    setConsumerSecret('');
    setApiKey('');
  }

  async function handleSave() {
    if (!tenantId) return;
    setSaving(true);
    try {
      const data = await externalDataService.saveCpfConfig({
        tenantId,
        provider,
        consumerKey: consumerKey || undefined,
        consumerSecret: consumerSecret || undefined,
        apiKey: apiKey || undefined,
        apiBaseUrl,
        endpointPathTemplate,
        isActive,
      });

      setConfig(data);
      setProvider(data.provider);
      setApiBaseUrl(data.api_base_url);
      setEndpointPathTemplate(data.endpoint_path_template);
      setIsActive(data.is_active);
      setConsumerKey('');
      setConsumerSecret('');
      setApiKey('');
      toast.success('Integração de CPF salva com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar integração de CPF.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (permissionsLoading || !pxeReady || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando integração de CPF...
      </div>
    );
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  const selectedDefaults = PROVIDER_DEFAULTS[provider];
  const providerAvailable = availableProviders.includes(provider);
  const hasAnyProvider = availableProviders.length > 0;
  const usingSerpro = provider === 'serpro';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <IdCard className="h-6 w-6" />
            Consulta de CPF
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure a busca automática de nome e data de nascimento durante a admissão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Provider: {PROVIDER_LABELS[provider]}</Badge>
          <Badge variant={config.is_active ? 'default' : 'secondary'}>
            {config.is_active ? 'Ativa' : 'Inativa'}
          </Badge>
        </div>
      </div>

      {!hasAnyProvider ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum provider liberado no plano</CardTitle>
            <CardDescription>
              Libere os módulos <strong>Consulta CPF — SERPRO</strong> ou <strong>Consulta CPF — CPFHub</strong> na gestão SaaS para este tenant.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {hasAnyProvider && !providerAvailable ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Provider salvo não está liberado no plano atual
            </CardTitle>
            <CardDescription>
              Selecione um provider habilitado para este tenant antes de ativar novamente a consulta automática.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Estado da integração</CardTitle>
          <CardDescription>Os segredos não são reexibidos após o salvamento.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Provider atual</p>
            <p className="mt-1 font-medium text-foreground">{PROVIDER_LABELS[config.provider]}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Consumer Key</p>
            <p className="mt-1 font-medium text-foreground">{config.has_consumer_key ? 'Configurada' : 'Não configurada'}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Consumer Secret / API Key</p>
            <p className="mt-1 font-medium text-foreground">
              {usingSerpro
                ? (config.has_consumer_secret ? 'Configurado' : 'Não configurado')
                : (config.has_api_key ? 'Configurada' : 'Não configurada')}
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Endpoint atual</p>
            <p className="mt-1 break-all text-sm font-medium text-foreground">{config.endpoint_path_template}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Configuração do provider
          </CardTitle>
          <CardDescription>{PROVIDER_DESCRIPTIONS[provider]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={provider} onValueChange={(value) => handleProviderChange(value as CpfProvider)}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Selecione o provider" />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((item) => (
                    <SelectItem key={item} value={item}>{PROVIDER_LABELS[item]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {usingSerpro ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="consumer-key">Consumer Key</Label>
                  <Input
                    id="consumer-key"
                    type="password"
                    placeholder={config.has_consumer_key ? '••••••••••••••••' : 'Cole a Consumer Key'}
                    value={consumerKey}
                    onChange={(e) => setConsumerKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Deixe em branco para manter o valor já salvo.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="consumer-secret">Consumer Secret</Label>
                  <Input
                    id="consumer-secret"
                    type="password"
                    placeholder={config.has_consumer_secret ? '••••••••••••••••' : 'Cole a Consumer Secret'}
                    value={consumerSecret}
                    onChange={(e) => setConsumerSecret(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Deixe em branco para manter o valor já salvo.</p>
                </div>
              </>
            ) : (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder={config.has_api_key ? '••••••••••••••••' : 'Cole a API Key'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Deixe em branco para manter o valor já salvo.</p>
              </div>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="api-base-url">API Base URL</Label>
              <Input
                id="api-base-url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="endpoint-path-template">Endpoint da consulta</Label>
              <Input
                id="endpoint-path-template"
                value={endpointPathTemplate}
                onChange={(e) => setEndpointPathTemplate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use <span className="font-mono">{'{cpf}'}</span> no ponto em que o documento deve ser inserido.
              </p>
              <p className="text-xs text-muted-foreground">
                Padrão sugerido para {PROVIDER_LABELS[provider]}: {selectedDefaults.api_base_url}{selectedDefaults.endpoint_path_template}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Ativar consulta automática</p>
              <p className="text-xs text-muted-foreground">Quando ativa, a admissão tenta preencher nome e data de nascimento ao informar o CPF.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={!providerAvailable} />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !tenantId || !providerAvailable}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar configuração
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual: onde obter as chaves</CardTitle>
          <CardDescription>Passo a passo para contratar e configurar a API de consulta de CPF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">1. Contratação</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {usingSerpro
                  ? 'Acesse a área do cliente do SERPRO, contrate a API Consulta CPF e localize as credenciais do contrato.'
                  : 'Crie sua conta no CPFHub e gere a API Key do projeto para começar a consultar CPFs.'}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">2. Credenciais</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {usingSerpro
                  ? <>Copie a <strong>Consumer Key</strong> e a <strong>Consumer Secret</strong> exibidas na área do cliente.</>
                  : <>Copie a <strong>API Key</strong> exibida no painel do CPFHub.</>}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">3. Endpoint</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {usingSerpro
                  ? 'O endpoint padrão desta tela usa o ambiente de demonstração/homologação. Se seu contrato for produtivo, ajuste o endpoint conforme a referência da API contratada.'
                  : 'O endpoint padrão do CPFHub usa o formato /cpf/{cpf}. Ajuste somente se sua conta tiver uma rota diferente.'}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">4. Segurança</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O sistema consulta a API pelo backend, sem expor as credenciais no navegador.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              {config.is_active ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              Link oficial da documentação
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use a documentação oficial para confirmar o endpoint do seu contrato e validar a versão correta da API.
            </p>
            <div className="mt-3">
              <Button asChild variant="outline">
                <a href={PROVIDER_DEFAULTS[provider].docs_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir documentação
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}