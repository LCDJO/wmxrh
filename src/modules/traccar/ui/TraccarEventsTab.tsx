/**
 * TraccarEventsTab — Rich events view fetching from Traccar /api/reports/events
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Activity, Loader2, RefreshCw, AlertTriangle, MapPin, Fuel, Bell,
  Wifi, WifiOff, Car, Square, Zap, Shield, Wrench, User, Camera,
  Navigation, ChevronDown,
} from 'lucide-react';

// Traccar event type mapping
const EVENT_TYPE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  deviceOnline:       { label: 'Online',              icon: Wifi,          color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  deviceOffline:      { label: 'Offline',             icon: WifiOff,       color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  deviceUnknown:      { label: 'Desconhecido',        icon: AlertTriangle, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  deviceInactive:     { label: 'Inativo',             icon: Square,        color: 'bg-muted text-muted-foreground border-border' },
  deviceMoving:       { label: 'Em Movimento',        icon: Car,           color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  deviceStopped:      { label: 'Parado',              icon: Square,        color: 'bg-muted text-muted-foreground border-border' },
  deviceOverspeed:    { label: 'Excesso Velocidade',  icon: Zap,           color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  deviceFuelDrop:     { label: 'Queda Combustível',   icon: Fuel,          color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  deviceFuelIncrease: { label: 'Abastecimento',       icon: Fuel,          color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  geofenceEnter:      { label: 'Entrada Geocerca',    icon: MapPin,        color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  geofenceExit:       { label: 'Saída Geocerca',      icon: Navigation,    color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  alarm:              { label: 'Alarme',              icon: AlertTriangle, color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  ignitionOn:         { label: 'Ignição Ligada',      icon: Zap,           color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  ignitionOff:        { label: 'Ignição Desligada',   icon: Zap,           color: 'bg-muted text-muted-foreground border-border' },
  maintenance:        { label: 'Manutenção',          icon: Wrench,        color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  driverChanged:      { label: 'Motorista Alterado',  icon: User,          color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  media:              { label: 'Mídia',               icon: Camera,        color: 'bg-muted text-muted-foreground border-border' },
  commandResult:      { label: 'Resultado Comando',   icon: Shield,        color: 'bg-muted text-muted-foreground border-border' },
};

const ALARM_LABELS: Record<string, string> = {
  general: 'Geral', sos: 'SOS/Pânico', vibration: 'Vibração', overspeed: 'Excesso Velocidade',
  lowPower: 'Energia Baixa', lowBattery: 'Bateria Fraca', geofenceEnter: 'Geocerca (entrada)',
  geofenceExit: 'Geocerca (saída)', tampering: 'Violação', removing: 'Remoção',
  powerCut: 'Corte Energia', accident: 'Acidente', hardBraking: 'Frenagem Brusca',
  hardAcceleration: 'Aceleração Brusca', hardCornering: 'Curva Brusca', fatigueDriving: 'Fadiga',
  fall: 'Queda', bonnet: 'Capô', door: 'Porta', parking: 'Estacionamento',
};

interface TraccarEvent {
  id: number;
  type: string;
  eventTime: string;
  deviceId: number;
  positionId: number;
  geofenceId: number;
  maintenanceId: number;
  attributes: Record<string, unknown>;
}

interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
}

interface Props {
  tenantId: string | null;
  devices: TraccarDevice[];
  connectionStatus: 'unknown' | 'connected' | 'error';
}

export default function TraccarEventsTab({ tenantId, devices, connectionStatus }: Props) {
  const [events, setEvents] = useState<TraccarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDevice, setFilterDevice] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 16);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 16));

  const fetchEvents = useCallback(async () => {
    if (!tenantId || connectionStatus !== 'connected') return;
    setLoading(true);
    try {
      // Fetch events for each device (Traccar requires deviceId)
      const deviceIds = filterDevice !== 'all'
        ? [parseInt(filterDevice)]
        : devices.map(d => d.id);

      if (deviceIds.length === 0) {
        toast.error('Nenhum dispositivo disponível. Sincronize primeiro.');
        setLoading(false);
        return;
      }

      const allEvents: TraccarEvent[] = [];
      const fromISO = new Date(dateFrom).toISOString();
      const toISO = new Date(dateTo).toISOString();

      // Fetch in parallel (max 5 concurrent)
      const chunks = [];
      for (let i = 0; i < deviceIds.length; i += 5) {
        chunks.push(deviceIds.slice(i, i + 5));
      }

      for (const chunk of chunks) {
        const results = await Promise.all(
          chunk.map(dId =>
            supabase.functions.invoke('traccar-proxy', {
              body: {
                action: 'events',
                tenantId,
                deviceId: String(dId),
                from: fromISO,
                to: toISO,
                eventType: filterType !== 'all' ? filterType : '',
              },
            })
          )
        );

        for (const { data, error } of results) {
          if (!error && data?.success && Array.isArray(data.data)) {
            allEvents.push(...data.data);
          }
        }
      }

      // Sort by time desc
      allEvents.sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
      setEvents(allEvents);

      if (allEvents.length === 0) {
        toast.info('Nenhum evento encontrado no período selecionado.');
      } else {
        toast.success(`${allEvents.length} evento(s) encontrado(s)`);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [tenantId, connectionStatus, devices, filterDevice, dateFrom, dateTo, filterType]);

  const getDeviceName = (deviceId: number) => {
    const dev = devices.find(d => d.id === deviceId);
    return dev ? dev.name : `#${deviceId}`;
  };

  const getEventDisplay = (evt: TraccarEvent) => {
    const mapped = EVENT_TYPE_MAP[evt.type];
    if (mapped) return mapped;
    return { label: evt.type, icon: Activity, color: 'bg-muted text-muted-foreground border-border' };
  };

  const getAlarmDetail = (evt: TraccarEvent) => {
    if (evt.type !== 'alarm') return null;
    const alarmType = evt.attributes?.alarm as string;
    return alarmType ? (ALARM_LABELS[alarmType] || alarmType) : null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Activity className="h-5 w-5" /> Eventos & Notificações do Traccar
        </CardTitle>
        <CardDescription>
          Eventos gerados pelo servidor Traccar: status, geocercas, alarmes, velocidade, combustível e mais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo de Evento</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {Object.entries(EVENT_TYPE_MAP).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dispositivo</Label>
            <Select value={filterDevice} onValueChange={setFilterDevice}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {devices.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex items-end">
            <Button onClick={fetchEvents} disabled={loading || connectionStatus !== 'connected'} className="w-full gap-1.5 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Buscar Eventos
            </Button>
          </div>
        </div>

        {/* Event Type Legend */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EVENT_TYPE_MAP).slice(0, 8).map(([key, val]) => {
            const Icon = val.icon;
            return (
              <Badge key={key} variant="outline" className={`text-[10px] gap-1 ${val.color}`}>
                <Icon className="h-3 w-3" />
                {val.label}
              </Badge>
            );
          })}
          <Badge variant="outline" className="text-[10px] text-muted-foreground">+{Object.keys(EVENT_TYPE_MAP).length - 8} tipos</Badge>
        </div>

        {/* Results */}
        {connectionStatus !== 'connected' ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Conecte-se ao Traccar primeiro para visualizar eventos.
          </p>
        ) : events.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Use os filtros acima e clique em "Buscar Eventos" para carregar dados.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[180px]">Tipo</TableHead>
                  <TableHead className="text-xs w-[140px]">Dispositivo</TableHead>
                  <TableHead className="text-xs w-[180px]">Data/Hora</TableHead>
                  <TableHead className="text-xs">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((evt) => {
                  const display = getEventDisplay(evt);
                  const Icon = display.icon;
                  const alarmDetail = getAlarmDetail(evt);
                  return (
                    <TableRow key={`${evt.id}-${evt.deviceId}`}>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs gap-1 ${display.color}`}>
                          <Icon className="h-3 w-3" />
                          {display.label}
                        </Badge>
                        {alarmDetail && (
                          <Badge variant="destructive" className="text-[10px] ml-1">
                            {alarmDetail}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{getDeviceName(evt.deviceId)}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(evt.eventTime).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {evt.geofenceId > 0 && <span className="mr-2">Geocerca #{evt.geofenceId}</span>}
                        {evt.maintenanceId > 0 && <span className="mr-2">Manutenção #{evt.maintenanceId}</span>}
                        {evt.attributes && Object.keys(evt.attributes).length > 0 && (
                          <span className="font-mono text-[10px]">
                            {Object.entries(evt.attributes).map(([k, v]) => `${k}=${v}`).join(', ')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
