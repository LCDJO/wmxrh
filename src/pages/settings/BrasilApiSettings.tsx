import { useEffect, useRef, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security/use-permissions';
import {
  brasilapiSettingsService,
  type BrasilApiSettingsConfig,
} from '@/domains/integrations/brasilapi-settings.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';

const MASKED = '••••••••••••••••';

function AccessDenied() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Acesso restrito
        </CardTitle>
        <CardDescription>
          Apenas administradores podem parametrizar a integração BrasilAPI.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function BrasilApiSettings() {
  const { currentTenant } = useTenant();
  const { isTenantAdmin, loading: permLoading } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('https://brasilapi.com.br/api');
  const [enableCnpj, setEnableCnpj] = useState(true);
  const [enableCep, setEnableCep] = useState(true);
  const [enableCnae, setEnableCnae] = useState(true);
  const [cacheTtl, setCacheTtl] = useState(24);

  const loadedRef = useRef(false);

  useEffect(() => {
    const tenantId = currentTenant?.id;
    if (!tenantId || permLoading || loadedRef.current) return;

    loadedRef.current = true;
    setLoading(true);

    brasilapiSettingsService.getSettings(tenantId).then((s) => {
      setIsActive(s.is_active);
      setHasApiKey(s.has_api_key);
      setApiBaseUrl(s.api_base_url);
      setEnableCnpj(s.enable_cnpj);
      setEnableCep(s.enable_cep);
      setEnableCnae(s.enable_cnae);
      setCacheTtl(s.cache_ttl_hours);
    }).catch((e) => {
      toast.error(e.message || 'Falha ao carregar configurações.');
    }).finally(() => setLoading(false));
  }, [currentTenant?.id, permLoading]);

  if (permLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isTenantAdmin) return <AccessDenied />;

  const tenantId = currentTenant!.id;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await brasilapiSettingsService.saveSettings({
        tenantId,
        apiKey: apiKey || undefined,
        isActive,
        apiBaseUrl,
        enableCnpj,
        enableCep,
        enableCnae,
        cacheTtlHours: cacheTtl,
      });
      setHasApiKey(result.has_api_key);
      setApiKey('');
      toast.success('Configurações da BrasilAPI salvas com sucesso.');
    } catch (e: any) {
      toast.error(e.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const result = await brasilapiSettingsService.testConnection(tenantId);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (e: any) {
      toast.error(e.message || 'Falha ao testar.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            BrasilAPI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Validação de CNPJ, CEP, CNAE e dados públicos brasileiros.
          </p>
        </div>
        <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
          {isActive ? 'Ativa' : 'Desativada'}
        </Badge>
      </div>

      {/* ── Ativação ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Ativação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Integração ativa</Label>
              <p className="text-xs text-muted-foreground">
                Ative para habilitar consultas via BrasilAPI neste tenant.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      {/* ── Credenciais ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Credenciais
          </CardTitle>
          <CardDescription>
            A BrasilAPI possui endpoints públicos (sem chave), mas alguns serviços podem exigir autenticação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key" className="text-sm">API Key (opcional)</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                placeholder={hasApiKey ? MASKED : 'Cole sua API Key aqui...'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {hasApiKey && !apiKey && (
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Chave salva
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-url" className="text-sm">URL Base</Label>
            <Input
              id="base-url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://brasilapi.com.br/api"
            />
            <p className="text-xs text-muted-foreground">
              Padrão: https://brasilapi.com.br/api — altere apenas se usar um proxy próprio.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Módulos habilitados ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Serviços habilitados
          </CardTitle>
          <CardDescription>
            Escolha quais APIs da BrasilAPI estarão disponíveis para este tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">CNPJ</Label>
              <p className="text-xs text-muted-foreground">Consulta de dados cadastrais de empresas.</p>
            </div>
            <Switch checked={enableCnpj} onCheckedChange={setEnableCnpj} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">CEP</Label>
              <p className="text-xs text-muted-foreground">Consulta de endereço por código postal.</p>
            </div>
            <Switch checked={enableCep} onCheckedChange={setEnableCep} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">CNAE</Label>
              <p className="text-xs text-muted-foreground">Catálogo de classificação de atividades econômicas.</p>
            </div>
            <Switch checked={enableCnae} onCheckedChange={setEnableCnae} />
          </div>
        </CardContent>
      </Card>

      {/* ── Cache ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            Cache
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="cache-ttl" className="text-sm">TTL do cache (horas)</Label>
            <Input
              id="cache-ttl"
              type="number"
              min={1}
              max={168}
              value={cacheTtl}
              onChange={(e) => setCacheTtl(Number(e.target.value) || 24)}
              className="max-w-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              Tempo que os resultados ficam em cache antes de nova consulta (1–168h).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Guia ── */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Guia de Configuração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">1</span>
            <div>
              <p className="font-medium text-foreground">Verifique o plano</p>
              <p className="mt-0.5">Certifique-se de que o módulo BrasilAPI está liberado no plano do seu tenant.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">2</span>
            <div>
              <p className="font-medium text-foreground">Endpoints públicos</p>
              <p className="mt-0.5">A BrasilAPI é gratuita para a maioria dos endpoints (CNPJ, CEP, CNAE). Nenhuma chave é necessária para uso básico.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">3</span>
            <div>
              <p className="font-medium text-foreground">API Key (opcional)</p>
              <p className="mt-0.5">Se você usar um proxy com autenticação ou serviços premium, insira a chave acima.</p>
            </div>
          </div>
          <Separator />
          <a
            href="https://brasilapi.com.br/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm font-medium"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Documentação oficial da BrasilAPI
          </a>
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing || !isActive} className="gap-2">
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
          Testar conexão
        </Button>
      </div>
    </div>
  );
}
