import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Car, Download, MapPin } from 'lucide-react';

export function TripsTab({ tenantId }: { tenantId: string }) {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fleet_trips')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('start_time', { ascending: false })
      .limit(50);
    setTrips(data || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const exportCSV = () => {
    const headers = ['Dispositivo', 'Início', 'Fim', 'Distância (km)', 'Vel. Média', 'Vel. Máx', 'Posições', 'Infrações'];
    const rows = trips.map(t => [
      t.device_name, t.start_time, t.end_time, t.distance_km, t.avg_speed_kmh, t.max_speed_kmh, t.position_count, t.violation_count,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `viagens_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Carregando viagens...</div>;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Viagens Recentes</CardTitle>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        {trips.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma viagem registrada. Sincronize os dados primeiro.</p>
        ) : (
          <div className="space-y-2">
            {trips.map(t => (
              <div key={t.id} className="border rounded-lg p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Car className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm truncate">{t.device_name || `Device ${t.device_id}`}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {t.distance_km} km
                    </Badge>
                    {t.violation_count > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {t.violation_count} infração(ões)
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                    <span>{format(new Date(t.start_time), 'dd/MM HH:mm')} → {format(new Date(t.end_time), 'HH:mm')}</span>
                    <span>Méd: {t.avg_speed_kmh} km/h</span>
                    <span>Máx: {t.max_speed_kmh} km/h</span>
                    <span>{t.position_count} pts</span>
                  </div>
                  {(t.start_address || t.end_address) && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {t.start_address || '?'} → {t.end_address || '?'}
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                  {t.duration_seconds ? `${Math.round(t.duration_seconds / 60)} min` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
