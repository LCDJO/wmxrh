/**
 * AvailabilityPanel — 30-day availability and component status.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Activity, CheckCircle2 } from 'lucide-react';

const statusColor: Record<string, string> = {
  operational: 'text-emerald-500',
  degraded_performance: 'text-amber-500',
  partial_outage: 'text-amber-600',
  major_outage: 'text-destructive',
  under_maintenance: 'text-blue-500',
};

const statusLabel: Record<string, string> = {
  operational: 'Operacional',
  degraded_performance: 'Degradado',
  partial_outage: 'Outage Parcial',
  major_outage: 'Outage Major',
  under_maintenance: 'Manutenção',
};

export function AvailabilityPanel() {
  const { data: components = [] } = useQuery({
    queryKey: ['status-page-components'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('status_page_components')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      return data ?? [];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ['availability-records-30d'],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await (supabase as any)
        .from('availability_records')
        .select('*')
        .gte('period_start', since)
        .order('period_start', { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const overallUptime = records.length > 0
    ? records.reduce((sum: number, r: any) => sum + (r.uptime_percentage ?? 0), 0) / records.length
    : 100;

  const totalIncidents = records.reduce((sum: number, r: any) => sum + (r.incident_count ?? 0), 0);

  return (
    <div className="space-y-6 mt-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{overallUptime.toFixed(2)}%</p>
                <p className="text-[10px] text-muted-foreground uppercase">Uptime 30 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-2xl font-bold text-foreground">{totalIncidents}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Incidentes no Período</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-2xl font-bold text-foreground">{components.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Componentes Monitorados</p>
          </CardContent>
        </Card>
      </div>

      {/* Components */}
      <Card>
        <CardHeader><CardTitle className="text-base">Status dos Componentes</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Componente</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {components.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.component_group ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className={`h-3.5 w-3.5 ${statusColor[c.current_status] ?? 'text-muted-foreground'}`} />
                      <span className="text-xs font-medium">
                        {statusLabel[c.current_status] ?? c.current_status}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {components.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Nenhum componente configurado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
