import { useEffect, useMemo, useRef, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security/use-permissions';
import {
  esocialSettingsService,
  type ESocialCertificateSummary,
  type ESocialEnvironment,
  type ESocialRecentLog,
  type ESocialSendMode,
  type ESocialValidationFlags,
} from '@/domains/esocial-engine/esocial-settings.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileKey2,
  KeyRound,
  Loader2,
  RefreshCw,
  Send,
  Server,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

const MASKED_SECRET_VALUE = '••••••••••••••••';
const ESOCIAL_DOCS_URL = 'https://www.gov.br/esocial/pt-br/documentacao-tecnica';
const DEFAULT_VALIDATION_FLAGS: ESocialValidationFlags = {
  validate_cpf: true,
  validate_cnpj: true,
  apply_rules: true,
  block_on_error: true,
};

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

function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export default function ESocialSettings() {
  const { currentTenant } = useTenant();
  const { hasRole, isTenantAdmin, loading: permissionsLoading } = usePermissions();
  const tenantId = currentTenant?.id ?? null;
  const isAdmin = isTenantAdmin || hasRole('owner', 'admin');
  const certificateInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingMeta, setRefreshingMeta] = useState(false);

  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyJustSaved, setApiKeyJustSaved] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [environment, setEnvironment] = useState<ESocialEnvironment>('sandbox');
  const [employerCnpj, setEmployerCnpj] = useState('');
  const [employerName, setEmployerName] = useState('');
  const [cnae, setCnae] = useState('');
  const [taxClassification, setTaxClassification] = useState('');
  const [sendMode, setSendMode] = useState<ESocialSendMode>('manual');
  const [retryLimit, setRetryLimit] = useState('5');
  const [validationFlags, setValidationFlags] = useState<ESocialValidationFlags>(DEFAULT_VALIDATION_FLAGS);

  const [certificate, setCertificate] = useState<ESocialCertificateSummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<ESocialRecentLog[]>([]);
  const [selectedCertificateName, setSelectedCertificateName] = useState('');

  const certificateStatus = useMemo(() => {
    if (!certificate) {
      return {
        label: 'Sem certificado',
        variant: 'secondary' as const,
      };
    }

    const expiresAt = new Date(certificate.expires_at);
    const timeDiff = expiresAt.getTime() - Date.now();
    const daysToExpire = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysToExpire <= 30) {
      return {
        label: 'Expirando em breve',
        variant: 'destructive' as const,
      };
    }

    return {
      label: certificate.is_active ? 'Ativo' : 'Inativo',
      variant: certificate.is_active ? 'default' as const : 'secondary' as const,
    };
  }, [certificate]);

  useEffect(() => {
    if (!tenantId || !isAdmin) return;

    const load = async () => {
      setLoading(true);
      try {
        const [settings, certificateSummary, logs] = await Promise.all([
          esocialSettingsService.getSettings(tenantId),
          esocialSettingsService.getCertificateSummary(tenantId),
          esocialSettingsService.getRecentLogs(tenantId),
        ]);

        setHasSavedKey(settings.has_api_key);
        setIsActive(settings.is_active);
        setEnvironment(settings.environment);
        setEmployerCnpj(formatCnpj(settings.employer_cnpj));
        setEmployerName(settings.employer_name);
        setCnae(settings.cnae);
        setTaxClassification(settings.tax_classification);
        setSendMode(settings.send_mode);
        setRetryLimit(String(settings.retry_limit));
        setValidationFlags(settings.validation_flags);
        setCertificate(certificateSummary);
        setRecentLogs(logs);
        setApiKey('');
        setShowApiKey(false);
        setApiKeyJustSaved(false);
        setSelectedCertificateName('');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao carregar parâmetros do eSocial.';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [tenantId, isAdmin]);

  async function refreshMetadata() {
    if (!tenantId) return;

    setRefreshingMeta(true);
    try {
      const [certificateSummary, logs] = await Promise.all([
        esocialSettingsService.getCertificateSummary(tenantId),
        esocialSettingsService.getRecentLogs(tenantId),
      ]);
      setCertificate(certificateSummary);
      setRecentLogs(logs);
      toast.success('Status e logs atualizados.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar informações do eSocial.';
      toast.error(message);
    } finally {
      setRefreshingMeta(false);
    }
  }

  async function handleSave() {
    if (!tenantId) return;

    const normalizedCnpj = employerCnpj.replace(/\D/g, '');
    const normalizedCnae = cnae.replace(/\D/g, '');
    const retryValue = Number.parseInt(retryLimit, 10);

    if (normalizedCnpj && normalizedCnpj.length !== 14) {
      toast.error('Informe um CNPJ válido com 14 dígitos.');
      return;
    }

    if (!employerName.trim()) {
      toast.error('Informe a razão social do empregador.');
      return;
    }

    if (Number.isNaN(retryValue) || retryValue < 1 || retryValue > 10) {
      toast.error('O limite de tentativas deve ficar entre 1 e 10.');
      return;
    }

    const hasNewApiKey = apiKey.trim().length > 0;
    setSaving(true);

    try {
      const data = await esocialSettingsService.saveSettings({
        tenantId,
        apiKey: apiKey || undefined,
        isActive,
        environment,
        employerCnpj: normalizedCnpj,
        employerName,
        cnae: normalizedCnae,
        taxClassification,
        sendMode,
        retryLimit: retryValue,
        validationFlags,
      });

      setHasSavedKey(data.has_api_key);
      setEnvironment(data.environment);
      setEmployerCnpj(formatCnpj(data.employer_cnpj));
      setEmployerName(data.employer_name);
      setCnae(data.cnae);
      setTaxClassification(data.tax_classification);
      setSendMode(data.send_mode);
      setRetryLimit(String(data.retry_limit));
      setValidationFlags(data.validation_flags);
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

  function handleCertificatePick(file: File | null) {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isAllowedExtension = lowerName.endsWith('.pfx') || lowerName.endsWith('.p12');
    if (!isAllowedExtension) {
      toast.error('Selecione um arquivo .pfx ou .p12.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('O certificado deve ter no máximo 10MB.');
      return;
    }

    setSelectedCertificateName(file.name);
    toast.success('Arquivo selecionado para a próxima etapa de upload seguro.');
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
            Configure ambiente, empregador, validações, envio e acompanhe o status operacional por tenant.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Configuração por empresa</Badge>
          <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Ativa' : 'Inativa'}</Badge>
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshMetadata()} disabled={refreshingMeta}>
            {refreshingMeta ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar status
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visão geral</CardTitle>
          <CardDescription>Resumo rápido do tenant eSocial para diagnóstico e conferência visual.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Chave</p>
            <p className="mt-1 font-medium text-foreground">{hasSavedKey ? 'Configurada' : 'Pendente'}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Ambiente</p>
            <p className="mt-1 font-medium text-foreground">{environment === 'production' ? 'Produção' : 'Sandbox'}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Modo de envio</p>
            <p className="mt-1 font-medium text-foreground">{sendMode === 'auto' ? 'Automático' : 'Manual'}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Certificado</p>
            <p className="mt-1 font-medium text-foreground">{certificate ? certificateStatus.label : 'Não cadastrado'}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Logs recentes</p>
            <p className="mt-1 font-medium text-foreground">{recentLogs.length} registro(s)</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                Ambiente e autenticação
              </CardTitle>
              <CardDescription>Controle o ambiente operacional e a chave do integrador eSocial.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="environment">Ambiente</Label>
                  <Select value={environment} onValueChange={(value) => setEnvironment(value as ESocialEnvironment)}>
                    <SelectTrigger id="environment">
                      <SelectValue placeholder="Selecione o ambiente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox / Produção Restrita</SelectItem>
                      <SelectItem value="production">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Integração ativa</p>
                    <p className="text-xs text-muted-foreground">Habilita esta parametrização para as rotinas do eSocial.</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="esocial-api-key">Chave da integração</Label>
                  {showMaskedSavedApiKey ? <Badge variant="outline">Chave salva</Badge> : null}
                </div>
                <div className="relative">
                  <Input
                    id="esocial-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={hasSavedKey ? '••••••••••••••••' : 'Cole aqui a chave fornecida pelo integrador eSocial'}
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
                      : 'Deixe em branco para manter o valor atual quando existir. O valor não é reexibido após o salvamento.'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Empregador
              </CardTitle>
              <CardDescription>Dados básicos da empresa para composição dos eventos e validações iniciais.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="employer-cnpj">CNPJ do empregador</Label>
                <Input
                  id="employer-cnpj"
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  value={employerCnpj}
                  onChange={(e) => setEmployerCnpj(formatCnpj(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tax-classification">Classificação tributária</Label>
                <Input
                  id="tax-classification"
                  placeholder="Ex.: Lucro Presumido"
                  value={taxClassification}
                  onChange={(e) => setTaxClassification(e.target.value.slice(0, 80))}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="employer-name">Razão social</Label>
                <Input
                  id="employer-name"
                  placeholder="Informe a razão social do empregador"
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value.slice(0, 160))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cnae">CNAE principal</Label>
                <Input
                  id="cnae"
                  inputMode="numeric"
                  placeholder="Somente números"
                  value={cnae}
                  onChange={(e) => setCnae(e.target.value.replace(/\D/g, '').slice(0, 7))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Envio e resiliência
              </CardTitle>
              <CardDescription>Defina o modo de processamento e o limite de tentativas para eventos com falha.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="send-mode">Modo de envio</Label>
                <Select value={sendMode} onValueChange={(value) => setSendMode(value as ESocialSendMode)}>
                  <SelectTrigger id="send-mode">
                    <SelectValue placeholder="Selecione o modo de envio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="auto">Automático</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="retry-limit">Limite de tentativas</Label>
                <Input
                  id="retry-limit"
                  type="number"
                  min={1}
                  max={10}
                  value={retryLimit}
                  onChange={(e) => setRetryLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Use entre 1 e 10 tentativas para controlar o retry automático.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Validações pré-envio
              </CardTitle>
              <CardDescription>Ative verificações automáticas antes de liberar eventos para transmissão.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Validar CPF</p>
                  <p className="text-xs text-muted-foreground">Conferência cadastral antes do envio.</p>
                </div>
                <Switch checked={validationFlags.validate_cpf} onCheckedChange={(checked) => setValidationFlags((prev) => ({ ...prev, validate_cpf: checked }))} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Validar CNPJ</p>
                  <p className="text-xs text-muted-foreground">Confirma o empregador configurado para o tenant.</p>
                </div>
                <Switch checked={validationFlags.validate_cnpj} onCheckedChange={(checked) => setValidationFlags((prev) => ({ ...prev, validate_cnpj: checked }))} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Aplicar regras trabalhistas</p>
                  <p className="text-xs text-muted-foreground">Executa o motor de regras antes do despacho.</p>
                </div>
                <Switch checked={validationFlags.apply_rules} onCheckedChange={(checked) => setValidationFlags((prev) => ({ ...prev, apply_rules: checked }))} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Bloquear envio com erro</p>
                  <p className="text-xs text-muted-foreground">Impede transmissão quando alguma validação falha.</p>
                </div>
                <Switch checked={validationFlags.block_on_error} onCheckedChange={(checked) => setValidationFlags((prev) => ({ ...prev, block_on_error: checked }))} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileKey2 className="h-4 w-4" />
                Certificado digital
              </CardTitle>
              <CardDescription>Status atual do certificado do tenant e preparação do arquivo .pfx/.p12.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={certificateStatus.variant}>{certificateStatus.label}</Badge>
                {certificate ? <Badge variant="outline">Expira em {formatDate(certificate.expires_at)}</Badge> : null}
              </div>

              <div className="rounded-md border border-dashed border-border p-4">
                <input
                  ref={certificateInputRef}
                  type="file"
                  accept=".pfx,.p12"
                  className="hidden"
                  onChange={(event) => handleCertificatePick(event.target.files?.[0] ?? null)}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Selecionar certificado</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      A tela já aceita seleção visual do arquivo; a persistência criptografada do certificado/senha entra na próxima etapa do backend seguro.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => certificateInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Escolher .pfx / .p12
                  </Button>
                </div>
                {selectedCertificateName ? (
                  <p className="mt-3 text-xs text-muted-foreground">Arquivo selecionado: <span className="font-medium text-foreground">{selectedCertificateName}</span></p>
                ) : null}
              </div>

              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">Certificado salvo no backend</p>
                <p className="mt-1 text-xs text-muted-foreground break-all">
                  {certificate?.certificate_path ?? 'Nenhum certificado cadastrado ainda.'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Última atualização: {certificate ? formatDate(certificate.updated_at) : '—'}</p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => toast.info('O teste real de conexão com certificado será ligado na próxima fase do backend eSocial.')}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Testar conexão
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logs recentes</CardTitle>
              <CardDescription>Últimas movimentações registradas para eventos eSocial deste tenant.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentLogs.length > 0 ? recentLogs.map((log) => (
                <div key={log.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{log.action}</p>
                    <span className="text-[11px] text-muted-foreground">{formatDate(log.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{log.description || 'Sem descrição adicional.'}</p>
                </div>
              )) : (
                <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
                  Nenhum log encontrado para este tenant.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Como obter a chave</CardTitle>
              <CardDescription>Guia rápido para localizar a credencial correta antes de preencher esta tela.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground">1. Defina seu provedor</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Confirme com seu integrador, middleware ou parceiro homologado do eSocial qual plataforma emite a chave de acesso.
                  </p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground">2. Acesse o painel</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Entre no portal administrativo do serviço contratado e localize a área de API, credenciais ou integrações.
                  </p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground">3. Gere ou copie a chave</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Gere uma nova chave servidor a servidor ou copie a credencial já vinculada ao ambiente da sua empresa.
                  </p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground">4. Salve e valide</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cole a chave nesta página e mantenha a integração ativa apenas após validar o credenciamento e o certificado.
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
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button asChild variant="outline">
                    <a href={ESOCIAL_DOCS_URL} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir documentação do eSocial
                    </a>
                  </Button>
                  <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                    <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                    Upload seguro do certificado será conectado na próxima fase backend.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !tenantId}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          Salvar parâmetros
        </Button>
      </div>
    </div>
  );
}
