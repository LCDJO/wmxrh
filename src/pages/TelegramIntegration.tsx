/**
 * TelegramIntegration — Configurações > Integrações > Telegram
 * Multi-tenant: bot config, destinations (bindings), event templates, queue, logs.
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import {
  Bot, Wifi, WifiOff, Send, RefreshCw, Trash2, CheckCircle2,
  XCircle, Clock, AlertTriangle, Copy, ExternalLink, Loader2,
  Plus, Users, QrCode, FileText, Zap, Edit2, ToggleLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──
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

interface Binding {
  id: string;
  tenant_id: string;
  chat_id: string;
  chat_type: string;
  label: string;
  employee_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

interface Template {
  id: string;
  tenant_id: string;
  event_type: string;
  event_label: string;
  is_enabled: boolean;
  template_text: string;
  category: string;
  variables: string[];
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

// ── Constants ──
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

const CHAT_TYPE_LABELS: Record<string, string> = {
  user: 'Usuário',
  group: 'Grupo',
  channel: 'Canal',
};

const DEFAULT_EVENTS = [
  { event_type: 'employee_admitted', event_label: 'Admissão de Funcionário', category: 'hr', template_text: '🟢 <b>Nova Admissão</b>\n\nFuncionário: {{employee_name}}\nCargo: {{position}}\nData: {{date}}', variables: ['employee_name', 'position', 'date'] },
  { event_type: 'employee_terminated', event_label: 'Desligamento', category: 'hr', template_text: '🔴 <b>Desligamento</b>\n\nFuncionário: {{employee_name}}\nMotivo: {{reason}}\nData: {{date}}', variables: ['employee_name', 'reason', 'date'] },
  { event_type: 'compliance_violation', event_label: 'Violação de Compliance', category: 'compliance', template_text: '⚠️ <b>Violação Detectada</b>\n\nTipo: {{violation_type}}\nSeveridade: {{severity}}\nFuncionário: {{employee_name}}', variables: ['violation_type', 'severity', 'employee_name'] },
  { event_type: 'fleet_speeding', event_label: 'Excesso de Velocidade', category: 'fleet', template_text: '🚨 <b>Alerta de Velocidade</b>\n\nMotorista: {{driver}}\nPlaca: {{plate}}\nVelocidade: {{speed}} km/h\nLimite: {{limit}} km/h', variables: ['driver', 'plate', 'speed', 'limit'] },
  { event_type: 'safety_incident', event_label: 'Incidente de Segurança', category: 'safety', template_text: '🔶 <b>Incidente SST</b>\n\nTipo: {{incident_type}}\nLocal: {{location}}\nGravidade: {{severity}}', variables: ['incident_type', 'location', 'severity'] },
  { event_type: 'payroll_processed', event_label: 'Folha Processada', category: 'payroll', template_text: '💰 <b>Folha Processada</b>\n\nCompetência: {{period}}\nTotal: R$ {{total}}\nFuncionários: {{count}}', variables: ['period', 'total', 'count'] },
  { event_type: 'document_pending', event_label: 'Documento Pendente', category: 'hr', template_text: '📄 <b>Documento Pendente</b>\n\nFuncionário: {{employee_name}}\nDocumento: {{document_name}}\nPrazo: {{deadline}}', variables: ['employee_name', 'document_name', 'deadline'] },
  { event_type: 'fleet_maintenance', event_label: 'Manutenção de Veículo', category: 'fleet', template_text: '🔧 <b>Manutenção Agendada</b>\n\nVeículo: {{plate}}\nTipo: {{maintenance_type}}\nData: {{date}}', variables: ['plate', 'maintenance_type', 'date'] },
];

const CATEGORY_COLORS: Record<string, string> = {
  hr: 'bg-blue-500/10 text-blue-500',
  fleet: 'bg-amber-500/10 text-amber-500',
  compliance: 'bg-red-500/10 text-red-500',
  safety: 'bg-orange-500/10 text-orange-500',
  payroll: 'bg-emerald-500/10 text-emerald-500',
  general: 'bg-muted text-muted-foreground',
};

export default function TelegramIntegration() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  const [config, setConfig] = useState<BotConfig | null>(null);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [queue, setQueue] = useState<QueueMessage[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [botToken, setBotToken] = useState('');
  const [testChatId, setTestChatId] = useState(() => {
    if (tenantId) {
      return localStorage.getItem(`telegram_test_chat_id_${tenantId}`) || '';
    }
    return '';
  });
  const [testMessage, setTestMessage] = useState('');

  // Binding form
  const [newChatId, setNewChatId] = useState('');
  const [newChatType, setNewChatType] = useState('user');
  const [newLabel, setNewLabel] = useState('');
  const [addingBinding, setAddingBinding] = useState(false);

  // Template edit
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editTemplateText, setEditTemplateText] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // QR Code
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

  // Action states
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [initializingTemplates, setInitializingTemplates] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const [configRes, bindingsRes, templatesRes, queueRes, logsRes] = await Promise.all([
      supabase.from('telegram_bot_configs').select('*').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('telegram_bindings').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('telegram_templates').select('*').eq('tenant_id', tenantId).order('category', { ascending: true }),
      supabase.from('telegram_message_queue').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
      supabase.from('telegram_webhook_logs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
    ]);

    if (configRes.data) setConfig(configRes.data as unknown as BotConfig);
    if (bindingsRes.data) setBindings(bindingsRes.data as unknown as Binding[]);
    if (templatesRes.data) setTemplates(templatesRes.data as unknown as Template[]);
    if (queueRes.data) setQueue(queueRes.data as unknown as QueueMessage[]);
    if (logsRes.data) setWebhookLogs(logsRes.data as unknown as WebhookLog[]);

    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (tenantId) {
      const saved = localStorage.getItem(`telegram_test_chat_id_${tenantId}`);
      if (saved) setTestChatId(saved);
    }
  }, [tenantId]);

  // ── Bot Actions ──
  const handleConnect = async () => {
    if (!botToken.trim() || !tenantId) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-send', {
        body: { action: 'test_connection', tenant_id: tenantId, bot_token: botToken.trim() },
      });
      if (error || !data?.success) { toast.error(data?.error || error?.message || 'Erro ao conectar bot'); return; }
      toast.success(`Bot @${data.bot.username} conectado com sucesso!`);
      setBotToken('');
      fetchData();
    } catch { toast.error('Erro de comunicação'); } finally { setConnecting(false); }
  };

  const handleDisconnect = async () => {
    if (!tenantId) return;
    setDisconnecting(true);
    try {
      await supabase.functions.invoke('telegram-send', { body: { action: 'disconnect', tenant_id: tenantId } });
      toast.success('Bot desconectado');
      setConfig(null);
      fetchData();
    } catch { toast.error('Erro ao desconectar'); } finally { setDisconnecting(false); }
  };

  const handleTestSend = async () => {
    if (!testChatId.trim() || !tenantId) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-send', {
        body: { action: 'test_send', tenant_id: tenantId, chat_id: testChatId.trim(), message: testMessage.trim() || undefined },
      });
      if (error || !data?.success) { toast.error(data?.error || 'Erro ao enviar mensagem'); return; }
      toast.success('Mensagem enviada com sucesso!');
    } catch { toast.error('Erro de comunicação'); } finally { setSending(false); }
  };

  const handleProcessQueue = async () => {
    if (!tenantId) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-send', {
        body: { action: 'process_queue', tenant_id: tenantId },
      });
      if (error || !data?.success) { toast.error(data?.error || 'Erro ao processar fila'); return; }
      toast.success(`Processados: ${data.processed} | Falhas: ${data.failed}`);
      fetchData();
    } catch { toast.error('Erro de comunicação'); } finally { setProcessing(false); }
  };

  // ── Binding Actions ──
  const handleAddBinding = async () => {
    if (!newChatId.trim() || !tenantId) return;
    setAddingBinding(true);
    try {
      const { error } = await supabase.from('telegram_bindings').insert({
        tenant_id: tenantId,
        chat_id: newChatId.trim(),
        chat_type: newChatType,
        label: newLabel.trim() || `${CHAT_TYPE_LABELS[newChatType]} ${newChatId.trim()}`,
      } as any);
      if (error) { toast.error(error.message); return; }
      toast.success('Destino adicionado!');
      setNewChatId('');
      setNewLabel('');
      fetchData();
    } catch { toast.error('Erro ao adicionar destino'); } finally { setAddingBinding(false); }
  };

  const handleToggleBinding = async (id: string, active: boolean) => {
    await supabase.from('telegram_bindings').update({ is_active: active } as any).eq('id', id);
    setBindings(prev => prev.map(b => b.id === id ? { ...b, is_active: active } : b));
  };

  const handleDeleteBinding = async (id: string) => {
    await supabase.from('telegram_bindings').delete().eq('id', id);
    setBindings(prev => prev.filter(b => b.id !== id));
    toast.success('Destino removido');
  };

  // ── Template Actions ──
  const handleInitTemplates = async () => {
    if (!tenantId) return;
    setInitializingTemplates(true);
    try {
      const rows = DEFAULT_EVENTS.map(e => ({
        tenant_id: tenantId,
        event_type: e.event_type,
        event_label: e.event_label,
        template_text: e.template_text,
        category: e.category,
        variables: e.variables,
        is_enabled: true,
      }));
      const { error } = await supabase.from('telegram_templates').upsert(rows as any, { onConflict: 'tenant_id,event_type' });
      if (error) { toast.error(error.message); return; }
      toast.success('Templates inicializados!');
      fetchData();
    } catch { toast.error('Erro ao inicializar templates'); } finally { setInitializingTemplates(false); }
  };

  const handleToggleTemplate = async (id: string, enabled: boolean) => {
    await supabase.from('telegram_templates').update({ is_enabled: enabled } as any).eq('id', id);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_enabled: enabled } : t));
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setSavingTemplate(true);
    try {
      await supabase.from('telegram_templates').update({ template_text: editTemplateText } as any).eq('id', editingTemplate.id);
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, template_text: editTemplateText } : t));
      setEditingTemplate(null);
      toast.success('Template atualizado!');
    } catch { toast.error('Erro ao salvar'); } finally { setSavingTemplate(false); }
  };

  // ── Computed ──
  const webhookUrl = tenantId
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook?tenant_id=${tenantId}&secret=${config?.webhook_secret || ''}`
    : '';
  const deepLink = config?.bot_username ? `https://t.me/${config.bot_username}?start=${tenantId}` : '';
  const isConnected = config?.connection_status === 'connected' && config?.is_active;
  const statusInfo = STATUS_CONFIG[config?.connection_status || 'disconnected'];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

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
            Configure o bot, destinos, eventos e templates de notificação
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={fetchData} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <Tabs defaultValue="connection" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connection" className="gap-1.5 text-xs"><Wifi className="h-3.5 w-3.5" /> Conexão</TabsTrigger>
          <TabsTrigger value="destinations" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Destinos</TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5 text-xs"><Zap className="h-3.5 w-3.5" /> Eventos</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" /> Fila & Logs</TabsTrigger>
        </TabsList>

        {/* ═══════ TAB: Conexão ═══════ */}
        <TabsContent value="connection" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Connection Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  <Wifi className="h-5 w-5" />
                  Conexão do Bot
                </CardTitle>
                <CardDescription>Cole o token do BotFather para conectar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <statusInfo.icon className={cn("h-4 w-4", statusInfo.color)} />
                    <span className={cn("text-sm font-medium", statusInfo.color)}>{statusInfo.label}</span>
                  </div>
                  {config?.bot_username && (
                    <Badge variant="outline" className="text-xs">@{config.bot_username}</Badge>
                  )}
                </div>

                {config?.last_verified_at && (
                  <p className="text-xs text-muted-foreground">
                    Última verificação: {new Date(config.last_verified_at).toLocaleString('pt-BR')}
                  </p>
                )}
                {config?.error_message && (
                  <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">{config.error_message}</div>
                )}

                <Separator />

                {!isConnected ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="bot-token" className="text-xs">Token do Bot</Label>
                      <Input id="bot-token" type="password" placeholder="123456:ABC-DEF..." value={botToken}
                        onChange={(e) => setBotToken(e.target.value)} className="font-mono text-xs" />
                      <p className="text-xs text-muted-foreground">
                        Obtenha no{' '}
                        <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-0.5">
                          @BotFather <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    </div>
                    <Button onClick={handleConnect} disabled={!botToken.trim() || connecting} className="w-full gap-1.5">
                      {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                      Conectar Bot
                    </Button>
                  </div>
                ) : (
                  <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="w-full gap-1.5">
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Desconectar Bot
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Test Send Card */}
            <Card className={cn(!isConnected && "opacity-50 pointer-events-none")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground"><Send className="h-5 w-5" /> Teste de Envio</CardTitle>
                <CardDescription>Envie uma mensagem de teste para verificar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="chat-id" className="text-xs">Chat ID</Label>
                  <div className="flex gap-2">
                    <Input id="chat-id" placeholder="Ex: 123456789" value={testChatId}
                      onChange={(e) => setTestChatId(e.target.value)} className="font-mono text-xs flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 shrink-0"
                      disabled={!testChatId.trim()}
                      onClick={() => {
                        if (tenantId && testChatId.trim()) {
                          localStorage.setItem(`telegram_test_chat_id_${tenantId}`, testChatId.trim());
                          toast.success('Chat ID salvo!');
                        }
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Envie <code className="bg-muted px-1 rounded">/start</code> ao bot para obter o Chat ID
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="test-msg" className="text-xs">Mensagem (opcional)</Label>
                  <Input id="test-msg" placeholder="Mensagem de teste..." value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)} className="text-xs" />
                </div>
                <Button onClick={handleTestSend} disabled={!testChatId.trim() || sending} className="w-full gap-1.5">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar Teste
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Webhook URL */}
          {isConnected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground text-sm">
                  <ExternalLink className="h-4 w-4" /> Webhook URL
                </CardTitle>
                <CardDescription>
                  Configure o webhook do seu bot para receber comandos e interações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-xs flex-1" />
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(webhookUrl)}><Copy className="h-4 w-4" /></Button>
                </div>
                <div className="rounded-md border border-border bg-muted/50 p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">📋 Como configurar o Webhook</p>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li>Copie a URL acima clicando no botão de cópia</li>
                    <li>Abra o navegador e acesse o seguinte endereço, substituindo <code className="bg-muted px-1 rounded">&lt;TOKEN&gt;</code> pelo token do seu bot:</li>
                  </ol>
                  <div className="bg-background rounded border border-border p-2 mt-1">
                    <code className="text-[11px] text-foreground break-all select-all">
                      https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url=<span className="text-primary">{webhookUrl ? encodeURIComponent(webhookUrl) : '<URL_COPIADA>'}</span>
                    </code>
                  </div>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside" start={3}>
                    <li>Ao acessar, a resposta deve conter <code className="bg-muted px-1 rounded">"description": "Webhook was set"</code></li>
                    <li>Alternativamente, use o <code className="bg-muted px-1 rounded">curl</code> no terminal:</li>
                  </ol>
                  <div className="bg-background rounded border border-border p-2 mt-1">
                    <code className="text-[11px] text-foreground break-all select-all">
                      curl "https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url={webhookUrl ? encodeURIComponent(webhookUrl) : '<URL_COPIADA>'}"
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Após configurar, envie <code className="bg-muted px-1 rounded">/start</code> ao seu bot para testar a conexão e obter o Chat ID.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════ TAB: Destinos ═══════ */}
        <TabsContent value="destinations" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Destination */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground text-sm">
                  <Plus className="h-4 w-4" /> Novo Destino
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Chat ID</Label>
                  <Input placeholder="123456789" value={newChatId}
                    onChange={(e) => setNewChatId(e.target.value)} className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={newChatType} onValueChange={setNewChatType}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">👤 Usuário</SelectItem>
                      <SelectItem value="group">👥 Grupo</SelectItem>
                      <SelectItem value="channel">📢 Canal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rótulo</Label>
                  <Input placeholder="Ex: João Silva" value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)} className="text-xs" />
                </div>
                <Button onClick={handleAddBinding} disabled={!newChatId.trim() || addingBinding} className="w-full gap-1.5" size="sm">
                  {addingBinding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Adicionar
                </Button>
              </CardContent>
            </Card>

            {/* QR Code Deep Link */}
            <Card className={cn(!isConnected && "opacity-50 pointer-events-none")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground text-sm">
                  <QrCode className="h-4 w-4" /> Deep Link QR Code
                </CardTitle>
                <CardDescription className="text-xs">
                  Compartilhe para colaboradores iniciarem o bot
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {deepLink && (
                  <>
                    <div className="flex justify-center p-4 bg-white rounded-lg">
                      <QRCodeSVG value={deepLink} size={160} level="M" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input value={deepLink} readOnly className="font-mono text-xs flex-1" />
                      <Button size="icon" variant="outline" onClick={() => copyToClipboard(deepLink)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      <code className="bg-muted px-1 rounded">t.me/{config?.bot_username}?start={tenantId?.slice(0, 8)}...</code>
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Destinations List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground text-sm">
                  <Users className="h-4 w-4" /> Destinos Cadastrados
                  <Badge variant="secondary" className="ml-auto text-xs">{bindings.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bindings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum destino cadastrado</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {bindings.map((b) => (
                      <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span>{b.chat_type === 'user' ? '👤' : b.chat_type === 'group' ? '👥' : '📢'}</span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{b.label || b.chat_id}</p>
                            <p className="text-muted-foreground font-mono">{b.chat_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Switch checked={b.is_active} onCheckedChange={(v) => handleToggleBinding(b.id, v)} />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDeleteBinding(b.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════ TAB: Eventos & Templates ═══════ */}
        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <FileText className="h-5 w-5" /> Templates de Eventos
                  </CardTitle>
                  <CardDescription>Ative/desative alertas e edite os templates de mensagem</CardDescription>
                </div>
                {templates.length === 0 && (
                  <Button size="sm" onClick={handleInitTemplates} disabled={initializingTemplates} className="gap-1.5">
                    {initializingTemplates ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    Inicializar Templates
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum template configurado. Clique em "Inicializar Templates" para carregar os padrões.
                </p>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div key={t.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors",
                        t.is_enabled ? "bg-card border-border" : "bg-muted/30 border-transparent opacity-60"
                      )}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Switch checked={t.is_enabled} onCheckedChange={(v) => handleToggleTemplate(t.id, v)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{t.event_label}</p>
                            <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[t.category])}>
                              {t.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.event_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {t.variables && t.variables.length > 0 && (
                          <div className="hidden md:flex gap-1">
                            {(t.variables as unknown as string[]).slice(0, 3).map((v) => (
                              <Badge key={v} variant="secondary" className="text-xs font-mono">{`{{${v}}}`}</Badge>
                            ))}
                            {(t.variables as unknown as string[]).length > 3 && (
                              <Badge variant="secondary" className="text-xs">+{(t.variables as unknown as string[]).length - 3}</Badge>
                            )}
                          </div>
                        )}
                        <Button size="sm" variant="ghost" className="gap-1 text-xs"
                          onClick={() => { setEditingTemplate(t); setEditTemplateText(t.template_text); }}>
                          <Edit2 className="h-3 w-3" /> Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Template Edit Dialog */}
          <Dialog open={!!editingTemplate} onOpenChange={(o) => { if (!o) setEditingTemplate(null); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-sm">Editar Template: {editingTemplate?.event_label}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Template (HTML)</Label>
                  <Textarea value={editTemplateText} onChange={(e) => setEditTemplateText(e.target.value)}
                    rows={6} className="font-mono text-xs" />
                </div>
                {editingTemplate?.variables && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Variáveis disponíveis:</Label>
                    <div className="flex flex-wrap gap-1">
                      {(editingTemplate.variables as unknown as string[]).map((v) => (
                        <Badge key={v} variant="outline" className="text-xs font-mono cursor-pointer hover:bg-accent"
                          onClick={() => setEditTemplateText(prev => prev + `{{${v}}}`)}>
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-3 rounded bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                  <div className="text-xs whitespace-pre-wrap">
                    {editTemplateText.split(/\{\{(\w+)\}\}/).map((part, i) =>
                      i % 2 === 0 ? part : <code key={i} className="bg-primary/20 px-0.5 rounded">{part}</code>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)}>Cancelar</Button>
                <Button size="sm" onClick={handleSaveTemplate} disabled={savingTemplate} className="gap-1.5">
                  {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ═══════ TAB: Fila & Logs ═══════ */}
        <TabsContent value="logs" className="space-y-6">
          {/* Message Queue */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Clock className="h-5 w-5" /> Fila de Mensagens
                  </CardTitle>
                  <CardDescription>Últimas 20 mensagens na fila</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={handleProcessQueue} disabled={processing || !isConnected} className="gap-1.5">
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
                            <TableCell><Badge variant={qs.variant} className="text-xs">{qs.label}</Badge></TableCell>
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

          {/* Webhook Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <AlertTriangle className="h-5 w-5" /> Logs de Webhook
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
                            ) : <span className="text-xs text-muted-foreground">—</span>}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
