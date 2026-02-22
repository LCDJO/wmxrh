/**
 * MetaAdsConnectCard — Card para configurar conexão com Meta Ads.
 * SuperAdmin/Marketing configura access_token, ad_account_id, pixel_id.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link2, CheckCircle2, ExternalLink, Eye, EyeOff, Unplug } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetaConnection {
  id: string;
  ad_account_id: string;
  pixel_id: string | null;
  page_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface MetaAdsConnectCardProps {
  tenantId: string;
  canEdit: boolean;
}

export function MetaAdsConnectCard({ tenantId, canEdit }: MetaAdsConnectCardProps) {
  const { toast } = useToast();
  const [connection, setConnection] = useState<MetaConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [form, setForm] = useState({
    access_token: '',
    ad_account_id: '',
    pixel_id: '',
    page_id: '',
  });

  const fetchConnection = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('meta-ads-engine', {
        body: { action: 'get_connection', tenant_id: tenantId },
      });
      setConnection(data?.connection || null);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    if (tenantId) fetchConnection();
  }, [tenantId]);

  const handleSave = async () => {
    if (!form.access_token || !form.ad_account_id) {
      toast({ title: 'Campos obrigatórios', description: 'Access Token e Ad Account ID são obrigatórios.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-ads-engine', {
        body: {
          action: 'save_connection',
          tenant_id: tenantId,
          access_token: form.access_token,
          ad_account_id: form.ad_account_id,
          pixel_id: form.pixel_id || undefined,
          page_id: form.page_id || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Meta Ads conectado!', description: `Usuário: ${data.meta_user}` });
      setOpen(false);
      setForm({ access_token: '', ad_account_id: '', pixel_id: '', page_id: '' });
      fetchConnection();
    } catch (err: unknown) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    const { error } = await (supabase.from('meta_ads_connections') as any)
      .update({ is_active: false })
      .eq('id', connection.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Desconectado', description: 'Meta Ads desconectado.' });
      setConnection(null);
    }
  };

  const isConnected = !!connection?.is_active;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center',
              isConnected ? 'bg-primary/10' : 'bg-muted/50'
            )}>
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary" fill="currentColor">
                <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0022 12.06C22 6.53 17.5 2.04 12 2.04Z" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-base">Meta Ads</CardTitle>
              <CardDescription className="text-xs">
                {isConnected ? `Conta: ${connection.ad_account_id}` : 'Conecte para promover landing pages'}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn('text-[10px] gap-1',
              isConnected
                ? 'border-emerald-500/30 text-emerald-400'
                : 'border-muted-foreground/30 text-muted-foreground'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', isConnected ? 'bg-emerald-500' : 'bg-muted-foreground')} />
            {isConnected ? 'Conectado' : 'Desconectado'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex gap-2">
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant={isConnected ? 'outline' : 'default'} className="gap-1.5 text-xs">
                <Link2 className="h-3.5 w-3.5" />
                {isConnected ? 'Reconfigurar' : 'Conectar Meta Ads'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Conectar Meta Ads</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Como obter as credenciais:</p>
                  <p>1. Acesse <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">Graph API Explorer <ExternalLink className="h-2.5 w-2.5" /></a></p>
                  <p>2. Gere um token com permissões: <code className="text-[10px] bg-muted px-1 rounded">ads_management, ads_read</code></p>
                  <p>3. Copie o Ad Account ID do <a href="https://business.facebook.com/settings/ad-accounts" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">Business Manager <ExternalLink className="h-2.5 w-2.5" /></a></p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Access Token *</Label>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      placeholder="EAAxxxxxxxx..."
                      value={form.access_token}
                      onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowToken(v => !v)}
                    >
                      {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Ad Account ID *</Label>
                  <Input
                    placeholder="act_123456789 ou 123456789"
                    value={form.ad_account_id}
                    onChange={e => setForm(f => ({ ...f, ad_account_id: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Pixel ID</Label>
                    <Input
                      placeholder="Opcional"
                      value={form.pixel_id}
                      onChange={e => setForm(f => ({ ...f, pixel_id: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Page ID</Label>
                    <Input
                      placeholder="Opcional"
                      value={form.page_id}
                      onChange={e => setForm(f => ({ ...f, page_id: e.target.value }))}
                    />
                  </div>
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Conectar e Validar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {isConnected && canEdit && (
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-destructive" onClick={handleDisconnect}>
            <Unplug className="h-3.5 w-3.5" />
            Desconectar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
