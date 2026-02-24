/**
 * TenantTraccarSettings — Tenant-level Traccar integration page
 * 
 * Allows tenant admins to:
 * - Test connection to Traccar server
 * - Sync and view devices from Traccar
 * - View tracking events
 * - Configure speed policies and enforcement zones
 */
import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { MapPin, Loader2, RefreshCw, Satellite, Shield, Activity, CheckCircle2, WifiOff, Plug, ArrowDownToLine } from 'lucide-react';

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

export default function TenantTraccarSettings() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [serverInfo, setServerInfo] = useState<TraccarServerInfo | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const { data: evts } = await supabase
      .from('raw_tracking_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('event_timestamp', { ascending: false })
      .limit(20);

    if (evts) setEvents(evts);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('traccar-proxy', {});

      if (error) throw error;

      if (data?.success) {
        setConnectionStatus('connected');
        setServerInfo(data.data as TraccarServerInfo);
        toast.success('Conexão com Traccar estabelecida com sucesso!');
      } else {
        setConnectionStatus('error');
        toast.error(data?.error || 'Falha ao conectar com o Traccar');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      toast.error(`Erro: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const syncDevices = async () => {
    setLoadingDevices(true);
    try {
      const { data: devData, error: devError } = await supabase.functions.invoke('traccar-proxy?action=devices', {});

      if (devError) throw devError;

      if (devData?.success && Array.isArray(devData.data)) {
        setDevices(devData.data);
        toast.success(`${devData.data.length} dispositivo(s) encontrado(s)`);
      } else {
        toast.error(devData?.error || 'Falha ao buscar dispositivos');
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoadingDevices(false);
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Traccar GPS
          </h1>
          <p className="text-muted-foreground mt-1">
            Rastreamento GPS e compliance de frota
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={connectionStatus === 'connected' ? 'default' : 'outline'}
            className={connectionStatus === 'connected' ? 'bg-primary/10 text-primary' : ''}
          >
            {connectionStatus === 'connected' ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</>
            ) : connectionStatus === 'error' ? (
              <><WifiOff className="h-3 w-3 mr-1" /> Erro de Conexão</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Não verificado</>
            )}
          </Badge>
          <Button size="sm" variant="ghost" onClick={fetchEvents} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Connection Test Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-4 w-4" /> Conexão com Servidor Traccar
          </CardTitle>
          <CardDescription>Teste a conectividade com o servidor de rastreamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={testConnection} disabled={testingConnection} className="gap-2">
              {testingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {testingConnection ? 'Testando...' : 'Testar Conexão'}
            </Button>

            {connectionStatus === 'connected' && serverInfo && (
              <div className="text-sm text-muted-foreground">
                Servidor Traccar <Badge variant="outline" className="ml-1">v{serverInfo.version}</Badge>
              </div>
            )}

            {connectionStatus === 'error' && (
              <p className="text-sm text-destructive">
                Não foi possível conectar ao servidor. Verifique a URL e o token de acesso.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="devices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="devices" className="gap-1.5 text-xs"><Satellite className="h-3.5 w-3.5" /> Dispositivos</TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Eventos</TabsTrigger>
          <TabsTrigger value="policies" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" /> Políticas</TabsTrigger>
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
                  <CardDescription>Dispositivos registrados no servidor Traccar</CardDescription>
                </div>
                <Button onClick={syncDevices} disabled={loadingDevices} size="sm" className="gap-1.5">
                  {loadingDevices ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
                  Sincronizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Clique em "Sincronizar" para buscar os dispositivos do servidor Traccar.
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Activity className="h-5 w-5" /> Últimos Eventos GPS
              </CardTitle>
              <CardDescription>Eventos recebidos do Traccar para este tenant</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum evento registrado ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Device ID</TableHead>
                        <TableHead className="text-xs">Lat/Lon</TableHead>
                        <TableHead className="text-xs">Velocidade</TableHead>
                        <TableHead className="text-xs">Timestamp</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((evt: any) => (
                        <TableRow key={evt.id}>
                          <TableCell className="font-mono text-xs">{evt.device_id}</TableCell>
                          <TableCell className="text-xs">{evt.latitude?.toFixed(4)}, {evt.longitude?.toFixed(4)}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant={evt.speed > 100 ? 'destructive' : evt.speed > 80 ? 'secondary' : 'outline'} className="text-xs">
                              {evt.speed?.toFixed(0)} km/h
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{new Date(evt.event_timestamp).toLocaleString('pt-BR')}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {evt.processing_status || 'raw'}
                            </Badge>
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

        {/* Policies Tab */}
        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Shield className="h-5 w-5" /> Políticas de Compliance
              </CardTitle>
              <CardDescription>Limites de velocidade, zonas de fiscalização e escalonamento disciplinar</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                Configure limites de velocidade por zona, pontos de fiscalização eletrônica e políticas disciplinares.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
