/**
 * TraccarConnectCard — Platform-level Traccar Integration config card
 * Displayed on /platform/settings/saas
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MapPin,
  Save,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Unlink,
  RotateCcw,
} from 'lucide-react';

interface TraccarConfig {
  id: string;
  api_url: string;
  api_token_encrypted: string;
  webhook_secret_encrypted: string | null;
  protocol: string;
  auto_sync_devices: boolean;
  sync_interval_minutes: number;
  is_active: boolean;
  last_sync_at: string | null;
}

interface TraccarConnectCardProps {
  canEdit: boolean;
}

const PROTOCOLS = [
  { value: 'osmand', label: 'OsmAnd' },
  { value: 'teltonika', label: 'Teltonika' },
  { value: 'gt06', label: 'GT06' },
  { value: 'h02', label: 'H02' },
  { value: 'tk103', label: 'TK103' },
  { value: 'meitrack', label: 'Meitrack' },
  { value: 'suntech', label: 'Suntech' },
  { value: 'other', label: 'Outro' },
];

export default function TraccarConnectCard({ canEdit }: TraccarConnectCardProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<TraccarConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const [form, setForm] = useState({
    api_url: '',
    api_token: '',
    webhook_secret: '',
    protocol: 'osmand',
    auto_sync_devices: true,
    sync_interval_minutes: 5,
    is_active: true,
  });

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('key', 'traccar_config')
      .maybeSingle();

    if (data?.value && typeof data.value === 'object') {
      const val = data.value as Record<string, any>;
      setConfig({
        id: data.id,
        api_url: val.api_url || '',
        api_token_encrypted: val.api_token || '',
        webhook_secret_encrypted: val.webhook_secret || null,
        protocol: val.protocol || 'osmand',
        auto_sync_devices: val.auto_sync_devices ?? true,
        sync_interval_minutes: val.sync_interval_minutes ?? 5,
        is_active: val.is_active ?? true,
        last_sync_at: val.last_sync_at || null,
      });
      setForm({
        api_url: val.api_url || '',
        api_token: val.api_token || '',
        webhook_secret: val.webhook_secret || '',
        protocol: val.protocol || 'osmand',
        auto_sync_devices: val.auto_sync_devices ?? true,
        sync_interval_minutes: val.sync_interval_minutes ?? 5,
        is_active: val.is_active ?? true,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const isConnected = !!config && !!config.api_url && config.is_active;

  const handleSave = async () => {
    if (!form.api_url) {
      toast({ title: 'URL obrigatória', description: 'Informe a URL do servidor Traccar.', variant: 'destructive' });
      return;
    }
    setSaving(true);

    const value = {
      api_url: form.api_url,
      api_token: form.api_token,
      webhook_secret: form.webhook_secret,
      protocol: form.protocol,
      auto_sync_devices: form.auto_sync_devices,
      sync_interval_minutes: form.sync_interval_minutes,
      is_active: form.is_active,
    };

    if (config) {
      const { error } = await supabase
        .from('platform_settings')
        .update({ value })
        .eq('id', config.id);
      if (error) {
        toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Traccar atualizado', description: 'Configurações do Traccar salvas com sucesso.' });
        fetchConfig();
      }
    } else {
      const { error } = await supabase
        .from('platform_settings')
        .insert({
          key: 'traccar_config',
          value,
          label: 'Traccar Integration',
          description: 'Configuração global do servidor Traccar para ingestão de eventos GPS',
          category: 'integrations',
        });
      if (error) {
        toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Traccar configurado', description: 'Integração Traccar criada com sucesso.' });
        fetchConfig();
      }
    }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from('platform_settings')
      .update({ value: { ...form, is_active: false, api_token: '', webhook_secret: '' } })
      .eq('id', config.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Desconectado', description: 'Integração Traccar desativada.' });
      fetchConfig();
    }
    setSaving(false);
  };

  const maskToken = (token: string) => {
    if (!token || token.length < 8) return '••••••••';
    return token.slice(0, 4) + '••••••••' + token.slice(-4);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Traccar GPS Integration</CardTitle>
              <CardDescription>Integração com servidor Traccar para rastreamento GPS e compliance de frota</CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? 'default' : 'outline'} className={isConnected ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : ''}>
            {isConnected ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</>
            ) : (
              '● Desconectado'
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* API URL */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">URL do Servidor Traccar</Label>
          <Input
            value={form.api_url}
            onChange={e => setForm(f => ({ ...f, api_url: e.target.value }))}
            placeholder="https://traccar.suaempresa.com"
            disabled={!canEdit}
          />
        </div>

        {/* API Token */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">API Token</Label>
          <div className="relative">
            <Input
              type={showToken ? 'text' : 'password'}
              value={form.api_token}
              onChange={e => setForm(f => ({ ...f, api_token: e.target.value }))}
              placeholder="Token de acesso à API do Traccar"
              disabled={!canEdit}
              className="pr-10 font-mono text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Webhook Secret */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Webhook Secret <span className="text-muted-foreground text-xs">(opcional)</span></Label>
          <div className="relative">
            <Input
              type={showWebhookSecret ? 'text' : 'password'}
              value={form.webhook_secret}
              onChange={e => setForm(f => ({ ...f, webhook_secret: e.target.value }))}
              placeholder="Secret para validação de webhooks"
              disabled={!canEdit}
              className="pr-10 font-mono text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setShowWebhookSecret(!showWebhookSecret)}
            >
              {showWebhookSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Protocol & Sync Config */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Protocolo</Label>
            <Select
              value={form.protocol}
              onValueChange={v => setForm(f => ({ ...f, protocol: v }))}
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROTOCOLS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Intervalo de Sync (min)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={form.sync_interval_minutes}
              onChange={e => setForm(f => ({ ...f, sync_interval_minutes: parseInt(e.target.value) || 5 }))}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Auto-sync dispositivos</Label>
            <div className="pt-1">
              <Switch
                checked={form.auto_sync_devices}
                onCheckedChange={v => setForm(f => ({ ...f, auto_sync_devices: v }))}
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div>
            <p className="text-sm font-medium">Integração Ativa</p>
            <p className="text-xs text-muted-foreground">Habilita o recebimento de eventos GPS do Traccar</p>
          </div>
          <Switch
            checked={form.is_active}
            onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
            disabled={!canEdit}
          />
        </div>

        {/* Last sync info */}
        {config?.last_sync_at && (
          <p className="text-xs text-muted-foreground">
            Último sync: {new Date(config.last_sync_at).toLocaleString('pt-BR')}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving || !canEdit} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Configuração
          </Button>
          {isConnected && (
            <Button variant="outline" onClick={handleDisconnect} disabled={saving || !canEdit} className="gap-2 text-destructive hover:text-destructive">
              <Unlink className="h-4 w-4" />
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
