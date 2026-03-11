/**
 * DisplayMapPanel — Geographic map of all active displays across tenants.
 * Shows display locations, status, and allows remote actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Map, Monitor, RefreshCw, Tv, CheckCircle2, AlertTriangle, WifiOff, Building2, Globe, Power } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type LiveDisplay = Database['public']['Tables']['live_displays']['Row'];

interface DisplayWithTenant extends LiveDisplay {
  tenant_name?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; dot: string }> = {
  active: { label: 'Conectado', icon: CheckCircle2, color: 'text-emerald-500', dot: 'bg-emerald-500' },
  paused: { label: 'Pausado', icon: AlertTriangle, color: 'text-amber-500', dot: 'bg-amber-500' },
  disconnected: { label: 'Desconectado', icon: WifiOff, color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

export default function DisplayMapPanel() {
  const { toast } = useToast();
  const [displays, setDisplays] = useState<DisplayWithTenant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('live_displays')
      .select('*, tenants:tenant_id(name)')
      .is('deleted_at', null)
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[DisplayMapPanel] error:', error.message);
      setDisplays([]);
    } else {
      setDisplays(
        (data ?? []).map((d: any) => ({
          ...d,
          tenant_name: d.tenants?.name ?? 'Sem tenant',
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const disconnectDisplay = async (displayId: string) => {
    await supabase.from('live_display_tokens').update({ status: 'expired' }).eq('display_id', displayId).eq('status', 'active');
    await supabase.from('live_displays').update({ status: 'disconnected' }).eq('id', displayId);
    toast({ title: 'Display desconectado remotamente' });
    load();
  };

  const activeCount = displays.filter(d => d.status === 'active').length;
  const pausedCount = displays.filter(d => d.status === 'paused').length;
  const disconnectedCount = displays.filter(d => d.status === 'disconnected').length;

  // Group by tenant
  const byTenant = displays.reduce<Record<string, DisplayWithTenant[]>>((acc, d) => {
    const key = d.tenant_name ?? 'Sem tenant';
    (acc[key] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{displays.length}</p>
            <p className="text-xs text-muted-foreground">Total Displays</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-500">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Conectados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{pausedCount}</p>
            <p className="text-xs text-muted-foreground">Pausados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-muted-foreground">{disconnectedCount}</p>
            <p className="text-xs text-muted-foreground">Desconectados</p>
          </CardContent>
        </Card>
      </div>

      {/* Display map by tenant */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Displays por Tenant
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {Object.keys(byTenant).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Tv className="h-12 w-12 mx-auto opacity-40 mb-2" />
                <p className="text-sm">Nenhum display registrado</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(byTenant).sort(([a], [b]) => a.localeCompare(b)).map(([tenant, tenantDisplays]) => (
                  <div key={tenant}>
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm text-foreground">{tenant}</span>
                      <Badge variant="secondary" className="text-[10px]">{tenantDisplays.length} displays</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pl-6">
                      {tenantDisplays.map(d => {
                        const st = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.disconnected;
                        const StIcon = st.icon;
                        return (
                          <div key={d.id} className="rounded-lg border border-border/50 p-3 hover:border-primary/30 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${st.dot}`} />
                                <span className="font-medium text-sm truncate max-w-[140px]">{d.nome}</span>
                              </div>
                              <StIcon className={`h-3.5 w-3.5 ${st.color}`} />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <Badge variant="outline" className="text-[10px]">{d.tipo}</Badge>
                              <span className="text-[10px] text-muted-foreground">{st.label}</span>
                            </div>
                            {d.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs gap-1 text-destructive hover:bg-destructive/10"
                                onClick={() => disconnectDisplay(d.id)}
                              >
                                <Power className="h-3 w-3" /> Desconectar
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
