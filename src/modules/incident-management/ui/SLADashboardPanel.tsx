/**
 * SLADashboardPanel — Shows SLA configurations and breach statistics.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function SLADashboardPanel() {
  const { data: configs = [] } = useQuery({
    queryKey: ['incident-sla-configs'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('incident_sla_configs')
        .select('*')
        .eq('is_active', true)
        .order('severity');
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['incident-sla-stats'],
    queryFn: async () => {
      const { data: total } = await (supabase as any)
        .from('incidents')
        .select('*', { count: 'exact', head: true });
      const { data: breached } = await (supabase as any)
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('sla_breached', true);
      const { data: resolved } = await (supabase as any)
        .from('incidents')
        .select('created_at, resolved_at')
        .not('resolved_at', 'is', null)
        .limit(100);

      const resolutionTimes = (resolved ?? [])
        .map((i: any) => (new Date(i.resolved_at).getTime() - new Date(i.created_at).getTime()) / 60_000)
        .filter((t: number) => t > 0);
      const mttr = resolutionTimes.length > 0
        ? Math.round(resolutionTimes.reduce((a: number, b: number) => a + b, 0) / resolutionTimes.length)
        : 0;

      return {
        total: (total as any)?.count ?? 0,
        breached: (breached as any)?.count ?? 0,
        mttr,
      };
    },
  });

  return (
    <div className="space-y-6 mt-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.mttr ?? 0}m</p>
                <p className="text-[10px] text-muted-foreground uppercase">MTTR Médio</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.breached ?? 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase">SLAs Violados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats && stats.total > 0 ? Math.round(((stats.total - stats.breached) / stats.total) * 100) : 100}%
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">Compliance SLA</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Configs */}
      <Card>
        <CardHeader><CardTitle className="text-base">Configuração de SLA por Severidade</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severidade</TableHead>
                <TableHead>Tempo Resposta</TableHead>
                <TableHead>Tempo Ack</TableHead>
                <TableHead>Tempo Resolução</TableHead>
                <TableHead>Escalação Após</TableHead>
                <TableHead>Notif. Intervalo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell><Badge variant="outline">{c.severity?.toUpperCase()}</Badge></TableCell>
                  <TableCell>{c.response_time_minutes}m</TableCell>
                  <TableCell>{c.acknowledgement_time_minutes}m</TableCell>
                  <TableCell>{c.resolution_time_minutes}m</TableCell>
                  <TableCell>{c.escalation_after_minutes}m</TableCell>
                  <TableCell>{c.notification_interval_minutes}m</TableCell>
                </TableRow>
              ))}
              {configs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Usando SLA padrão (sem configuração customizada).
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
