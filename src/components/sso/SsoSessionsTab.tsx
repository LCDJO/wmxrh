/**
 * SsoSessionsTab — View and revoke active federation sessions.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users, XCircle, CheckCircle2, Clock, Ban } from 'lucide-react';

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  authenticated: { label: 'Ativa', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  pending: { label: 'Pendente', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  expired: { label: 'Expirada', variant: 'outline', icon: <XCircle className="h-3 w-3" /> },
  revoked: { label: 'Revogada', variant: 'destructive', icon: <Ban className="h-3 w-3" /> },
};

export function SsoSessionsTab() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sso-sessions', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('federation_sessions')
        .select('*, identity_provider_configs(name)')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentTenant?.id,
  });

  const revokeSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('federation_sessions')
        .update({ status: 'revoked' as any, revoked_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-sessions'] });
      toast.success('Sessão revogada');
    },
    onError: () => toast.error('Erro ao revogar sessão'),
  });

  const activeSessions = sessions.filter((s: any) => s.status === 'authenticated');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Sessões Federadas</h3>
          <p className="text-sm text-muted-foreground">
            {activeSessions.length} sessão(ões) ativa(s) de {sessions.length} total.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">Nenhuma sessão federada registrada.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provedor</TableHead>
                <TableHead>Protocolo</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s: any) => {
                const st = statusMap[s.status] ?? statusMap.pending;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.identity_provider_configs?.name ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="uppercase text-xs">{s.protocol}</Badge></TableCell>
                    <TableCell className="text-sm">{s.name_id ?? s.external_subject ?? '—'}</TableCell>
                    <TableCell><Badge variant={st.variant} className="gap-1">{st.icon} {st.label}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(s.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.expires_at ? format(new Date(s.expires_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'}
                    </TableCell>
                    <TableCell>
                      {s.status === 'authenticated' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive text-xs"
                          onClick={() => revokeSession.mutate(s.id)}
                        >
                          Revogar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
