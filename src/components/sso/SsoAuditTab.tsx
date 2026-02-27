/**
 * SsoAuditTab — Federation audit log viewer for the tenant.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollText, LogIn, LogOut, AlertTriangle, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';

const eventIcons: Record<string, React.ReactNode> = {
  saml_response_validated: <ShieldCheck className="h-4 w-4 text-primary" />,
  oidc_token_issued: <KeyRound className="h-4 w-4 text-primary" />,
  user_federated_login: <LogIn className="h-4 w-4 text-primary" />,
  session_created: <UserPlus className="h-4 w-4 text-accent-foreground" />,
  session_revoked: <LogOut className="h-4 w-4 text-destructive" />,
  session_expired: <LogOut className="h-4 w-4 text-muted-foreground" />,
  error: <AlertTriangle className="h-4 w-4 text-destructive" />,
  validation_failed: <AlertTriangle className="h-4 w-4 text-destructive" />,
};

const eventLabels: Record<string, string> = {
  saml_response_validated: 'SAML Validado',
  oidc_token_issued: 'Token OIDC Emitido',
  user_federated_login: 'Login Federado',
  session_created: 'Sessão Criada',
  session_revoked: 'Sessão Revogada',
  session_expired: 'Sessão Expirada',
  error: 'Erro',
  validation_failed: 'Validação Falhou',
};

export function SsoAuditTab() {
  const { currentTenant } = useTenant();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['sso-audit', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('federation_audit_logs')
        .select('*, identity_provider_configs(name)')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentTenant?.id,
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Log de Auditoria SSO</h3>
        <p className="text-sm text-muted-foreground">Últimos 200 eventos de federação.</p>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">Nenhum evento de auditoria registrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>{eventIcons[log.event_type] ?? <ScrollText className="h-4 w-4 text-muted-foreground" />}</TableCell>
                    <TableCell className="font-medium text-sm">
                      {eventLabels[log.event_type] ?? log.event_type}
                    </TableCell>
                    <TableCell className="text-sm">{log.identity_provider_configs?.name ?? '—'}</TableCell>
                    <TableCell>
                      {log.protocol ? <Badge variant="outline" className="uppercase text-xs">{log.protocol}</Badge> : '—'}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{log.ip_address ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
