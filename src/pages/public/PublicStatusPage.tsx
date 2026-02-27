/**
 * Public Status Page — /status
 * Shows active incidents, component status, and 30-day uptime.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, MinusCircle, Activity } from 'lucide-react';

const statusIcon: Record<string, typeof CheckCircle2> = {
  operational: CheckCircle2,
  degraded_performance: MinusCircle,
  partial_outage: AlertTriangle,
  major_outage: AlertTriangle,
  under_maintenance: MinusCircle,
};
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

export default function PublicStatusPage() {
  const { data: components = [] } = useQuery({
    queryKey: ['public-status-components'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('status_page_components').select('*').eq('is_active', true).order('display_order');
      return data ?? [];
    },
  });

  const { data: activeIncidents = [] } = useQuery({
    queryKey: ['public-status-incidents'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('status_page_incidents').select('*').in('status', ['investigating', 'identified', 'monitoring']).order('created_at', { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const { data: uptime } = useQuery({
    queryKey: ['public-status-uptime'],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await (supabase as any).from('availability_records').select('uptime_percentage').gte('period_start', since);
      if (!data?.length) return 100;
      return data.reduce((s: number, r: any) => s + (r.uptime_percentage ?? 0), 0) / data.length;
    },
  });

  const allOperational = components.every((c: any) => c.current_status === 'operational');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Status da Plataforma</h1>
          <p className="text-muted-foreground">Monitoramento em tempo real de todos os serviços.</p>
        </div>

        {/* Overall status */}
        <Card className={allOperational ? 'border-emerald-500/30' : 'border-destructive/30'}>
          <CardContent className="py-6 flex items-center justify-center gap-3">
            {allOperational ? (
              <><CheckCircle2 className="h-6 w-6 text-emerald-500" /><span className="text-lg font-semibold text-emerald-600">Todos os sistemas operacionais</span></>
            ) : (
              <><AlertTriangle className="h-6 w-6 text-destructive" /><span className="text-lg font-semibold text-destructive">Alguns sistemas com problemas</span></>
            )}
          </CardContent>
        </Card>

        {/* Active incidents */}
        {activeIncidents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Incidentes Ativos</h2>
            {activeIncidents.map((inc: any) => (
              <Card key={inc.id} className="border-amber-500/30">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{inc.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{inc.impact}</p>
                    </div>
                    <Badge variant="secondary">{inc.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(inc.created_at).toLocaleString('pt-BR')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Components */}
        <Card>
          <CardHeader><CardTitle className="text-base">Componentes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {components.map((c: any) => {
              const Icon = statusIcon[c.current_status] ?? MinusCircle;
              return (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-4 w-4 ${statusColor[c.current_status] ?? 'text-muted-foreground'}`} />
                    <span className="text-xs">{statusLabel[c.current_status] ?? c.current_status}</span>
                  </div>
                </div>
              );
            })}
            {components.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum componente configurado.</p>
            )}
          </CardContent>
        </Card>

        {/* Uptime */}
        <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Activity className="h-4 w-4" />
          Uptime 30 dias: <span className="font-bold text-foreground">{(uptime ?? 100).toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}
