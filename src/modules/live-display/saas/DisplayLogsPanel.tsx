/**
 * DisplayLogsPanel — Event logs for display pairing, disconnections, errors.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { ScrollText, RefreshCw, Link2, Power, AlertTriangle, Search, Shield } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type AuditRow = Database['public']['Tables']['live_display_audit_log']['Row'];

const EVENT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pair_request: { label: 'Solicitação de Pareamento', color: 'text-blue-500', icon: Link2 },
  pair_confirm: { label: 'Pareamento Confirmado', color: 'text-emerald-500', icon: Link2 },
  disconnect: { label: 'Desconexão', color: 'text-amber-500', icon: Power },
  token_expired: { label: 'Token Expirado', color: 'text-muted-foreground', icon: Shield },
  error: { label: 'Erro', color: 'text-destructive', icon: AlertTriangle },
};

export default function DisplayLogsPanel() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('live_display_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) console.error('[DisplayLogs]', error.message);
    setLogs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? logs.filter(l =>
        l.event_type.includes(search.toLowerCase()) ||
        (l.ip_address ?? '').includes(search) ||
        (l.display_id ?? '').includes(search) ||
        JSON.stringify(l.metadata ?? {}).toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por evento, IP, display..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" /> Logs de Eventos ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[550px]">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ScrollText className="h-12 w-12 mx-auto opacity-40 mb-2" />
                <p className="text-sm">Nenhum log encontrado</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filtered.map(log => {
                  const cfg = EVENT_CONFIG[log.event_type] ?? EVENT_CONFIG.error;
                  const Icon = cfg.icon;
                  const meta = log.metadata as Record<string, any> | null;
                  return (
                    <div key={log.id} className="flex items-center gap-3 p-2 rounded border border-border/30 hover:bg-muted/20 transition-colors text-xs">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                      <span className={`font-medium w-[180px] truncate ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-muted-foreground font-mono w-[120px] truncate">{log.display_id?.slice(0, 8) ?? '—'}…</span>
                      <span className="text-muted-foreground w-[110px]">{log.ip_address ?? '—'}</span>
                      {meta?.pairing_code && (
                        <Badge variant="outline" className="text-[10px] font-mono">{meta.pairing_code}</Badge>
                      )}
                      <span className="text-muted-foreground ml-auto">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
