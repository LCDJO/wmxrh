import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Activity, CheckCircle2, XCircle, Clock } from 'lucide-react';

export function SyncStatusPanel({ tenantId }: { tenantId: string }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fleet_sync_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20);
    setJobs(data || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Histórico de Sincronização</CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sincronização realizada ainda.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map(j => (
              <div key={j.id} className="border rounded-lg p-3 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${j.status === 'completed' ? 'bg-green-500/10' : j.status === 'failed' ? 'bg-red-500/10' : 'bg-yellow-500/10'}`}>
                  {j.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                   j.status === 'failed' ? <XCircle className="h-4 w-4 text-red-500" /> :
                   <Clock className="h-4 w-4 text-yellow-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant={j.status === 'completed' ? 'default' : j.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {j.status === 'completed' ? 'Completo' : j.status === 'failed' ? 'Falha' : 'Executando'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{j.job_type}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                    {j.devices_synced > 0 && <span>{j.devices_synced} dispositivos</span>}
                    {j.positions_synced > 0 && <span>{j.positions_synced} posições</span>}
                    {j.trips_built > 0 && <span>{j.trips_built} viagens</span>}
                    {j.violations_detected > 0 && <span className="text-destructive">{j.violations_detected} infrações</span>}
                    {j.error_message && <span className="text-destructive">{j.error_message}</span>}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(j.created_at), 'dd/MM HH:mm')}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
