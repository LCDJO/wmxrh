/**
 * FooterSettings — Configures which sections and links appear in the global footer.
 * Falls back to platform_footer_defaults when no tenant config exists.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { usePlatformFooterDefaults } from '@/hooks/use-footer-defaults';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Save, PanelBottom, ExternalLink, Shield, Headphones } from 'lucide-react';
interface SupportLink {
  label: string;
  href: string;
}

interface ComplianceItem {
  text: string;
}

interface FooterConfig {
  id?: string;
  tenant_id: string;
  show_institutional: boolean;
  show_compliance: boolean;
  show_support: boolean;
  show_technical: boolean;
  show_bottom_text: boolean;
  custom_bottom_text: string | null;
  support_links: SupportLink[];
  compliance_items: ComplianceItem[];
}

export default function FooterSettings() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: platformDefaults } = usePlatformFooterDefaults();

  const [config, setConfig] = useState<FooterConfig | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['footer_config', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('footer_configs')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  useEffect(() => {
    if (data) {
      setConfig({
        ...data,
        support_links: Array.isArray(data.support_links) ? data.support_links as unknown as SupportLink[] : (platformDefaults?.support_links ?? []),
        compliance_items: Array.isArray(data.compliance_items) ? data.compliance_items as unknown as ComplianceItem[] : (platformDefaults?.compliance_items ?? []),
      });
    } else if (currentTenant?.id && !isLoading && platformDefaults) {
      // No tenant config — seed from platform defaults
      setConfig({
        tenant_id: currentTenant.id,
        show_institutional: platformDefaults.show_institutional,
        show_compliance: platformDefaults.show_compliance,
        show_support: platformDefaults.show_support,
        show_technical: platformDefaults.show_technical,
        show_bottom_text: platformDefaults.show_bottom_text,
        custom_bottom_text: platformDefaults.custom_bottom_text,
        support_links: platformDefaults.support_links,
        compliance_items: platformDefaults.compliance_items,
      });
    }
  }, [data, currentTenant?.id, isLoading, platformDefaults]);

  const saveMutation = useMutation({
    mutationFn: async (cfg: FooterConfig) => {
      const payload = {
        tenant_id: cfg.tenant_id,
        show_institutional: cfg.show_institutional,
        show_compliance: cfg.show_compliance,
        show_support: cfg.show_support,
        show_technical: cfg.show_technical,
        show_bottom_text: cfg.show_bottom_text,
        custom_bottom_text: cfg.custom_bottom_text || null,
        support_links: cfg.support_links as any,
        compliance_items: cfg.compliance_items as any,
      };

      if (cfg.id) {
        const { error } = await supabase.from('footer_configs').update(payload).eq('id', cfg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('footer_configs').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Rodapé configurado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['footer_config'] });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const updateLink = (idx: number, field: keyof SupportLink, value: string) => {
    const links = [...config.support_links];
    links[idx] = { ...links[idx], [field]: value };
    setConfig({ ...config, support_links: links });
  };

  const removeLink = (idx: number) => {
    setConfig({ ...config, support_links: config.support_links.filter((_, i) => i !== idx) });
  };

  const addLink = () => {
    setConfig({ ...config, support_links: [...config.support_links, { label: '', href: '' }] });
  };

  const updateCompliance = (idx: number, value: string) => {
    const items = [...config.compliance_items];
    items[idx] = { text: value };
    setConfig({ ...config, compliance_items: items });
  };

  const removeCompliance = (idx: number) => {
    setConfig({ ...config, compliance_items: config.compliance_items.filter((_, i) => i !== idx) });
  };

  const addCompliance = () => {
    setConfig({ ...config, compliance_items: [...config.compliance_items, { text: '' }] });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-6 px-4">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <PanelBottom className="h-6 w-6 text-primary" />
          Configurações do Rodapé
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Controle quais seções e informações aparecem no rodapé da plataforma.
        </p>
      </div>

      {/* Section toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seções visíveis</CardTitle>
          <CardDescription>Ative ou desative cada bloco do rodapé.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            ['show_institutional', 'Institucional', 'Nome da empresa, CNPJ e copyright'],
            ['show_compliance', 'Compliance', 'Itens de conformidade legal (CLT, NR, eSocial)'],
            ['show_support', 'Suporte', 'Links de ajuda, documentação e contato'],
            ['show_technical', 'Técnico', 'Versão, ambiente e status do gateway (apenas admins)'],
            ['show_bottom_text', 'Texto inferior', 'Linha final com mensagem de uso restrito'],
          ] as const).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={config[key]}
                onCheckedChange={v => setConfig({ ...config, [key]: v })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Custom bottom text */}
      {config.show_bottom_text && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Texto inferior personalizado</CardTitle>
            <CardDescription>Deixe vazio para usar o texto padrão.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Plataforma de Compliance Trabalhista e SST — Uso restrito a usuários autorizados."
              value={config.custom_bottom_text || ''}
              onChange={e => setConfig({ ...config, custom_bottom_text: e.target.value })}
            />
          </CardContent>
        </Card>
      )}

      {/* Support links */}
      {config.show_support && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Headphones className="h-4 w-4 text-primary" />
              Links de Suporte
            </CardTitle>
            <CardDescription>Adicione, edite ou remova links exibidos na seção de suporte.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.support_links.map((link, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  placeholder="Rótulo"
                  value={link.label}
                  onChange={e => updateLink(idx, 'label', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="https://..."
                  value={link.href}
                  onChange={e => updateLink(idx, 'href', e.target.value)}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => removeLink(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLink} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Adicionar Link
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Compliance items */}
      {config.show_compliance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" />
              Itens de Compliance
            </CardTitle>
            <CardDescription>Edite os itens exibidos na seção de conformidade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.compliance_items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={item.text}
                  onChange={e => updateCompliance(idx, e.target.value)}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => removeCompliance(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addCompliance} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Adicionar Item
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(config)} disabled={saveMutation.isPending} className="gap-2">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
