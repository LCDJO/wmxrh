/**
 * /platform/security/federation/audit-logs — Federation Audit Logs
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Search, RefreshCw, Filter } from 'lucide-react';

interface AuditRow {
  id: string;
  event_type: string;
  protocol: string | null;
  user_id: string | null;
  tenant_id: string;
  idp_config_id: string | null;
  session_id: string | null;
  ip_address: string | null;
  success: boolean;
  details: Record<string, unknown>;
  error_message: string | null;
  user_agent: string | null;
  created_at: string;
}

const EVENT_COLORS: Record<string, string> = {
  login_success: 'default',
  login_failure: 'destructive',
  logout: 'secondary',
  token_issued: 'default',
  token_refreshed: 'secondary',
  token_revoked: 'outline',
  session_created: 'default',
  session_expired: 'secondary',
};

export default function FederationAuditLogs() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    const { data } = await supabase
      .from('federation_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs((data ?? []) as unknown as AuditRow[]);
    setLoading(false);
  }

  const filtered = logs.filter((l) => {
    if (eventFilter !== 'all' && l.event_type !== eventFilter) return false;
    if (search && !JSON.stringify(l).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const eventTypes = [...new Set(logs.map((l) => l.event_type))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Federation Audit Logs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Eventos de autenticação federada, tokens e sessões.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadLogs}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nos logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="Tipo de evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os eventos</SelectItem>
                  {eventTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Protocolo</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum log encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge
                        variant={(EVENT_COLORS[log.event_type] || 'outline') as any}
                        className="text-[10px] font-mono"
                      >
                        {log.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{log.protocol?.toUpperCase() || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={log.success ? 'default' : 'destructive'} className="text-[10px]">
                        {log.success ? 'OK' : 'FALHA'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.user_id?.slice(0, 8) || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.ip_address || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Exibindo {filtered.length} de {logs.length} eventos.
      </p>
    </div>
  );
}
