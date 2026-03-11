/**
 * DisplayStatusGrid — Real-time NOC-style grid for all displays cross-tenant.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { LayoutGrid, RefreshCw, Monitor, CheckCircle2, AlertTriangle, WifiOff, Clock, Power, RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type LiveDisplay = Database['public']['Tables']['live_displays']['Row'];

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500 shadow-emerald-500/50 shadow-[0_0_6px]',
  paused: 'bg-amber-500 shadow-amber-500/50 shadow-[0_0_6px]',
  disconnected: 'bg-muted-foreground',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Online',
  paused: 'Pausado',
  disconnected: 'Offline',
};

export default function DisplayStatusGrid() {
  const { toast } = useToast();
  const [displays, setDisplays] = useState<(LiveDisplay & { tenant_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('live_displays')
      .select('*, tenants:tenant_id(name)')
      .is('deleted_at', null)
      .order('status')
      .order('last_seen_at', { ascending: false })
      .limit(500);
    setDisplays((data ?? []).map((d: any) => ({ ...d, tenant_name: d.tenants?.name ?? '—' })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const disconnectDisplay = async (id: string) => {
    await supabase.from('live_display_tokens').update({ status: 'expired' }).eq('display_id', id).eq('status', 'active');
    await supabase.from('live_displays').update({ status: 'disconnected' }).eq('id', id);
    toast({ title: 'Display desconectado' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Online: {displays.filter(d => d.status === 'active').length}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Pausado: {displays.filter(d => d.status === 'paused').length}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Offline: {displays.filter(d => d.status === 'disconnected').length}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {displays.map(d => (
          <Card key={d.id} className="hover:border-primary/30 transition-colors group">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${STATUS_DOT[d.status] ?? STATUS_DOT.disconnected}`} />
                <span className="text-[10px] text-muted-foreground">{STATUS_LABEL[d.status] ?? 'Offline'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Monitor className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium text-xs truncate">{d.nome}</span>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground truncate">{d.tenant_name}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge variant="outline" className="text-[9px] px-1 py-0">{d.tipo}</Badge>
                  {d.rotacao_automatica && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                      <RotateCw className="h-2 w-2" />{d.intervalo_rotacao}s
                    </Badge>
                  )}
                </div>
              </div>
              {d.last_seen_at && (
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" /> {format(new Date(d.last_seen_at), 'dd/MM HH:mm')}
                </p>
              )}
              {d.status === 'active' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-6 text-[10px] text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => disconnectDisplay(d.id)}
                >
                  <Power className="h-3 w-3 mr-1" /> Desconectar
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {displays.length === 0 && !loading && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <LayoutGrid className="h-12 w-12 mx-auto opacity-40 mb-2" />
            <p className="text-sm">Nenhum display encontrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
