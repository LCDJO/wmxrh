import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { AlertTriangle, Download } from 'lucide-react';

const SEVERITY_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  low: { label: 'Leve', variant: 'secondary' },
  medium: { label: 'Média', variant: 'default' },
  high: { label: 'Grave', variant: 'destructive' },
  critical: { label: 'Gravíssima', variant: 'destructive' },
};

export function ViolationsTab({ tenantId }: { tenantId: string }) {
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchViolations = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fleet_speed_violations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('detected_at', { ascending: false })
      .limit(100);
    setViolations(data || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchViolations(); }, [fetchViolations]);

  const exportCSV = () => {
    const headers = ['Dispositivo', 'Data', 'Velocidade', 'Limite', 'Excesso', 'Severidade', 'Fonte', 'Lat', 'Lng'];
    const rows = violations.map(v => [
      v.device_name, v.detected_at, v.recorded_speed_kmh, v.speed_limit_kmh,
      v.excess_kmh, v.severity, v.source_name, v.latitude, v.longitude,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `infracoes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Carregando infrações...</div>;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Infrações de Velocidade</CardTitle>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        {violations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma infração detectada.</p>
        ) : (
          <div className="space-y-2">
            {violations.map(v => {
              const sev = SEVERITY_MAP[v.severity] || SEVERITY_MAP.medium;
              return (
                <div key={v.id} className="border rounded-lg p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                  <div className="bg-destructive/10 p-2 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm">{v.device_name || `Device ${v.device_id}`}</span>
                      <Badge variant={sev.variant} className="text-[10px]">{sev.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                      <span className="text-destructive font-medium">{v.recorded_speed_kmh} km/h</span>
                      <span>Limite: {v.speed_limit_kmh} km/h</span>
                      <span>Excesso: +{v.excess_kmh} km/h</span>
                      {v.source_name && <span>Fonte: {v.source_name}</span>}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(v.detected_at), 'dd/MM HH:mm')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
