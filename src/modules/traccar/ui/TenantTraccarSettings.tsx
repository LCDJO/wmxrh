/**
 * TenantTraccarSettings — Tenant-level Traccar integration page
 * 
 * Dashboard-style config matching the reference design:
 * URL, API Token, Webhook Secret, Protocol, Sync Interval, Auto-sync, Integration Active
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

  // Config state
  const [config, setConfig] = useState<TraccarConfig>({ ...DEFAULT_CONFIG });
  const [savedConfig, setSavedConfig] = useState<TraccarConfig>({ ...DEFAULT_CONFIG });
  const [showToken, setShowToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showGoogleMapsKey, setShowGoogleMapsKey] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [webhookSecretInput, setWebhookSecretInput] = useState('');
  const [googleMapsKeyInput, setGoogleMapsKeyInput] = useState('');

  // Auto-sync timer
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
      setConfig({ ...loaded, api_token: loaded.api_token, webhook_secret: loaded.webhook_secret });
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
      // Initial sync
      syncDevices();
      // Then periodic
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
    if (!config.api_url) {
      toast.error('URL do servidor é obrigatória.');
      return;
    }
    if (!tenantId) {
      toast.error('Tenant não identificado.');
      return;
    }
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
          .insert({
            tenant_id: tenantId,
            integration_key: 'traccar',
            config: configToSave as any,
          });
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

  return (
    <div className="space-y-6">
      {/* ── Header Card (matches reference) ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Traccar GPS Integration</CardTitle>
                <CardDescription>Integração com servidor Traccar para rastreamento GPS e compliance de frota</CardDescription>
              </div>
            </div>
            <Badge
              variant={connectionStatus === 'connected' ? 'default' : 'outline'}
              className={`text-xs ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                  : connectionStatus === 'error'
                  ? 'text-destructive border-destructive/30'
                  : 'text-muted-foreground'
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${
                connectionStatus === 'connected' ? 'bg-emerald-500'
                : connectionStatus === 'error' ? 'bg-destructive'
                : 'bg-muted-foreground'
              }`} />
              {connectionStatus === 'connected' ? 'Conectado' : connectionStatus === 'error' ? 'Desconectado' : 'Desconectado'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />

          {/* URL do Servidor */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-primary">URL do Servidor Traccar</Label>
            <Input
              value={config.api_url}
              onChange={e => updateConfig({ api_url: e.target.value })}
              placeholder="https://traccar.suaempresa.com"
            />
          </div>

          {/* API Token */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-primary">API Token</Label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder={savedConfig.api_token ? 'Token de acesso à API do Traccar' : 'Token de acesso à API do Traccar'}
                className="pr-10"
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
            {savedConfig.api_token && !tokenInput && (
              <p className="text-xs text-muted-foreground">
                Token salvo: <span className="font-mono">{maskSecret(savedConfig.api_token)}</span>
              </p>
            )}
          </div>

          {/* Webhook Secret */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-primary">
              Webhook Secret <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <div className="relative">
              <Input
                type={showWebhookSecret ? 'text' : 'password'}
                value={webhookSecretInput}
                onChange={e => setWebhookSecretInput(e.target.value)}
                placeholder="Secret para validação de webhooks"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              >
                {showWebhookSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {savedConfig.webhook_secret && !webhookSecretInput && (
              <p className="text-xs text-muted-foreground">
                Secret salvo: <span className="font-mono">{maskSecret(savedConfig.webhook_secret)}</span>
              </p>
            )}
          </div>

          <Separator />

          {/* ── Chaves de API Externas ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold text-foreground">Chaves de API Externas</Label>
            </div>
            <p className="text-xs text-muted-foreground">Configure chaves de serviços externos utilizados nas funcionalidades de mapa e geolocalização.</p>

            {/* Google Maps API Key */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-primary">Google Maps API Key</Label>
              <div className="relative">
                <Input
                  type={showGoogleMapsKey ? 'text' : 'password'}
                  value={googleMapsKeyInput}
                  onChange={e => setGoogleMapsKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowGoogleMapsKey(!showGoogleMapsKey)}
                >
                  {showGoogleMapsKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {savedConfig.google_maps_api_key && !googleMapsKeyInput && (
                <p className="text-xs text-muted-foreground">
                  Chave salva: <span className="font-mono">{maskSecret(savedConfig.google_maps_api_key)}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Utilizada para exibição de mapas nas zonas de fiscalização. Obtenha em{' '}
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Google Cloud Console
                </a>.
              </p>
            </div>
          </div>

          {/* Protocol / Sync Interval / Auto-sync row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-primary">Protocolo</Label>
              <Select value={config.protocol} onValueChange={v => updateConfig({ protocol: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROTOCOLS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-primary">Intervalo de Sync (min)</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={config.sync_interval_min}
                onChange={e => updateConfig({ sync_interval_min: Math.max(1, parseInt(e.target.value) || 5) })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-primary">Auto-sync dispositivos</Label>
              <div className="pt-1">
                <Switch
                  checked={config.auto_sync}
                  onCheckedChange={v => updateConfig({ auto_sync: v })}
                />
              </div>
            </div>
          </div>

          {/* Integration Active toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div>
              <p className="text-sm font-semibold text-foreground">Integração Ativa</p>
              <p className="text-xs text-muted-foreground">Habilita o recebimento de eventos GPS do Traccar</p>
            </div>
            <Switch
              checked={config.is_active}
              onCheckedChange={v => updateConfig({ is_active: v })}
            />
          </div>

          <Separator />

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveConfig} disabled={savingConfig} className="gap-2">
              {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configuração
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testingConnection || !config.api_url} className="gap-2">
              {testingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Testar Conexão
            </Button>
            {connectionStatus === 'connected' && serverInfo && (
              <span className="text-sm text-muted-foreground ml-auto">
                Servidor Traccar <Badge variant="outline" className="ml-1">v{serverInfo.version}</Badge>
              </span>
            )}
            {connectionStatus === 'error' && (
              <span className="text-sm text-destructive ml-auto">
                Falha na conexão. Verifique as credenciais.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs for remaining sections ── */}
      <Tabs defaultValue="devices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="devices" className="gap-1.5 text-xs"><Satellite className="h-3.5 w-3.5" /> Dispositivos</TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Eventos</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs"><Bell className="h-3.5 w-3.5" /> Notificações</TabsTrigger>
          <TabsTrigger value="policies" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" /> Políticas</TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Saúde</TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Satellite className="h-5 w-5" /> Dispositivos do Traccar
                  </CardTitle>
                  <CardDescription>
                    Dispositivos registrados no servidor Traccar
                    {savedConfig.auto_sync && savedConfig.is_active && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Auto-sync a cada {savedConfig.sync_interval_min} min
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <Button onClick={handleManualSync} disabled={loadingDevices || !savedConfig.api_url} size="sm" className="gap-1.5">
                  {loadingDevices ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
                  Sincronizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {savedConfig.api_url
                    ? savedConfig.auto_sync
                      ? 'Aguardando auto-sincronização...'
                      : 'Clique em "Sincronizar" para buscar os dispositivos.'
                    : 'Configure a URL e o token acima primeiro.'}
                </p>
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
                          <TableCell className="font-mono text-xs">{device.uniqueId}</TableCell>
                          <TableCell className="text-xs">{device.category || '—'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={device.status === 'online' ? 'default' : device.status === 'offline' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {device.status === 'online' ? '🟢 Online' : device.status === 'offline' ? '🔴 Offline' : device.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
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

        {/* Events Tab */}
        <TabsContent value="events">
          <TraccarEventsTab tenantId={tenantId} devices={devices} connectionStatus={connectionStatus} />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <TraccarNotificationsTab tenantId={tenantId} connectionStatus={connectionStatus} />
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Shield className="h-5 w-5" /> Políticas de Compliance
                  </CardTitle>
                  <CardDescription>Limites de velocidade, zonas de fiscalização e escalonamento disciplinar</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.location.href = '/fleet-policies'}>
                  <Settings className="h-3.5 w-3.5" /> Gerenciar Políticas
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <FleetPoliciesSummary tenantId={tenantId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health">
          <TenantHealthTab tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
