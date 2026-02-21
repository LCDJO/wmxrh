/**
 * PlatformSaasSettings — /platform/settings/saas
 * Parametrizações gerais do SaaS
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, Loader2, RotateCcw, Globe } from 'lucide-react';

interface PlatformSetting {
  id: string;
  key: string;
  value: any;
  label: string;
  description: string | null;
  category: string;
}

interface WhiteLabelConfig {
  id: string;
  domain_principal: string;
  cloudflare_zone_id: string;
  cloudflare_api_token: string;
  is_active: boolean | null;
  tenant_id: string | null;
}

export default function PlatformSaasSettings() {
  const { can } = usePlatformPermissions();
  const { toast } = useToast();
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // White Label state
  const [wlConfig, setWlConfig] = useState<WhiteLabelConfig | null>(null);
  const [wlForm, setWlForm] = useState({ domain_principal: '', cloudflare_zone_id: '', cloudflare_api_token: '' });
  const [wlSaving, setWlSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('platform_settings').select('*').order('category').order('key');
    if (data) {
      setSettings(data as PlatformSetting[]);
      const vals: Record<string, string> = {};
      data.forEach((s: any) => {
        vals[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
      });
      setEditValues(vals);
    }
    setLoading(false);
  }, []);

  const fetchWhiteLabel = useCallback(async () => {
    const { data } = await supabase.from('white_label_config').select('*').limit(1).maybeSingle();
    if (data) {
      setWlConfig(data as WhiteLabelConfig);
      setWlForm({
        domain_principal: data.domain_principal || '',
        cloudflare_zone_id: data.cloudflare_zone_id || '',
        cloudflare_api_token: data.cloudflare_api_token || '',
      });
    }
  }, []);

  useEffect(() => { fetchSettings(); fetchWhiteLabel(); }, [fetchSettings, fetchWhiteLabel]);

  const handleSaveWhiteLabel = async () => {
    setWlSaving(true);
    if (wlConfig) {
      const { error } = await supabase.from('white_label_config').update({
        domain_principal: wlForm.domain_principal,
        cloudflare_zone_id: wlForm.cloudflare_zone_id,
        cloudflare_api_token: wlForm.cloudflare_api_token,
      }).eq('id', wlConfig.id);
      if (error) {
        toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'White Label salvo', description: 'Configurações Cloudflare atualizadas.' });
        fetchWhiteLabel();
      }
    } else {
      const { error } = await supabase.from('white_label_config').insert({
        domain_principal: wlForm.domain_principal,
        cloudflare_zone_id: wlForm.cloudflare_zone_id,
        cloudflare_api_token: wlForm.cloudflare_api_token,
        is_active: true,
      });
      if (error) {
        toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'White Label criado', description: 'Configurações Cloudflare salvas.' });
        fetchWhiteLabel();
      }
    }
    setWlSaving(false);
  };

  const wlHasChanged = wlConfig
    ? wlForm.domain_principal !== wlConfig.domain_principal ||
      wlForm.cloudflare_zone_id !== wlConfig.cloudflare_zone_id ||
      wlForm.cloudflare_api_token !== wlConfig.cloudflare_api_token
    : wlForm.domain_principal !== '' || wlForm.cloudflare_zone_id !== '' || wlForm.cloudflare_api_token !== '';

  const handleSave = async (setting: PlatformSetting) => {
    setSaving(setting.key);
    const rawValue = editValues[setting.key];
    let parsedValue: any;
    try {
      parsedValue = JSON.parse(rawValue);
    } catch {
      parsedValue = rawValue;
    }
    const { error } = await supabase
      .from('platform_settings')
      .update({ value: parsedValue })
      .eq('id', setting.id);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Configuração salva', description: `${setting.label} atualizado com sucesso.` });
      fetchSettings();
    }
    setSaving(null);
  };

  const handleReset = (setting: PlatformSetting) => {
    setEditValues(prev => ({
      ...prev,
      [setting.key]: typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value),
    }));
  };

  const grouped = settings.reduce<Record<string, PlatformSetting[]>>((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});

  const categoryLabels: Record<string, string> = {
    tenants: 'Tenants',
    general: 'Geral',
    billing: 'Faturamento',
    support: 'Suporte',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Parametrizações do SaaS</h1>
          <p className="text-sm text-muted-foreground">Configurações globais da plataforma</p>
        </div>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{categoryLabels[category] || category}</CardTitle>
            <CardDescription>Configurações da categoria {categoryLabels[category] || category}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {items.map(setting => {
              const hasChanged = editValues[setting.key] !== (typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value));
              return (
                <div key={setting.id} className="flex flex-col sm:flex-row sm:items-end gap-4 p-4 rounded-lg border bg-card">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="font-medium">{setting.label}</Label>
                      <Badge variant="outline" className="text-[10px] h-5">{setting.key}</Badge>
                    </div>
                    {setting.description && (
                      <p className="text-xs text-muted-foreground">{setting.description}</p>
                    )}
                    <Input
                      value={editValues[setting.key] || ''}
                      onChange={e => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                      disabled={!can('tenant.create')}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    {hasChanged && (
                      <Button variant="ghost" size="sm" onClick={() => handleReset(setting)}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleSave(setting)}
                      disabled={!hasChanged || saving === setting.key || !can('tenant.create')}
                    >
                      {saving === setting.key ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* White Label / Cloudflare */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">White Label — Cloudflare</CardTitle>
          </div>
          <CardDescription>Configurações de domínio e DNS via Cloudflare para deploy de landing pages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'domain_principal', label: 'Domínio Principal', placeholder: 'minha-plataforma.com', description: 'Domínio raiz usado para subdomínios de landing pages' },
            { key: 'cloudflare_zone_id', label: 'Zone ID (Cloudflare)', placeholder: 'abcdef1234567890...', description: 'ID da zona no painel do Cloudflare' },
            { key: 'cloudflare_api_token', label: 'API Token (Cloudflare)', placeholder: '••••••••••••••••', description: 'Token de API com permissão de edição DNS', type: 'password' },
          ].map(field => (
            <div key={field.key} className="p-4 rounded-lg border bg-card space-y-2">
              <Label className="font-medium">{field.label}</Label>
              <p className="text-xs text-muted-foreground">{field.description}</p>
              <Input
                type={(field as any).type || 'text'}
                value={wlForm[field.key as keyof typeof wlForm]}
                onChange={e => setWlForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                disabled={!can('tenant.create')}
                className="max-w-md"
              />
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveWhiteLabel}
              disabled={!wlHasChanged || wlSaving || !can('tenant.create')}
            >
              {wlSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {wlConfig ? 'Salvar White Label' : 'Criar White Label'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {settings.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma configuração encontrada.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
