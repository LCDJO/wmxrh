/**
 * SecurityAlertsTable — Full alerts table with actions.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle, Shield, Search, CheckCircle, Ban, LogOut, Eye, Clock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { blockSession, remoteLogout } from '@/modules/user-activity/engine/session-events';
import { toast } from 'sonner';
import type { SecurityAlertRecord } from '../hooks/useSecurityAlerts';

interface Props {
  alerts: SecurityAlertRecord[];
  onRefresh: () => void;
}

const levelBadge = (level: string) => {
  if (level === 'HIGH') return <Badge variant="destructive" className="text-[8px] h-4">HIGH</Badge>;
  if (level === 'MEDIUM') return <Badge variant="secondary" className="text-[8px] h-4">MEDIUM</Badge>;
  return <Badge variant="outline" className="text-[8px] h-4">LOW</Badge>;
};

const statusBadge = (status: string) => {
  const variants: Record<string, 'destructive' | 'secondary' | 'outline'> = {
    open: 'destructive',
    investigating: 'secondary',
    resolved: 'outline',
    false_positive: 'outline',
  };
  return <Badge variant={variants[status] ?? 'outline'} className="text-[8px] h-4">{status}</Badge>;
};

export function SecurityAlertsTable({ alerts, onRefresh }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [resolveDialog, setResolveDialog] = useState<SecurityAlertRecord | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveStatus, setResolveStatus] = useState<'resolved' | 'false_positive'>('resolved');

  const filtered = alerts.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (levelFilter !== 'all' && a.risk_level !== levelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) ||
        a.ip_address?.toLowerCase().includes(q) ||
        a.location?.toLowerCase().includes(q) ||
        a.user_id.toLowerCase().includes(q);
    }
    return true;
  });

  const handleResolve = async () => {
    if (!resolveDialog || !user) return;
    await supabase.from('security_alerts').update({
      status: resolveStatus,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution_note: resolveNote || null,
    } as any).eq('id', resolveDialog.id);
    toast.success(resolveStatus === 'resolved' ? 'Alerta resolvido' : 'Marcado como falso positivo');
    setResolveDialog(null);
    setResolveNote('');
    onRefresh();
  };

  const handleBlock = async (alert: SecurityAlertRecord) => {
    if (!alert.session_id || !user) return;
    const success = await blockSession(alert.session_id, user.id, `Blocked via Security Center: ${alert.title}`);
    if (success) {
      toast.success('Sessão bloqueada');
      await supabase.from('security_alerts').update({
        status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user.id,
        resolution_note: 'Session blocked', auto_action_taken: 'block_session',
      } as any).eq('id', alert.id);
      onRefresh();
    } else toast.error('Falha ao bloquear');
  };

  const handleLogout = async (alert: SecurityAlertRecord) => {
    if (!alert.session_id || !user) return;
    const success = await remoteLogout(alert.session_id, user.id);
    if (success) toast.success('Logout remoto executado');
    else toast.error('Falha no logout remoto');
  };

  const handleInvestigate = async (alert: SecurityAlertRecord) => {
    if (!user) return;
    await supabase.from('security_alerts').update({
      status: 'investigating',
    } as any).eq('id', alert.id);
    toast.info('Alerta marcado como em investigação');
    onRefresh();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" /> Alertas de Segurança
            <Badge variant="secondary" className="text-xs ml-auto">{filtered.length}</Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar por título, IP, local..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="investigating">Investigando</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
                <SelectItem value="false_positive">Falso Positivo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Nível" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="HIGH">Alto</SelectItem>
                <SelectItem value="MEDIUM">Médio</SelectItem>
                <SelectItem value="LOW">Baixo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow className="text-[10px]">
                  <TableHead>Alerta</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                      Nenhum alerta encontrado
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map(a => (
                  <TableRow key={a.id} className="text-[11px]">
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className={`h-3 w-3 ${a.risk_level === 'HIGH' ? 'text-destructive' : 'text-amber-500'}`} />
                        <span className="font-medium truncate max-w-[200px]">{a.title}</span>
                      </div>
                      {a.description && <p className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{a.description}</p>}
                    </TableCell>
                    <TableCell className="font-mono text-[10px]">{a.user_id.slice(0, 8)}</TableCell>
                    <TableCell>{a.location ?? '—'}</TableCell>
                    <TableCell className="font-mono text-[10px]">{a.ip_address ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {levelBadge(a.risk_level)}
                        <span className="text-[9px] text-muted-foreground">{a.risk_score}</span>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(a.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {a.status === 'open' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" onClick={() => handleInvestigate(a)}>
                            <Eye className="h-2.5 w-2.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" onClick={() => { setResolveDialog(a); setResolveNote(''); setResolveStatus('resolved'); }}>
                            <CheckCircle className="h-2.5 w-2.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" onClick={() => handleLogout(a)} disabled={!a.session_id}>
                            <LogOut className="h-2.5 w-2.5" />
                          </Button>
                          <Button size="sm" variant="destructive" className="h-5 text-[9px] px-1.5" onClick={() => handleBlock(a)} disabled={!a.session_id}>
                            <Ban className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      )}
                      {a.status === 'investigating' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" onClick={() => { setResolveDialog(a); setResolveNote(''); setResolveStatus('resolved'); }}>
                            <CheckCircle className="h-2.5 w-2.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" onClick={() => { setResolveDialog(a); setResolveNote(''); setResolveStatus('false_positive'); }}>
                            FP
                          </Button>
                        </div>
                      )}
                      {(a.status === 'resolved' || a.status === 'false_positive') && a.resolution_note && (
                        <span className="text-[9px] text-muted-foreground italic truncate max-w-[100px] block">{a.resolution_note}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!resolveDialog} onOpenChange={() => setResolveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {resolveStatus === 'resolved' ? 'Resolver Alerta' : 'Marcar como Falso Positivo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{resolveDialog?.title}</p>
            <Textarea
              placeholder="Nota de resolução (opcional)..."
              value={resolveNote}
              onChange={e => setResolveNote(e.target.value)}
              className="text-xs min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResolveDialog(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleResolve}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
