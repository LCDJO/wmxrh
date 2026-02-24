/**
 * InfractionsList — Fleet behavior violations list with filters.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { getBehaviorEvents, type BehaviorEvent } from '../services/behavior-engine.service';

interface InfractionsListProps {
  tenantId: string | null;
  onEventClick?: (event: BehaviorEvent) => void;
}

const SEVERITY_VARIANT: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
};

const TYPE_LABELS: Record<string, string> = {
  overspeed: 'Excesso de Velocidade',
  harsh_brake: 'Frenagem Brusca',
  after_hours: 'Fora de Horário',
  geofence_violation: 'Violação de Geofence',
  excessive_idle: 'Ociosidade Excessiva',
  unauthorized_route: 'Rota Não Autorizada',
};

export function InfractionsList({ tenantId, onEventClick }: InfractionsListProps) {
  const [events, setEvents] = useState<BehaviorEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchEvents = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await getBehaviorEvents(tenantId, { limit: 200 });
      setEvents(data);
    } catch {}
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = events.filter(e => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && e.event_type !== typeFilter) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" /> Infrações ({filtered.length})
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchEvents} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="flex gap-2 mt-2">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Severidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="low">Baixo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="overspeed">Excesso Velocidade</SelectItem>
              <SelectItem value="harsh_brake">Frenagem Brusca</SelectItem>
              <SelectItem value="after_hours">Fora de Horário</SelectItem>
              <SelectItem value="geofence_violation">Geofence</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma infração encontrada.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data/Hora</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Severidade</TableHead>
                  <TableHead className="text-xs">Dispositivo</TableHead>
                  <TableHead className="text-xs">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow
                    key={e.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onEventClick?.(e)}
                  >
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(e.event_timestamp).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-xs">
                      {TYPE_LABELS[e.event_type] || e.event_type}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_VARIANT[e.severity] || 'outline'} className="text-xs">
                        {SEVERITY_LABELS[e.severity] || e.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{e.device_id}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {e.details?.speed_kmh ? `${e.details.speed_kmh} km/h (limite: ${e.details.limit_kmh})` : JSON.stringify(e.details).slice(0, 60)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
