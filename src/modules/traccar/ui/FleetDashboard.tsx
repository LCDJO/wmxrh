/**
 * FleetDashboard — Main fleet monitoring dashboard.
 *
 * Features:
 *  ├── Real-time map (Mapbox GL)
 *  ├── Heatmap toggle
 *  ├── Stats overview
 *  ├── Infractions list
 *  ├── Device drill-down
 *  └── Sync controls
 */
import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useTraccarFleet, type TraccarVehicle } from '@/hooks/useTraccarFleet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MapPin, Activity, AlertTriangle, RefreshCw, Loader2,
  Car, Gauge, Flame, Eye, Layers, BarChart3,
} from 'lucide-react';
import { FleetMap } from './FleetMap';
import { InfractionsList } from './InfractionsList';
import { DeviceProfile } from './DeviceProfile';
import { BtieIntelligenceDashboard } from './BtieIntelligenceDashboard';

export default function FleetDashboard() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const [selectedVehicle, setSelectedVehicle] = useState<TraccarVehicle | null>(null);
  const [heatmapMode, setHeatmapMode] = useState(false);

  const {
    vehicles, loading, error, isConfigured, syncHealth,
    refresh, triggerSync, lastUpdate, stats,
  } = useTraccarFleet({
    tenantId,
    enabled: true,
    pollIntervalMs: 15_000,
    speedLimitKmh: 80,
    useCache: true,
  });

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Selecione um tenant para acessar o painel de frota.</p>
      </div>
    );
  }

  if (!isConfigured && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <MapPin className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Integração com Traccar não configurada.</p>
        <p className="text-xs text-muted-foreground">Configure na aba Integrações → Traccar GPS</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Car className="h-6 w-6" /> Painel de Frota
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitoramento em tempo real
            {lastUpdate && <span className="ml-2">· Atualizado {lastUpdate.toLocaleTimeString('pt-BR')}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={heatmapMode ? 'default' : 'outline'}
            onClick={() => setHeatmapMode(!heatmapMode)}
            className="gap-1.5"
          >
            <Flame className="h-3.5 w-3.5" />
            {heatmapMode ? 'Mapa' : 'Heatmap'}
          </Button>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => triggerSync()} className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Sync Now
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Car, color: 'text-foreground' },
          { label: 'Em Movimento', value: stats.moving, icon: Activity, color: 'text-primary' },
          { label: 'Parado (Lig.)', value: stats.idle, icon: Eye, color: 'text-amber-500' },
          { label: 'Parado', value: stats.stopped, icon: MapPin, color: 'text-muted-foreground' },
          { label: 'Excesso', value: stats.speeding, icon: Gauge, color: 'text-destructive' },
          { label: 'Online', value: stats.online, icon: Layers, color: 'text-primary' },
          { label: 'Offline', value: stats.offline, icon: Layers, color: 'text-muted-foreground' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sync Health Warning */}
      {syncHealth && !syncHealth.isHealthy && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">
            Sincronização com problemas: {syncHealth.lastError || 'Falhas consecutivas'} 
            ({syncHealth.consecutiveFailures} falhas)
          </span>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map (2/3 width) */}
        <div className={selectedVehicle ? 'lg:col-span-1' : 'lg:col-span-2'}>
          <FleetMap
            vehicles={vehicles}
            onVehicleClick={setSelectedVehicle}
            heatmapMode={heatmapMode}
            tenantId={tenantId}
            className="h-[500px]"
          />
        </div>

        {/* Side Panel */}
        <div className={selectedVehicle ? 'lg:col-span-2' : 'lg:col-span-1'}>
          {selectedVehicle ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DeviceProfile
                vehicle={selectedVehicle}
                tenantId={tenantId}
                onClose={() => setSelectedVehicle(null)}
              />
              <InfractionsList
                tenantId={tenantId}
                onEventClick={(e) => console.log('Event detail:', e)}
              />
            </div>
          ) : (
            <Tabs defaultValue="infractions">
              <TabsList className="w-full">
                <TabsTrigger value="infractions" className="gap-1.5 text-xs flex-1">
                  <AlertTriangle className="h-3 w-3" /> Infrações
                </TabsTrigger>
                <TabsTrigger value="vehicles" className="gap-1.5 text-xs flex-1">
                  <Car className="h-3 w-3" /> Veículos
                </TabsTrigger>
              </TabsList>
              <TabsContent value="infractions" className="mt-3">
                <InfractionsList
                  tenantId={tenantId}
                  onEventClick={(e) => console.log('Event detail:', e)}
                />
              </TabsContent>
              <TabsContent value="vehicles" className="mt-3">
                <Card>
                  <CardContent className="p-0">
                    <div className="max-h-[400px] overflow-y-auto">
                      {vehicles.map(v => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedVehicle(v)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  v.computedStatus === 'speeding' ? 'hsl(var(--destructive))' :
                                  v.computedStatus === 'moving' ? 'hsl(142, 71%, 45%)' :
                                  v.computedStatus === 'idle' ? 'hsl(48, 96%, 53%)' :
                                  'hsl(var(--muted-foreground))',
                              }}
                            />
                            <span className="text-sm font-medium">{v.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {v.speed != null && (
                              <span className="text-xs text-muted-foreground">{v.speed} km/h</span>
                            )}
                            <Badge variant={v.status === 'online' ? 'default' : 'secondary'} className="text-xs">
                              {v.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {vehicles.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Nenhum veículo encontrado.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* BTIE Intelligence */}
      <BtieIntelligenceDashboard tenantId={tenantId} />
    </div>
  );
}
