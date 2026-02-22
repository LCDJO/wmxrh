/**
 * WebhookSettings — Page for managing webhook configurations
 * including secrets, URLs, retry policies, and provider settings.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Webhook, Plus, Pencil, Trash2, Eye, EyeOff, Copy, RefreshCw, Shield } from 'lucide-react';

interface WebhookConfig {
  id: string;
  tenant_id: string;
  webhook_name: string;
  webhook_url: string | null;
  is_active: boolean;
  description: string | null;
  provider: string | null;
  headers: Record<string, string>;
  retry_count: number;
  timeout_seconds: number;
  created_at: string;
  updated_at: string;
  has_secret?: boolean; // derived flag, not from DB
}

const WEBHOOK_TEMPLATES = [
  { name: 'agreement_webhook', label: 'Webhook de Acordos/Termos', description: 'Recebe callbacks de provedores de assinatura digital (Clicksign, Autentique, ZapSign, etc.)', provider: 'signature' },
  { name: 'esocial_webhook', label: 'Webhook eSocial', description: 'Recebe retornos de processamento de eventos eSocial.', provider: 'esocial' },
  { name: 'payroll_webhook', label: 'Webhook de Folha', description: 'Recebe notificações de processamento de folha de pagamento.', provider: 'payroll' },
  { name: 'notification_webhook', label: 'Webhook de Notificações', description: 'Envia notificações para sistemas externos (Slack, Teams, etc.).', provider: 'notification' },
];

export default function WebhookSettings() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const tenantId = currentTenant?.id;

  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formProvider, setFormProvider] = useState('');
  const [formRetry, setFormRetry] = useState('3');
  const [formTimeout, setFormTimeout] = useState('30');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfigs = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('webhook_configurations')
      .select('id, tenant_id, webhook_name, webhook_url, is_active, description, provider, headers, retry_count, timeout_seconds, created_at, updated_at, secret_encrypted')
      .eq('tenant_id', tenantId)
      .order('webhook_name');
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const mapped: WebhookConfig[] = (data || []).map((d) => ({
        id: d.id,
        tenant_id: d.tenant_id,
        webhook_name: d.webhook_name,
        webhook_url: d.webhook_url ?? '',
        is_active: d.is_active,
        description: d.description ?? '',
        provider: d.provider ?? '',
        headers: (d.headers ?? {}) as Record<string, string>,
        retry_count: d.retry_count ?? 3,
        timeout_seconds: d.timeout_seconds ?? 30,
        created_at: d.created_at,
        updated_at: d.updated_at,
        has_secret: !!d.secret_encrypted,
      }));
      setConfigs(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchConfigs(); }, [tenantId]);

  const openCreate = (template?: typeof WEBHOOK_TEMPLATES[0]) => {
    setEditingId(null);
    setFormName(template?.name || '');
    setFormUrl('');
    setFormSecret('');
    setFormDescription(template?.description || '');
    setFormProvider(template?.provider || '');
    setFormRetry('3');
    setFormTimeout('30');
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEdit = (cfg: WebhookConfig) => {
    setEditingId(cfg.id);
    setFormName(cfg.webhook_name);
    setFormUrl(cfg.webhook_url || '');
    setFormSecret(''); // Secret is write-only, never displayed
    setFormDescription(cfg.description || '');
    setFormProvider(cfg.provider || '');
    setFormRetry(String(cfg.retry_count));
    setFormTimeout(String(cfg.timeout_seconds));
    setFormActive(cfg.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tenantId || !formName.trim()) return;
    setSaving(true);

    const payload = {
      tenant_id: tenantId,
      webhook_name: formName.trim(),
      webhook_url: formUrl.trim() || null,
      description: formDescription.trim() || null,
      provider: formProvider.trim() || null,
      retry_count: parseInt(formRetry) || 3,
      timeout_seconds: parseInt(formTimeout) || 30,
      is_active: formActive,
    };

    let error;
    let savedId: string | null = editingId;

    if (editingId) {
      const { tenant_id: _, ...updatePayload } = payload;
      ({ error } = await supabase.from('webhook_configurations').update(updatePayload).eq('id', editingId));
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('webhook_configurations')
        .insert(payload)
        .select('id')
        .single();
      error = insertError;
      savedId = inserted?.id || null;
    }

    // If secret was provided, encrypt it server-side via RPC
    if (!error && formSecret.trim() && savedId) {
      const { error: secretError } = await supabase.rpc('set_webhook_secret', {
        _webhook_id: savedId,
        _secret: formSecret.trim(),
      });
      if (secretError) {
        toast({ title: 'Erro ao salvar secret', description: secretError.message, variant: 'destructive' });
      }
    }

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingId ? 'Webhook atualizado!' : 'Webhook criado!' });
      setDialogOpen(false);
      fetchConfigs();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('webhook_configurations').delete().eq('id', deleteId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Webhook removido!' });
      fetchConfigs();
    }
    setDeleteId(null);
  };

  const handleToggle = async (cfg: WebhookConfig) => {
    const { error } = await supabase
      .from('webhook_configurations')
      .update({ is_active: !cfg.is_active })
      .eq('id', cfg.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      fetchConfigs();
    }
  };

  const generateSecret = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const secret = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    setFormSecret(secret);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
  };

  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskSecret = (secret: string) => {
    if (secret.length <= 8) return '•'.repeat(secret.length);
    return secret.slice(0, 4) + '•'.repeat(secret.length - 8) + secret.slice(-4);
  };

  // Find templates not yet configured
  const unconfiguredTemplates = WEBHOOK_TEMPLATES.filter(
    t => !configs.some(c => c.webhook_name === t.name)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Webhook className="h-6 w-6 text-primary" />
            Configurações de Webhooks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie secrets, URLs e parâmetros de todos os webhooks do sistema
          </p>
        </div>
        <Button onClick={() => openCreate()} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Webhook
        </Button>
      </div>

      {/* Quick setup for unconfigured templates */}
      {unconfiguredTemplates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Webhooks Disponíveis para Configurar
            </CardTitle>
            <CardDescription className="text-xs">
              Clique para configurar rapidamente
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {unconfiguredTemplates.map(t => (
                <Button key={t.name} variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => openCreate(t)}>
                  <Plus className="h-3 w-3" /> {t.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configured webhooks */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Webhook className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Nenhum webhook configurado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Use os botões acima para criar sua primeira configuração.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {configs.map(cfg => {
            const template = WEBHOOK_TEMPLATES.find(t => t.name === cfg.webhook_name);
            const isSecretVisible = visibleSecrets[cfg.id];

            return (
              <Card key={cfg.id} className={!cfg.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Webhook className="h-4 w-4 text-primary" />
                        {template?.label || cfg.webhook_name}
                        <Badge variant={cfg.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {cfg.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                        {cfg.provider && (
                          <Badge variant="outline" className="text-[10px]">{cfg.provider}</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {cfg.description || template?.description || 'Sem descrição'}
                      </CardDescription>
                    </div>
                    <Switch checked={cfg.is_active} onCheckedChange={() => handleToggle(cfg)} />
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Secret */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Secret</p>
                      {cfg.has_secret ? (
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 truncate">
                            ••••••••••••••••
                          </code>
                          <Badge variant="outline" className="text-[10px]">Encriptado</Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Não configurado</span>
                      )}
                    </div>

                    {/* URL */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">URL</p>
                      {cfg.webhook_url ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono block truncate">{cfg.webhook_url}</code>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Automático (edge function)</span>
                      )}
                    </div>

                    {/* Retry & Timeout */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Retry / Timeout</p>
                      <span className="text-xs text-card-foreground">{cfg.retry_count}x tentativas · {cfg.timeout_seconds}s timeout</span>
                    </div>

                    {/* Updated */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Última atualização</p>
                      <span className="text-xs text-card-foreground">{new Date(cfg.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => openEdit(cfg)}>
                      <Pencil className="h-3 w-3" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteId(cfg.id)}>
                      <Trash2 className="h-3 w-3" /> Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Webhook' : 'Novo Webhook'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome do Webhook *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="ex: agreement_webhook" required disabled={!!editingId} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Para que serve este webhook..." rows={2} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Secret (x-webhook-secret)</Label>
                  <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={generateSecret}>
                    <RefreshCw className="h-3 w-3" /> Gerar
                  </Button>
                </div>
                <Input value={formSecret} onChange={e => setFormSecret(e.target.value)} placeholder="Cole ou gere um secret..." />
                <p className="text-[10px] text-muted-foreground">O secret é enviado no header <code>x-webhook-secret</code> para validar a autenticidade do request.</p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>URL do Webhook (opcional)</Label>
                <Input value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="https://..." />
                <p className="text-[10px] text-muted-foreground">Deixe em branco para usar a edge function padrão.</p>
              </div>

              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={formProvider} onValueChange={setFormProvider}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="signature">Assinatura Digital</SelectItem>
                    <SelectItem value="esocial">eSocial</SelectItem>
                    <SelectItem value="payroll">Folha</SelectItem>
                    <SelectItem value="notification">Notificações</SelectItem>
                    <SelectItem value="custom">Customizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch checked={formActive} onCheckedChange={setFormActive} />
                  <span className="text-sm text-card-foreground">{formActive ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tentativas de retry</Label>
                <Input type="number" min="0" max="10" value={formRetry} onChange={e => setFormRetry(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Timeout (segundos)</Label>
                <Input type="number" min="5" max="120" value={formTimeout} onChange={e => setFormTimeout(e.target.value)} />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Webhook'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O webhook e seu secret serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
