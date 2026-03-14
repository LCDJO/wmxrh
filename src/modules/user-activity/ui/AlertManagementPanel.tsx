/**
 * AlertManagementPanel — Platform admin panel for managing security alerts.
 * Supports: resolve, investigate, block session.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle, Shield, CheckCircle, Search, Ban, Eye, Clock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { blockSession, remoteLogout } from '../engine/session-events';
import { toast } from 'sonner';

interface SecurityAlert {
  id: string;
  session_id: string | null;
  tenant_id: string | null;
  user_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string | null;
  ip_address: string | null;
  location: string | null;
  risk_score: number;
  status: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function AlertManagementPanel() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resolveDialog, setResolveDialog] = useState<SecurityAlert | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('session_security_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setAlerts((data as SecurityAlert[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
    const channel = supabase
      .channel('security-alerts-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_security_alerts' }, fetchAlerts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAlerts]);

  const handleResolve = async () => {
    if (!resolveDialog || !user) return;
    await supabase
      .from('session_security_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_note: resolveNote || null,
      } as any)
      .eq('id', resolveDialog.id);
    toast.success('Alerta resolvido');
    setResolveDialog(null);
    setResolveNote('');
    fetchAlerts();
  };

  const handleBlock = async (alert: SecurityAlert) => {
    if (!alert.session_id || !user) return;
    const success = await blockSession(alert.session_id, user.id, `Blocked via alert: ${alert.title}`);
    if (success) {
      toast.success('Sessão bloqueada');
      await supabase
        .from('session_security_alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user.id, resolution_note: 'Session blocked' } as any)
        .eq('id', alert.id);
      fetchAlerts();
    } else {
      toast.error('Falha ao bloquear sessão');
    }
  };

  const handleRemoteLogout = async (alert: SecurityAlert) => {
    if (!alert.session_id || !user) return;
    const success = await remoteLogout(alert.session_id, user.id);
    if (success) toast.success('Logout remoto executado');
    else toast.error('Falha no logout remoto');
  };

  const filtered = alerts.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.title.toLowerCase().includes(q) || a.ip_address?.toLowerCase().includes(q) || a.location?.toLowerCase().includes(q);
  });

  const openAlerts = filtered.filter(a => a.status === 'open');
  const resolvedAlerts = filtered.filter(a => a.status === 'resolved');

  const severityVariant = (s: string): 'destructive' | 'secondary' | 'outline' =>
    s === 'high' ? 'destructive' : s === 'medium' ? 'secondary' : 'outline';

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" /> Painel de Alertas
            {openAlerts.length > 0 && <Badge variant="destructive" className="text-[10px]">{openAlerts.length} abertos</Badge>}
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar alertas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {loading ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />
                Nenhum alerta encontrado
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {/* Open alerts first */}
                {openAlerts.map(a => (
                  <div key={a.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{a.title}</span>
                          <Badge variant={severityVariant(a.severity)} className="text-[8px] h-4">{a.severity}</Badge>
                          <Badge variant="outline" className="text-[8px] h-4">score: {a.risk_score}</Badge>
                        </div>
                        {a.description && <p className="text-[10px] text-muted-foreground mt-0.5">{a.description}</p>}
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span>{a.ip_address ?? '—'}</span>
                          <span>{a.location ?? '—'}</span>
                          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {new Date(a.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1.5 mt-2 ml-6">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => { setResolveDialog(a); setResolveNote(''); }}>
                        <CheckCircle className="h-3 w-3" /> Resolver
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => handleRemoteLogout(a)}>
                        <Eye className="h-3 w-3" /> Logout Remoto
                      </Button>
                      <Button size="sm" variant="destructive" className="h-6 text-[10px] gap-1" onClick={() => handleBlock(a)}>
                        <Ban className="h-3 w-3" /> Bloquear
                      </Button>
                    </div>
                  </div>
                ))}
                {/* Resolved alerts */}
                {resolvedAlerts.length > 0 && (
                  <div className="px-4 py-2 bg-muted/10">
                    <span className="text-[10px] font-medium text-muted-foreground">Resolvidos ({resolvedAlerts.length})</span>
                  </div>
                )}
                {resolvedAlerts.map(a => (
                  <div key={a.id} className="px-4 py-2 opacity-60 hover:opacity-80 transition-opacity">
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                      <span className="text-muted-foreground">{a.title}</span>
                      <Badge variant="outline" className="text-[8px] h-4">{a.alert_type}</Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {a.resolution_note && <p className="text-[9px] text-muted-foreground ml-5 mt-0.5">{a.resolution_note}</p>}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={() => setResolveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Resolver Alerta</DialogTitle>
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
