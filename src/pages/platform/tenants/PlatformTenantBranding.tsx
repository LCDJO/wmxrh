/**
 * /platform/tenants/:tenantId/branding — Control Plane branding view
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Palette, ShieldCheck, History, Package } from 'lucide-react';

export default function PlatformTenantBranding() {
  const { tenantId } = useParams<{ tenantId: string }>();

  const { data: tenant } = useQuery({
    queryKey: ['platform-tenant', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('id, name').eq('id', tenantId!).single();
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: plan } = useQuery({
    queryKey: ['platform-tenant-plan', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_plans')
        .select('status, billing_cycle, saas_plans(name, allow_whitelabel, allow_custom_reports, allow_custom_domain)')
        .eq('tenant_id', tenantId!)
        .eq('status', 'active')
        .maybeSingle();
      return data as any;
    },
    enabled: !!tenantId,
  });

  const { data: branding } = useQuery({
    queryKey: ['platform-tenant-branding', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_branding_profiles')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: versions } = useQuery({
    queryKey: ['platform-tenant-branding-versions', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_branding_versions')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('version_id', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const allowWhitelabel = plan?.saas_plans?.allow_whitelabel ?? false;
  const allowCustomReports = plan?.saas_plans?.allow_custom_reports ?? false;
  const allowCustomDomain = plan?.saas_plans?.allow_custom_domain ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">
          Branding — {tenant?.name ?? tenantId}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Control Plane: personalização visual do tenant
        </p>
      </div>

      {/* Module Enablement */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Módulo Habilitado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">WhiteLabel</span>
              <Badge variant={allowWhitelabel ? 'default' : 'secondary'}>
                {allowWhitelabel ? 'Ativo' : 'Desabilitado'}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Relatórios Custom</span>
              <Badge variant={allowCustomReports ? 'default' : 'secondary'}>
                {allowCustomReports ? 'Ativo' : 'Desabilitado'}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Domínio Custom</span>
              <Badge variant={allowCustomDomain ? 'default' : 'secondary'}>
                {allowCustomDomain ? 'Ativo' : 'Desabilitado'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" /> Plano Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plan ? (
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-sm">{plan.saas_plans?.name ?? '—'}</Badge>
              <span className="text-sm text-muted-foreground">Status: {plan.status}</span>
              <span className="text-sm text-muted-foreground">Ciclo: {plan.billing_cycle}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum plano ativo</p>
          )}
        </CardContent>
      </Card>

      {/* Active Branding */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" /> Branding Ativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {branding ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome do Sistema:</span>
                  <p className="font-medium">{branding.system_display_name ?? '(padrão)'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Versão:</span>
                  <p className="font-medium">v{branding.version_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Cores:</span>
                <div className="flex gap-2">
                  {[branding.primary_color, branding.secondary_color, branding.accent_color].map((c, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded border" style={{ backgroundColor: c ?? undefined }} />
                      <span className="text-xs font-mono">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
              {branding.logo_url && (
                <div>
                  <span className="text-sm text-muted-foreground">Logo:</span>
                  <img src={branding.logo_url} alt="Logo" className="mt-1 h-10 object-contain" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {allowWhitelabel ? 'Nenhum branding configurado — usando padrão da plataforma' : 'Módulo WhiteLabel não habilitado no plano atual'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Version History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Histórico de Versões
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions && versions.length > 0 ? (
            <div className="space-y-2">
              {versions.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">v{v.version_id}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {v.created_by?.slice(0, 8) ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma versão registrada</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
