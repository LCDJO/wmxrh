import { useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security/use-permissions';
import { externalDataService, type CpfIntegrationConfig } from '@/domains/occupational-intelligence/external-data.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, IdCard, KeyRound, ExternalLink, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_CONFIG: CpfIntegrationConfig = {
  provider: 'serpro',
  is_active: false,
  has_consumer_key: false,
  has_consumer_secret: false,
  api_base_url: 'https://gateway.apiserpro.serpro.gov.br',
  endpoint_path_template: '/consulta-cpf-df-trial/v1/cpf/{cpf}',
  docs_url: 'https://apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cpf/',
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
  const tenantId = currentTenant?.id ?? null;
  const isAdmin = isTenantAdmin || hasRole('owner', 'admin');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<CpfIntegrationConfig>(DEFAULT_CONFIG);
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_CONFIG.api_base_url);
  const [endpointPathTemplate, setEndpointPathTemplate] = useState(DEFAULT_CONFIG.endpoint_path_template);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!tenantId || !isAdmin) return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await externalDataService.getCpfConfig(tenantId);
        setConfig(data);
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
  }, [tenantId, isAdmin]);

  async function handleSave() {
    if (!tenantId) return;
    setSaving(true);
    try {
      const data = await externalDataService.saveCpfConfig({
        tenantId,
        consumerKey: consumerKey || undefined,
        consumerSecret: consumerSecret || undefined,
        apiBaseUrl,
        endpointPathTemplate,
        isActive,
      });

      setConfig(data);
      setApiBaseUrl(data.api_base_url);
      setEndpointPathTemplate(data.endpoint_path_template);
      setIsActive(data.is_active);
      setConsumerKey('');
      setConsumerSecret('');
      toast.success('Integração de CPF salva com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar integração de CPF.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (permissionsLoading || loading) {
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
        <Badge variant={config.is_active ? 'default' : 'secondary'}>
          {config.is_active ? 'Ativa' : 'Inativa'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado da integração</CardTitle>
          <CardDescription>Os segredos não são reexibidos após o salvamento.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Consumer Key</p>
            <p className="mt-1 font-medium text-foreground">{config.has_consumer_key ? 'Configurada' : 'Não configurada'}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Consumer Secret</p>
            <p className="mt-1 font-medium text-foreground">{config.has_consumer_secret ? 'Configurado' : 'Não configurado'}</p>
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
            Credenciais SERPRO
          </CardTitle>
          <CardDescription>Informe as credenciais do contrato e, se necessário, ajuste o endpoint contratado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Ativar consulta automática</p>
              <p className="text-xs text-muted-foreground">Quando ativa, a admissão tenta preencher nome e data de nascimento ao informar o CPF.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !tenantId}>
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
                Acesse a área do cliente do SERPRO, contrate a API Consulta CPF e localize as credenciais do contrato.
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">2. Credenciais</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Copie a <strong>Consumer Key</strong> e a <strong>Consumer Secret</strong> exibidas na área do cliente.
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">3. Homologação</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O endpoint padrão desta tela usa o ambiente de demonstração/homologação. Se seu contrato for produtivo, ajuste o endpoint conforme a referência da API contratada.
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">4. Token de acesso</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O sistema gera automaticamente o token OAuth no backend usando as credenciais configuradas, sem expor as chaves no navegador.
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
                <a href={config.docs_url} target="_blank" rel="noreferrer">
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
