/**
 * /settings/personalization — Tenant branding settings
 */
import { useState } from 'react';
import { useTenantBranding } from '@/hooks/use-tenant-branding';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Palette, Save, Type, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function TenantPersonalization() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? '';
  const {
    ready,
    profile,
    canWhiteLabel,
    canCustomReports,
    engine,
    systemName,
  } = useTenantBranding();

  const [form, setForm] = useState({
    system_display_name: '',
    primary_color: '#0D9668',
    secondary_color: '#1E293B',
    accent_color: '#10B981',
    logo_url: '',
    report_header_logo: '',
    report_footer_text: '',
  });
  const [initialized, setInitialized] = useState(false);

  // Seed form from profile once
  if (ready && !initialized) {
    if (profile) {
      setForm({
        system_display_name: profile.system_display_name ?? '',
        primary_color: profile.primary_color ?? '#0D9668',
        secondary_color: profile.secondary_color ?? '#1E293B',
        accent_color: profile.accent_color ?? '#10B981',
        logo_url: profile.logo_url ?? '',
        report_header_logo: profile.report_header_logo ?? '',
        report_footer_text: profile.report_footer_text ?? '',
      });
    }
    setInitialized(true);
  }

  const handleSave = async () => {
    // Validate
    const validation = engine.validator.validate({
      ...form,
      system_display_name: form.system_display_name || undefined,
      logo_url: form.logo_url || undefined,
      report_header_logo: form.report_header_logo || undefined,
    });
    if (!validation.valid) {
      validation.errors.forEach((e) => toast.error(e));
      return;
    }
    validation.warnings.forEach((w) => toast.warning(w));

    const payload = {
      tenant_id: tenantId,
      system_display_name: form.system_display_name || null,
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      accent_color: form.accent_color,
      logo_url: form.logo_url || null,
      report_header_logo: form.report_header_logo || null,
      report_footer_text: form.report_footer_text || null,
      version_id: (profile?.version_id ?? 0) + 1,
    };

    const { error } = profile
      ? await supabase.from('tenant_branding_profiles').update(payload).eq('id', profile.id)
      : await supabase.from('tenant_branding_profiles').insert(payload);

    if (error) {
      toast.error('Erro ao salvar personalização');
      return;
    }

    // Save version snapshot
    await supabase.from('tenant_branding_versions').insert({
      tenant_id: tenantId,
      version_id: payload.version_id,
      snapshot_config: payload,
    });

    toast.success('Personalização salva com sucesso');
  };

  if (!ready) return null;

  // ── Not enabled: show warning ──
  if (!canWhiteLabel) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Personalização</h1>
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="h-10 w-10 text-warning" />
              <p className="text-lg font-medium">Seu plano permite apenas logo em relatórios.</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Para personalizar cores, nome do sistema e relatórios completos,
                faça upgrade para um plano que inclua o módulo WhiteLabel.
              </p>
              <Badge variant="secondary" className="mt-2">Módulo WhiteLabel não habilitado</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Logo-only for reports */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Logo para Relatórios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>URL do Logo</Label>
              <Input
                value={form.report_header_logo}
                onChange={(e) => setForm((f) => ({ ...f, report_header_logo: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" /> Salvar Logo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Full branding editor ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Personalização</h1>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" /> Salvar Alterações
        </Button>
      </div>

      {/* Colors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" /> Cores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {(['primary_color', 'secondary_color', 'accent_color'] as const).map((key) => (
              <div key={key} className="space-y-2">
                <Label className="capitalize">{key.replace('_', ' ')}</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Preview */}
          <div className="mt-4 flex gap-2">
            {[form.primary_color, form.secondary_color, form.accent_color].map((c, i) => (
              <div key={i} className="h-8 flex-1 rounded" style={{ backgroundColor: c }} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Name */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="h-4 w-4" /> Nome do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Nome exibido no header, login e PDFs</Label>
          <Input
            value={form.system_display_name}
            onChange={(e) => setForm((f) => ({ ...f, system_display_name: e.target.value }))}
            placeholder={systemName}
            maxLength={100}
          />
        </CardContent>
      </Card>

      {/* Reports */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Relatórios
            {!canCustomReports && <Badge variant="secondary" className="text-xs">Apenas logo</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Logo do Cabeçalho</Label>
            <Input
              value={form.report_header_logo}
              onChange={(e) => setForm((f) => ({ ...f, report_header_logo: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          {canCustomReports && (
            <>
              <div>
                <Label>Logo Geral</Label>
                <Input
                  value={form.logo_url}
                  onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>Texto do Rodapé</Label>
                <Input
                  value={form.report_footer_text}
                  onChange={(e) => setForm((f) => ({ ...f, report_footer_text: e.target.value }))}
                  placeholder="Ex: © 2026 Empresa XYZ"
                  maxLength={500}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
