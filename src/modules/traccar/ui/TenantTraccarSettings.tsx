/**
 * TenantTraccarSettings — Tenant-level Traccar integration page
 * 
 * Redesigned with grouped cards and refined visual hierarchy.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  MapPin, Loader2, RefreshCw, Satellite, Shield, Activity,
  CheckCircle2, WifiOff, ArrowDownToLine, Settings, Save, Eye, EyeOff, Bell, Key,
  Server, Link, Timer, Zap,
} from 'lucide-react';
import TraccarEventsTab from './TraccarEventsTab';
import TraccarNotificationsTab from './TraccarNotificationsTab';
import TenantHealthTab from './TenantHealthTab';
import FleetPoliciesSummary from './FleetPoliciesSummary';

interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string;
  positionId: number;
  category: string | null;
  disabled: boolean;
}

interface TraccarServerInfo {
  version: string;
  registration: boolean;
  [key: string]: unknown;
}

interface TraccarConfig {
  api_url: string;
  api_token: string;
  webhook_secret: string;
  protocol: string;
  sync_interval_min: number;
  auto_sync: boolean;
  is_active: boolean;
  google_maps_api_key: string;
}

const DEFAULT_CONFIG: TraccarConfig = {
  api_url: '',
  api_token: '',
  webhook_secret: '',
  protocol: 'osmand',
  sync_interval_min: 5,
  auto_sync: true,
  is_active: true,
  google_maps_api_key: '',
};

const PROTOCOLS = [
  { value: 'osmand', label: 'OsmAnd' },
  { value: 'gps103', label: 'GPS103' },
  { value: 'tk103', label: 'TK103' },
  { value: 'gl200', label: 'GL200' },
  { value: 'gt06', label: 'GT06' },
  { value: 'h02', label: 'H02' },
  { value: 'teltonika', label: 'Teltonika' },
  { value: 'meitrack', label: 'Meitrack' },
  { value: 'suntech', label: 'Suntech' },
  { value: 'api', label: 'API REST' },
];

export default function TenantTraccarSettings() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [serverInfo, setServerInfo] = useState<TraccarServerInfo | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [config, setConfig] = useState<TraccarConfig>({ ...DEFAULT_CONFIG });
  const [savedConfig, setSavedConfig] = useState<TraccarConfig>({ ...DEFAULT_CONFIG });
  const [showToken, setShowToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showGoogleMapsKey, setShowGoogleMapsKey] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [webhookSecretInput, setWebhookSecretInput] = useState('');
  const [googleMapsKeyInput, setGoogleMapsKeyInput] = useState('');

  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateConfig = (partial: Partial<TraccarConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  };

  // Load saved config
  const fetchConfig = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('tenant_integration_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('integration_key', 'traccar')
      .maybeSingle();
    if (data?.config && typeof data.config === 'object') {
      const val = data.config as Record<string, any>;
      const loaded: TraccarConfig = {
        api_url: val.api_url || '',
        api_token: val.api_token || '',
        webhook_secret: val.webhook_secret || '',
        protocol: val.protocol || 'osmand',
        sync_interval_min: val.sync_interval_min ?? 5,
        auto_sync: val.auto_sync !== false,
        is_active: val.is_active !== false,
        google_maps_api_key: val.google_maps_api_key || '',
      };
      setConfig({ ...loaded });
      setSavedConfig(loaded);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // Auto-test connection
  const autoTestConnection = useCallback(async () => {
    if (!savedConfig.api_url || !savedConfig.api_token || !tenantId) return;
    try {
      const { data, error } = await supabase.functions.invoke('traccar-proxy', {
        body: { action: 'test-connection', tenantId },
      });
      if (error) { setConnectionStatus('error'); return; }
      if (data?.success) {
        setConnectionStatus('connected');
        setServerInfo(data.data as TraccarServerInfo);
      } else {
        setConnectionStatus('error');
      }
    } catch {
      setConnectionStatus('error');
    }
  }, [savedConfig.api_url, savedConfig.api_token, tenantId]);

  useEffect(() => {
    autoTestConnection();
    const interval = setInterval(autoTestConnection, 60_000);
    return () => clearInterval(interval);
  }, [autoTestConnection]);

  // Auto-sync devices
  const syncDevices = useCallback(async () => {
    if (!tenantId || !savedConfig.api_url) return;
    setLoadingDevices(true);
    try {
      const { data: devData, error: devError } = await supabase.functions.invoke('traccar-proxy', {
        body: { action: 'devices', tenantId },
      });
      if (devError) throw devError;
      if (devData?.success && Array.isArray(devData.data)) {
        setDevices(devData.data);
        return devData.data.length;
      }
    } catch {
      // silent on auto-sync
    } finally {
      setLoadingDevices(false);
    }
    return 0;
  }, [tenantId, savedConfig.api_url]);

  const handleManualSync = async () => {
    const count = await syncDevices();
    if (count !== undefined) {
      toast.success(`${count} dispositivo(s) sincronizado(s)`);
    } else {
      toast.error('Falha ao sincronizar dispositivos');
    }
  };

  // Auto-sync timer management
  useEffect(() => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (savedConfig.auto_sync && savedConfig.is_active && savedConfig.api_url) {
      syncDevices();
      const ms = Math.max(savedConfig.sync_interval_min, 1) * 60_000;
      syncTimerRef.current = setInterval(syncDevices, ms);
    }
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [savedConfig.auto_sync, savedConfig.is_active, savedConfig.sync_interval_min, savedConfig.api_url, syncDevices]);

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('traccar-proxy', {
        body: { action: 'test-connection', tenantId },
      });
      if (error) throw error;
      if (data?.success) {
        setConnectionStatus('connected');
        setServerInfo(data.data as TraccarServerInfo);
        toast.success('Conexão com Traccar estabelecida!');
      } else {
        setConnectionStatus('error');
        toast.error(data?.error || 'Falha ao conectar');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      toast.error(`Erro: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config.api_url) { toast.error('URL do servidor é obrigatória.'); return; }
    if (!tenantId) { toast.error('Tenant não identificado.'); return; }
    setSavingConfig(true);
    try {
      const configToSave: TraccarConfig = {
        ...config,
        api_token: tokenInput || savedConfig.api_token,
        webhook_secret: webhookSecretInput || savedConfig.webhook_secret,
        google_maps_api_key: googleMapsKeyInput || savedConfig.google_maps_api_key,
      };

      const { data: existing } = await supabase
        .from('tenant_integration_configs')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('integration_key', 'traccar')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('tenant_integration_configs')
          .update({ config: configToSave as any, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integration_configs')
          .insert({ tenant_id: tenantId, integration_key: 'traccar', config: configToSave as any });
        if (error) throw error;
      }

      setSavedConfig(configToSave);
      setConfig(prev => ({ ...prev, api_token: configToSave.api_token, webhook_secret: configToSave.webhook_secret, google_maps_api_key: configToSave.google_maps_api_key }));
      setTokenInput('');
      setWebhookSecretInput('');
      setGoogleMapsKeyInput('');
      setConnectionStatus('unknown');
      toast.success('Configuração salva com sucesso!');
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const maskSecret = (s: string) => {
    if (!s) return '';
    if (s.length <= 6) return '••••••';
    return `${s.slice(0, 2)}${'•'.repeat(Math.min(s.length - 4, 20))}${s.slice(-2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const SecretField = ({ label, value, onChange, placeholder, show, onToggleShow, savedValue, hint }: {
    label: string; value: string; onChange: (v: string) => void; placeholder: string;
    show: boolean; onToggleShow: () => void; savedValue: string; hint?: React.ReactNode;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <Button
          type="button" variant="ghost" size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={onToggleShow}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {savedValue && !value && (
        <p className="text-xs text-muted-foreground">
          Valor salvo: <span className="font-mono">{maskSecret(savedValue)}</span>
        </p>
      )}
      {hint}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Traccar GPS</h1>
            <p className="text-sm text-muted-foreground">Rastreamento GPS e compliance de frota</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`text-xs px-3 py-1 ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                : connectionStatus === 'error'
                ? 'bg-destructive/10 text-destructive border-destructive/30'
                : 'text-muted-foreground'
            }`}
          >
            <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${
              connectionStatus === 'connected' ? 'bg-emerald-500'
              : connectionStatus === 'error' ? 'bg-destructive'
              : 'bg-muted-foreground'
            }`} />
            {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
          </Badge>
          {connectionStatus === 'connected' && serverInfo && (
            <Badge variant="outline" className="text-xs">v{serverInfo.version}</Badge>
          )}
        </div>
      </div>

      {/* ── Configuration Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Card 1: Conexão */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              Conexão com Servidor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">URL do Servidor</Label>
              <Input
                value={config.api_url}
                onChange={e => updateConfig({ api_url: e.target.value })}
                placeholder="https://traccar.suaempresa.com"
              />
            </div>

            <SecretField
              label="API Token"
              value={tokenInput}
              onChange={setTokenInput}
              placeholder="Token de acesso à API"
              show={showToken}
              onToggleShow={() => setShowToken(!showToken)}
              savedValue={savedConfig.api_token}
            />

            <SecretField
              label="Webhook Secret"
              value={webhookSecretInput}
              onChange={setWebhookSecretInput}
              placeholder="Secret para webhooks (opcional)"
              show={showWebhookSecret}
              onToggleShow={() => setShowWebhookSecret(!showWebhookSecret)}
              savedValue={savedConfig.webhook_secret}
            />

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={testConnection} disabled={testingConnection || !config.api_url} className="gap-1.5">
                {testingConnection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                Testar Conexão
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Sincronização */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              Sincronização & Protocolo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Protocolo</Label>
              <Select value={config.protocol} onValueChange={v => updateConfig({ protocol: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROTOCOLS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Intervalo de Sync (minutos)</Label>
              <Input
                type="number" min={1} max={1440}
                value={config.sync_interval_min}
                onChange={e => updateConfig({ sync_interval_min: Math.max(1, parseInt(e.target.value) || 5) })}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Auto-sync dispositivos</p>
                <p className="text-xs text-muted-foreground">Sincronização automática periódica</p>
              </div>
              <Switch checked={config.auto_sync} onCheckedChange={v => updateConfig({ auto_sync: v })} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Integração Ativa</p>
                <p className="text-xs text-muted-foreground">Receber eventos GPS do Traccar</p>
              </div>
              <Switch checked={config.is_active} onCheckedChange={v => updateConfig({ is_active: v })} />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Chaves de API */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              Chaves de API Externas
            </CardTitle>
            <CardDescription>Serviços externos para mapas e geolocalização</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-lg">
              <SecretField
                label="Google Maps API Key"
                value={googleMapsKeyInput}
                onChange={setGoogleMapsKeyInput}
                placeholder="AIzaSy..."
                show={showGoogleMapsKey}
                onToggleShow={() => setShowGoogleMapsKey(!showGoogleMapsKey)}
                savedValue={savedConfig.google_maps_api_key}
                hint={
                  <p className="text-xs text-muted-foreground">
                    Usada nos mapas de fiscalização.{' '}
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Obter chave →
                    </a>
                  </p>
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Save Button ── */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSaveConfig} disabled={savingConfig} className="gap-2">
          {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configuração
        </Button>
        {connectionStatus === 'error' && (
          <span className="text-sm text-destructive">Falha na conexão. Verifique as credenciais.</span>
        )}
      </div>

      <Separator />

      {/* ── Tabs ── */}
      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList className="inline-flex h-10 gap-1 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="devices" className="gap-1.5 text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
            <Satellite className="h-3.5 w-3.5" /> Dispositivos
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5 text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
            <Activity className="h-3.5 w-3.5" /> Eventos
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
            <Bell className="h-3.5 w-3.5" /> Notificações
          </TabsTrigger>
          <TabsTrigger value="policies" className="gap-1.5 text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
            <Shield className="h-3.5 w-3.5" /> Políticas
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5 text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
            <Activity className="h-3.5 w-3.5" /> Saúde
          </TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Satellite className="h-4 w-4 text-muted-foreground" /> Dispositivos do Traccar
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Dispositivos registrados no servidor
                    {savedConfig.auto_sync && savedConfig.is_active && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Sync a cada {savedConfig.sync_interval_min} min
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <Button onClick={handleManualSync} disabled={loadingDevices || !savedConfig.api_url} size="sm" variant="outline" className="gap-1.5">
                  {loadingDevices ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
                  Sincronizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Satellite className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {savedConfig.api_url
                      ? savedConfig.auto_sync
                        ? 'Aguardando auto-sincronização...'
                        : 'Clique em "Sincronizar" para buscar dispositivos.'
                      : 'Configure a URL e o token acima primeiro.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">ID Único</TableHead>
                        <TableHead className="text-xs">Categoria</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Última Atualização</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devices.map((device) => (
                        <TableRow key={device.id}>
                          <TableCell className="text-sm font-medium">{device.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{device.uniqueId}</TableCell>
                          <TableCell className="text-xs">{device.category || '—'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={device.status === 'online' ? 'default' : 'secondary'}
                              className={`text-xs ${device.status === 'online' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : ''}`}
                            >
                              {device.status === 'online' ? '● Online' : device.status === 'offline' ? '● Offline' : device.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {device.lastUpdate ? new Date(device.lastUpdate).toLocaleString('pt-BR') : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <TraccarEventsTab tenantId={tenantId} devices={devices} connectionStatus={connectionStatus} />
        </TabsContent>

        <TabsContent value="notifications">
          <TraccarNotificationsTab tenantId={tenantId} connectionStatus={connectionStatus} />
        </TabsContent>

        <TabsContent value="policies">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" /> Políticas de Compliance
                  </CardTitle>
                  <CardDescription className="mt-1">Clique em qualquer card abaixo para gerenciar diretamente</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <FleetPoliciesSummary tenantId={tenantId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <TenantHealthTab tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
