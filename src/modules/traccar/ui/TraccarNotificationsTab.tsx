/**
 * TraccarNotificationsTab — View and manage Traccar notification configs
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Bell, Loader2, RefreshCw, Mail, Smartphone, Globe, MessageSquare } from 'lucide-react';

interface TraccarNotification {
  id: number;
  type: string;
  always: boolean;
  web: boolean;
  mail: boolean;
  sms: boolean;
  calendarId: number;
  attributes: Record<string, unknown>;
  notificators: string;
}

const TYPE_LABELS: Record<string, string> = {
  commandResult: 'Resultado de Comando',
  deviceOnline: 'Dispositivo Online',
  deviceUnknown: 'Status Desconhecido',
  deviceOffline: 'Dispositivo Offline',
  deviceInactive: 'Dispositivo Inativo',
  deviceMoving: 'Em Movimento',
  deviceStopped: 'Parado',
  deviceOverspeed: 'Excesso de Velocidade',
  deviceFuelDrop: 'Queda de Combustível',
  deviceFuelIncrease: 'Abastecimento',
  geofenceEnter: 'Entrada em Geocerca',
  geofenceExit: 'Saída de Geocerca',
  alarm: 'Alarme',
  ignitionOn: 'Ignição Ligada',
  ignitionOff: 'Ignição Desligada',
  maintenance: 'Manutenção Necessária',
  driverChanged: 'Motorista Alterado',
  media: 'Mídia Recebida',
};

interface Props {
  tenantId: string | null;
  connectionStatus: 'unknown' | 'connected' | 'error';
}

export default function TraccarNotificationsTab({ tenantId, connectionStatus }: Props) {
  const [notifications, setNotifications] = useState<TraccarNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!tenantId || connectionStatus !== 'connected') return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('traccar-proxy', {
        body: { action: 'notifications', tenantId },
      });
      if (error) throw error;
      if (data?.success && Array.isArray(data.data)) {
        setNotifications(data.data);
        toast.success(`${data.data.length} notificação(ões) configurada(s)`);
      } else {
        toast.error(data?.error || 'Falha ao buscar notificações');
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [tenantId, connectionStatus]);

  const getChannels = (n: TraccarNotification) => {
    const channels: { icon: any; label: string }[] = [];
    if (n.web) channels.push({ icon: Globe, label: 'Web' });
    if (n.mail) channels.push({ icon: Mail, label: 'Email' });
    if (n.sms) channels.push({ icon: Smartphone, label: 'SMS' });
    const notificators = n.notificators?.split(',').filter(Boolean) || [];
    for (const notif of notificators) {
      if (notif === 'web' || notif === 'mail' || notif === 'sms') continue;
      channels.push({ icon: MessageSquare, label: notif });
    }
    return channels;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Bell className="h-5 w-5" /> Notificações Configuradas no Traccar
        </CardTitle>
        <CardDescription>
          Regras de notificação ativas no servidor Traccar. Configure via painel do Traccar para adicionar canais (email, SMS, web).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={fetchNotifications} disabled={loading || connectionStatus !== 'connected'} className="gap-1.5 text-xs">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Carregar Notificações
        </Button>

        {connectionStatus !== 'connected' ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Conecte-se ao Traccar primeiro.
          </p>
        ) : notifications.length === 0 && !loading ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">
              Nenhuma notificação configurada ou clique no botão acima para carregar.
            </p>
            <p className="text-xs text-muted-foreground">
              As notificações são gerenciadas diretamente no painel do Traccar em Configurações → Notificações.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo de Evento</TableHead>
                  <TableHead className="text-xs">Canais</TableHead>
                  <TableHead className="text-xs">Todos Dispositivos</TableHead>
                  <TableHead className="text-xs">Atributos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((n) => {
                  const channels = getChannels(n);
                  return (
                    <TableRow key={n.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[n.type] || n.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {channels.map((ch, i) => {
                            const Icon = ch.icon;
                            return (
                              <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                                <Icon className="h-3 w-3" />
                                {ch.label}
                              </Badge>
                            );
                          })}
                          {channels.length === 0 && (
                            <span className="text-xs text-muted-foreground">Nenhum canal</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={n.always ? 'default' : 'outline'} className="text-xs">
                          {n.always ? 'Sim' : 'Não'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {Object.keys(n.attributes || {}).length > 0
                          ? Object.entries(n.attributes).map(([k, v]) => `${k}=${v}`).join(', ')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Documentation reference */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Tipos de Evento Suportados pelo Traccar:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <span key={key}>• {label}</span>
            ))}
          </div>
          <p className="mt-2">
            <strong>Alarmes:</strong> SOS/Pânico, Vibração, Excesso de Velocidade, Energia Baixa, Bateria Fraca, 
            Violação, Remoção, Corte de Energia, Acidente, Frenagem Brusca, Aceleração Brusca, Curva Brusca, Fadiga, entre outros.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
