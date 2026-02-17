/**
 * IdentityActivityFeed — Real-time feed of identity events & stats.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users, Eye, AlertTriangle, Clock, UserCheck, Shield, KeyRound,
} from 'lucide-react';
import type { IdentityControlSummary } from '@/domains/control-plane/types';

const eventIcons: Record<string, React.ReactNode> = {
  identity_change: <UserCheck className="h-3 w-3 text-primary" />,
  impersonation_change: <Eye className="h-3 w-3 text-amber-500" />,
  auth_change: <KeyRound className="h-3 w-3 text-emerald-500" />,
};

interface IdentityActivityFeedProps {
  identity: IdentityControlSummary | null;
}

export function IdentityActivityFeed({ identity }: IdentityActivityFeedProps) {
  if (!identity) return null;

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Atividade de Identidade
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {identity.active_impersonations > 0 && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Eye className="h-2.5 w-2.5" /> {identity.active_impersonations}
            </Badge>
          )}
          {identity.high_risk_users > 0 && (
            <Badge variant="destructive" className="text-[10px] gap-1">
              <AlertTriangle className="h-2.5 w-2.5" /> {identity.high_risk_users}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg font-bold text-foreground">{identity.total_active_users_estimate}</div>
            <div className="text-[10px] text-muted-foreground">Usuários</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className={`text-lg font-bold ${identity.active_impersonations > 0 ? 'text-amber-500' : 'text-foreground'}`}>
              {identity.active_impersonations}
            </div>
            <div className="text-[10px] text-muted-foreground">Impersonações</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className={`text-lg font-bold ${identity.high_risk_users > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {identity.high_risk_users}
            </div>
            <div className="text-[10px] text-muted-foreground">Alto Risco</div>
          </div>
        </div>

        {/* Event feed */}
        <div className="text-xs font-medium text-muted-foreground mb-1.5">Eventos Recentes</div>
        <ScrollArea className="h-[180px]">
          {identity.recent_identity_events.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              <Shield className="h-6 w-6 mx-auto mb-1 text-muted-foreground/40" />
              Nenhum evento registrado
            </div>
          ) : (
            <div className="space-y-1">
              {identity.recent_identity_events.slice().reverse().map((evt, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded border border-border/30 hover:bg-muted/20 transition-colors">
                  {eventIcons[evt.type] ?? <Clock className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-muted-foreground font-mono text-[10px] shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                  <Badge variant="outline" className="text-[8px] h-3.5 shrink-0">{evt.type}</Badge>
                  <span className="truncate text-muted-foreground">{evt.details}</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
