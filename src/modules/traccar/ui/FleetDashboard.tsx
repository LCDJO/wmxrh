/**
 * FleetDashboard — Main fleet monitoring dashboard.
 *
 * Redesigned with grouped sections, clean visual hierarchy,
 * and intuitive navigation between monitoring views.
 */
import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useTraccarFleet, type TraccarVehicle } from '@/hooks/useTraccarFleet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  MapPin, Activity, AlertTriangle, RefreshCw, Loader2,
  Car, Gauge, Flame, Eye, Layers, History,
  Search, Signal, SignalZero, ChevronRight, Zap,
} from 'lucide-react';
import { FleetMap } from './FleetMap';
import { InfractionsList } from './InfractionsList';
import { DeviceProfile } from './DeviceProfile';
import { BtieIntelligenceDashboard } from './BtieIntelligenceDashboard';
import { DeviceHistoryReplay } from './DeviceHistoryReplay';

export default function FleetDashboard() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const [selectedVehicle, setSelectedVehicle] = useState<TraccarVehicle | null>(null);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [historyDeviceId, setHistoryDeviceId] = useState<number | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState('');

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
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5">
        <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center">
          <MapPin className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <div className="text-center space-y-1.5">
          <h2 className="text-lg font-semibold text-foreground">Traccar GPS não configurado</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Configure a integração na aba <strong>Integrações → Traccar GPS</strong> para começar a monitorar sua frota.
          </p>
        </div>
      </div>
    );
  }

  const filteredVehicles = vehicles.filter(v =>
    !vehicleSearch || v.name.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
    v.uniqueId?.toLowerCase().includes(vehicleSearch.toLowerCase())
  );

  const statusColor = (status: string) => {
    switch (status) {
      case 'speeding': return 'bg-destructive';
      case 'moving': return 'bg-emerald-500';
      case 'idle': return 'bg-amber-500';
      default: return 'bg-muted-foreground';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'speeding': return 'Excesso';
      case 'moving': return 'Movimento';
      case 'idle': return 'Ligado';
      default: return 'Parado';
    }
  };

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Painel de Frota
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitoramento em tempo real
              {lastUpdate && (
                <span className="ml-1.5 text-xs">
                  · {lastUpdate.toLocaleTimeString('pt-BR')}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={heatmapMode ? 'default' : 'outline'}
            onClick={() => setHeatmapMode(!heatmapMode)}
            className="gap-1.5 h-8"
          >
            <Flame className="h-3.5 w-3.5" />
            {heatmapMode ? 'Mapa Normal' : 'Heatmap'}
          </Button>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading} className="gap-1.5 h-8">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => triggerSync()} className="gap-1.5 h-8">
            <Zap className="h-3.5 w-3.5" /> Sync
          </Button>
        </div>
      </div>

      {/* ═══ Stats Overview ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Car, variant: 'default' as const },
          { label: 'Em Movimento', value: stats.moving, icon: Activity, variant: 'moving' as const },
          { label: 'Ligado (Parado)', value: stats.idle, icon: Eye, variant: 'idle' as const },
          { label: 'Desligado', value: stats.stopped, icon: MapPin, variant: 'stopped' as const },
          { label: 'Excesso Vel.', value: stats.speeding, icon: Gauge, variant: 'speeding' as const },
          { label: 'Online', value: stats.online, icon: Signal, variant: 'online' as const },
          { label: 'Offline', value: stats.offline, icon: SignalZero, variant: 'offline' as const },
        ].map(s => {
          const colorMap: Record<string, string> = {
            default: 'text-foreground',
            moving: 'text-emerald-500',
            idle: 'text-amber-500',
            stopped: 'text-muted-foreground',
            speeding: 'text-destructive',
            online: 'text-primary',
            offline: 'text-muted-foreground',
          };
          return (
            <Card key={s.label} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`h-3.5 w-3.5 ${colorMap[s.variant]}`} />
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</span>
                </div>
                <div className={`text-2xl font-bold tabular-nums ${colorMap[s.variant]}`}>{s.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ═══ Alerts ═══ */}
      {syncHealth && !syncHealth.isHealthy && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Sincronização com problemas</p>
            <p className="text-xs text-destructive/80 mt-0.5">
              {syncHealth.lastError || 'Falhas consecutivas'} — {syncHealth.consecutiveFailures} falha(s)
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ═══ Main Content: Map + Side Panel ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Map Section */}
        <div className={selectedVehicle ? 'lg:col-span-5' : 'lg:col-span-8'}>
          <Card className="overflow-hidden">
            <FleetMap
              vehicles={vehicles}
              onVehicleClick={setSelectedVehicle}
              heatmapMode={heatmapMode}
              tenantId={tenantId}
              className="h-[520px]"
            />
          </Card>
        </div>

        {/* Side Panel */}
        <div className={selectedVehicle ? 'lg:col-span-7' : 'lg:col-span-4'}>
          {selectedVehicle ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
            <Card className="h-full flex flex-col">
              <Tabs defaultValue="vehicles" className="flex flex-col h-full">
                <CardHeader className="pb-0 space-y-3">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="vehicles" className="gap-1.5 text-xs">
                      <Car className="h-3 w-3" /> Veículos
                    </TabsTrigger>
                    <TabsTrigger value="infractions" className="gap-1.5 text-xs">
                      <AlertTriangle className="h-3 w-3" /> Infrações
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-1.5 text-xs">
                      <History className="h-3 w-3" /> Histórico
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                {/* ── Vehicles Tab ── */}
                <TabsContent value="vehicles" className="flex-1 mt-0 flex flex-col">
                  <div className="px-4 py-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar veículo..."
                        value={vehicleSearch}
                        onChange={e => setVehicleSearch(e.target.value)}
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                  </div>
                  <ScrollArea className="flex-1 max-h-[420px]">
                    <div className="px-2">
                      {filteredVehicles.length === 0 ? (
                        <div className="text-center py-12">
                          <Car className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground">Nenhum veículo encontrado.</p>
                        </div>
                      ) : (
                        filteredVehicles.map(v => (
                          <div
                            key={v.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors group mb-0.5"
                            onClick={() => setSelectedVehicle(v)}
                          >
                            {/* Status dot */}
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor(v.computedStatus || 'stopped')}`} />

                            {/* Vehicle info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{v.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-muted-foreground">
                                  {statusLabel(v.computedStatus || 'stopped')}
                                </span>
                                {v.speed != null && v.speed > 0 && (
                                  <span className="text-[11px] text-muted-foreground">
                                    · {v.speed} km/h
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); setHistoryDeviceId(v.id); }}
                                title="Ver histórico"
                              >
                                <History className="h-3.5 w-3.5" />
                              </Button>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-5 ${
                                  v.status === 'online'
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {v.status === 'online' ? 'ON' : 'OFF'}
                              </Badge>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground/60 transition-colors" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* ── Infractions Tab ── */}
                <TabsContent value="infractions" className="flex-1 mt-0 px-4 pb-4">
                  <InfractionsList
                    tenantId={tenantId}
                    onEventClick={(e) => console.log('Event detail:', e)}
                  />
                </TabsContent>

                {/* ── History Tab ── */}
                <TabsContent value="history" className="flex-1 mt-0 px-4 pb-4">
                  <DeviceHistoryReplay
                    tenantId={tenantId}
                    vehicles={vehicles}
                    initialDeviceId={historyDeviceId ?? undefined}
                    onClose={() => setHistoryDeviceId(null)}
                  />
                </TabsContent>
              </Tabs>
            </Card>
          )}
        </div>
      </div>

      {/* History Replay Modal (when opened from vehicle list) */}
      {historyDeviceId && (
        <DeviceHistoryReplay
          tenantId={tenantId}
          vehicles={vehicles}
          initialDeviceId={historyDeviceId}
          onClose={() => setHistoryDeviceId(null)}
        />
      )}

      {/* ═══ BTIE Intelligence Section ═══ */}
      <Separator />
      <BtieIntelligenceDashboard tenantId={tenantId} />
    </div>
  );
}
