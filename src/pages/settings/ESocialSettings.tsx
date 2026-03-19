import { useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security/use-permissions';
import { esocialSettingsService } from '@/domains/esocial-engine/esocial-settings.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Send, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

const MASKED_SECRET_VALUE = '••••••••••••••••';
const ESOCIAL_DOCS_URL = 'https://www.gov.br/esocial/pt-br/documentacao-tecnica';

function AccessDenied() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Acesso restrito
        </CardTitle>
        <CardDescription>Apenas administradores do tenant podem parametrizar a integração do eSocial.</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function ESocialSettings() {
  const { currentTenant } = useTenant();
  const { hasRole, isTenantAdmin, loading: permissionsLoading } = usePermissions();
  const tenantId = currentTenant?.id ?? null;
  const isAdmin = isTenantAdmin || hasRole('owner', 'admin');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyJustSaved, setApiKeyJustSaved] = useState(false);

  useEffect(() => {
    if (!tenantId || !isAdmin) return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await esocialSettingsService.getSettings(tenantId);
        setHasSavedKey(data.has_api_key);
        setIsActive(data.is_active);
        setApiKey('');
        setShowApiKey(false);
        setApiKeyJustSaved(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao carregar parâmetros do eSocial.';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [tenantId, isAdmin]);

  async function handleSave() {
    if (!tenantId) return;

    const hasNewApiKey = apiKey.trim().length > 0;
    setSaving(true);

    try {
      const data = await esocialSettingsService.saveSettings({
        tenantId,
        apiKey: apiKey || undefined,
        isActive,
      });

      setHasSavedKey(data.has_api_key);
      setApiKey('');
      setShowApiKey(false);
      setApiKeyJustSaved(hasNewApiKey);
      toast.success('Parâmetros do eSocial salvos com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar parâmetros do eSocial.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando parâmetros do eSocial...
      </div>
    );
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  const showMaskedSavedApiKey = hasSavedKey && !apiKey;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Send className="h-6 w-6" />
            Parâmetros do eSocial
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Centralize a chave da integração do eSocial por tenant e controle a ativação do envio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Configuração por empresa</Badge>
          <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Ativa' : 'Inativa'}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado da configuração</CardTitle>
          <CardDescription>A chave fica mascarada após o salvamento para indicar persistência sem reexibir o valor.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Chave de integração</p>
            <p className="mt-1 font-medium text-foreground">{hasSavedKey ? 'Configurada' : 'Não configurada'}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="mt-1 font-medium text-foreground">{isActive ? 'Ativo para uso' : 'Desativado'}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Escopo</p>
            <p className="mt-1 font-medium text-foreground">Tenant atual</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Parametrização da chave
          </CardTitle>
          <CardDescription>Use este campo para cadastrar ou substituir a chave usada pela integração do eSocial.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="esocial-api-key">Chave da integração eSocial</Label>
              {showMaskedSavedApiKey ? <Badge variant="outline">Chave salva</Badge> : null}
            </div>
            <div className="relative">
              <Input
                id="esocial-api-key"
                type={showApiKey ? 'text' : 'password'}
                placeholder={hasSavedKey ? '••••••••••••••••' : 'Cole aqui a chave fornecida pelo seu integrador eSocial'}
                value={showMaskedSavedApiKey ? MASKED_SECRET_VALUE : apiKey}
                onFocus={() => {
                  if (showMaskedSavedApiKey) {
                    setApiKey('');
                    setApiKeyJustSaved(false);
                  }
                }}
                onChange={(e) => {
                  setApiKeyJustSaved(false);
                  setApiKey(e.target.value === MASKED_SECRET_VALUE ? '' : e.target.value);
                }}
                className="pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                onClick={() => setShowApiKey((prev) => !prev)}
                aria-label={showApiKey ? 'Ocultar chave' : 'Exibir chave'}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {apiKeyJustSaved
                ? 'Chave salva agora e mascarada para conferência visual; clique no campo para substituir por outra.'
                : hasSavedKey
                  ? 'A chave já está salva e aparece mascarada para indicar persistência; clique no campo para substituir.'
                  : 'Deixe em branco para manter o valor atual quando existir. A chave não é reexibida após o salvamento.'}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Ativar integração</p>
              <p className="text-xs text-muted-foreground">Habilita o uso desta parametrização nas rotinas do eSocial.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !tenantId}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar parâmetros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como obter a chave</CardTitle>
          <CardDescription>Guia rápido para localizar a credencial correta antes de preencher esta tela.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">1. Defina seu provedor</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirme com seu integrador, middleware ou parceiro homologado do eSocial qual plataforma emite a chave de acesso.
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">2. Acesse o painel do provedor</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Entre no portal administrativo do serviço contratado e localize a área de API, credenciais ou integrações.
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">3. Gere ou copie a chave</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Gere uma nova chave para uso servidor a servidor ou copie a credencial já vinculada ao ambiente da sua empresa.
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">4. Salve e valide</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cole a chave nesta página, salve os parâmetros e mantenha a integração ativa apenas após validar o credenciamento.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Referência oficial
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use a documentação oficial do eSocial como referência técnica e confirme com o seu provedor onde a chave é emitida no painel contratado.
            </p>
            <div className="mt-3">
              <Button asChild variant="outline">
                <a href={ESOCIAL_DOCS_URL} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir documentação do eSocial
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
