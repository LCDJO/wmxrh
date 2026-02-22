/**
 * TelegramIntegration — Configurações > Integrações > Telegram
 * Multi-tenant Telegram bot configuration, test send, and queue status.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Bot, Wifi, WifiOff, Send, RefreshCw, Trash2, CheckCircle2,
  XCircle, Clock, AlertTriangle, Copy, ExternalLink, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BotConfig {
  id: string;
  tenant_id: string;
  bot_username: string | null;
  is_active: boolean;
  connection_status: string;
  last_verified_at: string | null;
  error_message: string | null;
  webhook_secret: string | null;
  created_at: string;
}

interface QueueMessage {
  id: string;
  chat_id: string;
  message_text: string;
  status: string;
  attempts: number;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

interface WebhookLog {
  id: string;
  chat_id: string;
  from_username: string;
  command: string | null;
  message_text: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  connected: { label: 'Conectado', color: 'text-emerald-500', icon: CheckCircle2 },
  disconnected: { label: 'Desconectado', color: 'text-muted-foreground', icon: WifiOff },
  error: { label: 'Erro', color: 'text-destructive', icon: XCircle },
};

const QUEUE_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  processing: { label: 'Processando', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
};

export default function TelegramIntegration() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  const [config, setConfig] = useState<BotConfig | null>(null);
  const [queue, setQueue] = useState<QueueMessage[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [botToken, setBotToken] = useState('');
  const [testChatId, setTestChatId] = useState('');
  const [testMessage, setTestMessage] = useState('');

  // Action states
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const [configRes, queueRes, logsRes] = await Promise.all([
      supabase.from('telegram_bot_configs').select('*').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('telegram_message_queue').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
      supabase.from('telegram_webhook_logs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
    ]);

    if (configRes.data) setConfig(configRes.data as unknown as BotConfig);
    if (queueRes.data) setQueue(queueRes.data as unknown as QueueMessage[]);
    if (logsRes.data) setWebhookLogs(logsRes.data as unknown as WebhookLog[]);

    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConnect = async () => {
    if (!botToken.trim() || !tenantId) return;
    setConnecting(true);

    try {
      const { data, error } = await supabase.functions.invoke('telegram-send', {
        body: { action: 'test_connection', tenant_id: tenantId, bot_token: botToken.trim() },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || 'Erro ao conectar bot');
        return;
      }

      toast.success(`Bot @${data.bot.username} conectado com sucesso!`);
      setBotToken('');
      fetchData();
    } catch (err) {
      toast.error('Erro de comunicação');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!tenantId) return;
    setDisconnecting(true);

    try {
      await supabase.functions.invoke('telegram-send', {
        body: { action: 'disconnect', tenant_id: tenantId },
      });
      toast.success('Bot desconectado');
      setConfig(null);
      fetchData();
    } catch {
      toast.error('Erro ao desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTestSend = async () => {
    if (!testChatId.trim() || !tenantId) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('telegram-send', {
        body: {
          action: 'test_send',
          tenant_id: tenantId,
          chat_id: testChatId.trim(),
          message: testMessage.trim() || undefined,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'Erro ao enviar mensagem');
        return;
      }

      toast.success('Mensagem enviada com sucesso!');
    } catch {
      toast.error('Erro de comunicação');
    } finally {
      setSending(false);
    }
  };

  const handleProcessQueue = async () => {
    if (!tenantId) return;
    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('telegram-send', {
        body: { action: 'process_queue', tenant_id: tenantId },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'Erro ao processar fila');
        return;
      }

      toast.success(`Processados: ${data.processed} | Falhas: ${data.failed}`);
      fetchData();
    } catch {
      toast.error('Erro de comunicação');
    } finally {
      setProcessing(false);
    }
  };

  const webhookUrl = tenantId
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook?tenant_id=${tenantId}&secret=${config?.webhook_secret || ''}`
    : '';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const isConnected = config?.connection_status === 'connected' && config?.is_active;
  const statusInfo = STATUS_CONFIG[config?.connection_status || 'disconnected'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Integração Telegram
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure o bot do Telegram para notificações e comandos
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={fetchData} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Connection Card ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Wifi className="h-5 w-5" />
              Conexão do Bot
            </CardTitle>
            <CardDescription>
              Cole o token do BotFather para conectar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <statusInfo.icon className={cn("h-4 w-4", statusInfo.color)} />
                <span className={cn("text-sm font-medium", statusInfo.color)}>
                  {statusInfo.label}
                </span>
              </div>
              {config?.bot_username && (
                <Badge variant="outline" className="text-xs">
                  @{config.bot_username}
                </Badge>
              )}
            </div>

            {config?.last_verified_at && (
              <p className="text-xs text-muted-foreground">
                Última verificação: {new Date(config.last_verified_at).toLocaleString('pt-BR')}
              </p>
            )}

            {config?.error_message && (
              <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
                {config.error_message}
              </div>
            )}

            <Separator />

            {!isConnected ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bot-token" className="text-xs">Token do Bot</Label>
                  <Input
                    id="bot-token"
                    type="password"
                    placeholder="123456:ABC-DEF..."
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Obtenha no <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                      @BotFather <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
                <Button
                  onClick={handleConnect}
                  disabled={!botToken.trim() || connecting}
                  className="w-full gap-1.5"
                >
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                  Conectar Bot
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="w-full gap-1.5"
                >
                  {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Desconectar Bot
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Test Send Card ── */}
        <Card className={cn(!isConnected && "opacity-50 pointer-events-none")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Send className="h-5 w-5" />
              Teste de Envio
            </CardTitle>
            <CardDescription>
              Envie uma mensagem de teste para verificar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="chat-id" className="text-xs">Chat ID</Label>
              <Input
                id="chat-id"
                placeholder="Ex: 123456789"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Envie <code className="bg-muted px-1 rounded">/start</code> ao bot para obter o Chat ID
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="test-msg" className="text-xs">Mensagem (opcional)</Label>
              <Input
                id="test-msg"
                placeholder="Mensagem de teste..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="text-xs"
              />
            </div>
            <Button
              onClick={handleTestSend}
              disabled={!testChatId.trim() || sending}
              className="w-full gap-1.5"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Teste
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Webhook URL ── */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground text-sm">
              <ExternalLink className="h-4 w-4" />
              Webhook URL
            </CardTitle>
            <CardDescription>
              Configure no BotFather com <code className="bg-muted px-1 rounded text-xs">/setwebhook</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs flex-1"
              />
              <Button size="icon" variant="outline" onClick={() => copyToClipboard(webhookUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Message Queue ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Clock className="h-5 w-5" />
                Fila de Mensagens
              </CardTitle>
              <CardDescription>Últimas 20 mensagens na fila</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleProcessQueue}
              disabled={processing || !isConnected}
              className="gap-1.5"
            >
              {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Processar Fila
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem na fila</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Chat ID</TableHead>
                    <TableHead className="text-xs">Mensagem</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Tentativas</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((msg) => {
                    const qs = QUEUE_STATUS[msg.status] || QUEUE_STATUS.pending;
                    return (
                      <TableRow key={msg.id}>
                        <TableCell className="font-mono text-xs">{msg.chat_id}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{msg.message_text}</TableCell>
                        <TableCell>
                          <Badge variant={qs.variant} className="text-xs">{qs.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{msg.attempts}</TableCell>
                        <TableCell className="text-xs">{new Date(msg.created_at).toLocaleString('pt-BR')}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Webhook Logs ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <AlertTriangle className="h-5 w-5" />
            Logs de Webhook
          </CardTitle>
          <CardDescription>Últimos 20 comandos recebidos</CardDescription>
        </CardHeader>
        <CardContent>
          {webhookLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum log registrado</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Usuário</TableHead>
                    <TableHead className="text-xs">Comando</TableHead>
                    <TableHead className="text-xs">Mensagem</TableHead>
                    <TableHead className="text-xs">Chat ID</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{log.from_username}</TableCell>
                      <TableCell>
                        {log.command ? (
                          <Badge variant="outline" className="text-xs font-mono">{log.command}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{log.message_text}</TableCell>
                      <TableCell className="font-mono text-xs">{log.chat_id}</TableCell>
                      <TableCell className="text-xs">{new Date(log.created_at).toLocaleString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
