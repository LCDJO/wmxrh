/**
 * PlatformFooterDefaults — Superadmin page for managing default footer configs
 * that are applied automatically to new tenants.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, Plus, Trash2, FootprintsIcon } from 'lucide-react';

interface SupportLink {
  label: string;
  href: string;
}

interface ComplianceItem {
  text: string;
}

interface FooterDefaults {
  id: string;
  show_institutional: boolean;
  show_compliance: boolean;
  show_support: boolean;
  show_technical: boolean;
  show_bottom_text: boolean;
  custom_bottom_text: string | null;
  support_links: SupportLink[];
  compliance_items: ComplianceItem[];
}

export default function PlatformFooterDefaults() {
  const queryClient = useQueryClient();

  const { data: defaults, isLoading } = useQuery({
    queryKey: ['platform_footer_defaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_footer_defaults')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as FooterDefaults | null;
    },
  });

  const [form, setForm] = useState<Omit<FooterDefaults, 'id'>>({
    show_institutional: true,
    show_compliance: true,
    show_support: true,
    show_technical: true,
    show_bottom_text: true,
    custom_bottom_text: null,
    support_links: [],
    compliance_items: [],
  });

  useEffect(() => {
    if (defaults) {
      setForm({
        show_institutional: defaults.show_institutional,
        show_compliance: defaults.show_compliance,
        show_support: defaults.show_support,
        show_technical: defaults.show_technical,
        show_bottom_text: defaults.show_bottom_text,
        custom_bottom_text: defaults.custom_bottom_text,
        support_links: (defaults.support_links as unknown as SupportLink[]) || [],
        compliance_items: (defaults.compliance_items as unknown as ComplianceItem[]) || [],
      });
    }
  }, [defaults]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        show_institutional: form.show_institutional,
        show_compliance: form.show_compliance,
        show_support: form.show_support,
        show_technical: form.show_technical,
        show_bottom_text: form.show_bottom_text,
        custom_bottom_text: form.custom_bottom_text,
        support_links: form.support_links as unknown as any,
        compliance_items: form.compliance_items as unknown as any,
      };

      if (defaults?.id) {
        const { error } = await supabase
          .from('platform_footer_defaults')
          .update(payload)
          .eq('id', defaults.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('platform_footer_defaults')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform_footer_defaults'] });
      toast.success('Configurações de rodapé salvas com sucesso');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleField = (field: keyof typeof form) => {
    setForm(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const addSupportLink = () => {
    setForm(prev => ({
      ...prev,
      support_links: [...prev.support_links, { label: '', href: '#' }],
    }));
  };

  const removeSupportLink = (i: number) => {
    setForm(prev => ({
      ...prev,
      support_links: prev.support_links.filter((_, idx) => idx !== i),
    }));
  };

  const updateSupportLink = (i: number, field: 'label' | 'href', value: string) => {
    setForm(prev => {
      const links = [...prev.support_links];
      links[i] = { ...links[i], [field]: value };
      return { ...prev, support_links: links };
    });
  };

  const addComplianceItem = () => {
    setForm(prev => ({
      ...prev,
      compliance_items: [...prev.compliance_items, { text: '' }],
    }));
  };

  const removeComplianceItem = (i: number) => {
    setForm(prev => ({
      ...prev,
      compliance_items: prev.compliance_items.filter((_, idx) => idx !== i),
    }));
  };

  const updateComplianceItem = (i: number, value: string) => {
    setForm(prev => {
      const items = [...prev.compliance_items];
      items[i] = { text: value };
      return { ...prev, compliance_items: items };
    });
  };

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações de Rodapé</h1>
        <p className="text-sm text-muted-foreground">
          Defina o rodapé padrão que será aplicado automaticamente a novos tenants.
        </p>
      </div>

      {/* Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seções Visíveis</CardTitle>
          <CardDescription>Controle quais seções do rodapé aparecem por padrão.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'show_institutional' as const, label: 'Institucional' },
            { key: 'show_compliance' as const, label: 'Compliance' },
            { key: 'show_support' as const, label: 'Suporte' },
            { key: 'show_technical' as const, label: 'Técnico' },
            { key: 'show_bottom_text' as const, label: 'Texto Inferior' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{label}</Label>
              <Switch checked={!!form[key]} onCheckedChange={() => toggleField(key)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bottom text */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Texto Inferior Personalizado</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Plataforma de Compliance Trabalhista..."
            value={form.custom_bottom_text || ''}
            onChange={e => setForm(prev => ({ ...prev, custom_bottom_text: e.target.value || null }))}
          />
        </CardContent>
      </Card>

      {/* Support links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Links de Suporte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.support_links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Label"
                value={link.label}
                onChange={e => updateSupportLink(i, 'label', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="URL"
                value={link.href}
                onChange={e => updateSupportLink(i, 'href', e.target.value)}
                className="flex-1"
              />
              <Button variant="ghost" size="icon" onClick={() => removeSupportLink(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSupportLink}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Link
          </Button>
        </CardContent>
      </Card>

      {/* Compliance items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens de Compliance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.compliance_items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Ex: CLT — Consolidação das Leis do Trabalho"
                value={item.text}
                onChange={e => updateComplianceItem(i, e.target.value)}
                className="flex-1"
              />
              <Button variant="ghost" size="icon" onClick={() => removeComplianceItem(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addComplianceItem}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Item
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
