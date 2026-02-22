/**
 * TenantTraccarSettings — Tenant-level Traccar integration page
 * 
 * Allows tenant admins to:
 * - View platform integration status
 * - Map devices to employees/vehicles
 * - Configure speed policies and enforcement zones
 * - View tracking events and disciplinary actions
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
import { MapPin, Loader2, RefreshCw, Satellite, Shield, Activity, CheckCircle2, WifiOff } from 'lucide-react';

export default function TenantTraccarSettings() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [platformActive, setPlatformActive] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    // Check platform-level config status
    const { data: platformCfg } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'traccar_config')
      .maybeSingle();

    if (platformCfg?.value && typeof platformCfg.value === 'object') {
      const val = platformCfg.value as Record<string, any>;
      setPlatformActive(!!val.is_active && !!val.api_url);
    }

    // Fetch recent tracking events for this tenant
    const { data: evts } = await supabase
      .from('raw_tracking_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('event_timestamp', { ascending: false })
      .limit(20);

    if (evts) setEvents(evts);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
          <Badge variant={platformActive ? 'default' : 'outline'} className={platformActive ? 'bg-primary/10 text-primary' : ''}>
            {platformActive ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Plataforma Ativa</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Plataforma Inativa</>
            )}
          </Badge>
          <Button size="sm" variant="ghost" onClick={fetchData} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      {!platformActive && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              ⚠️ A integração Traccar não está ativa na plataforma. Solicite ao administrador SaaS a ativação para utilizar o rastreamento GPS.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="events" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="events" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Eventos</TabsTrigger>
          <TabsTrigger value="devices" className="gap-1.5 text-xs"><Satellite className="h-3.5 w-3.5" /> Dispositivos</TabsTrigger>
          <TabsTrigger value="policies" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" /> Políticas</TabsTrigger>
        </TabsList>

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

        {/* Devices Tab */}
        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Satellite className="h-5 w-5" /> Dispositivos Mapeados
              </CardTitle>
              <CardDescription>Vincule dispositivos Traccar a veículos e motoristas</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                Configure o mapeamento de dispositivos GPS para seus veículos e motoristas.
              </p>
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
