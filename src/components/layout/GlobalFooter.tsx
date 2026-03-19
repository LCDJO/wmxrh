/**
 * GlobalFooter — Enterprise SaaS footer with dynamic tenant/platform data.
 * Reads footer_configs to allow per-tenant section toggling & content editing.
 * Falls back to platform_footer_defaults when tenant has no config.
 */
import { useMemo, forwardRef } from 'react';
import { Shield, Headphones, Cpu, ExternalLink } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformFooterDefaults } from '@/hooks/platform/use-footer-defaults';
const currentYear = new Date().getFullYear();

/* ── helpers ── */
function usePlatformSetting(key: string) {
  return useQuery({
    queryKey: ['platform_setting', key],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      return typeof data?.value === 'string' ? data.value : data?.value != null ? String(data.value) : null;
    },
    staleTime: 5 * 60_000,
  });
}

interface FooterConfigData {
  show_institutional: boolean;
  show_compliance: boolean;
  show_support: boolean;
  show_technical: boolean;
  show_bottom_text: boolean;
  custom_bottom_text: string | null;
  support_links: { label: string; href: string }[];
  compliance_items: { text: string }[];
}

// Hardcoded fallback removed — now uses platform_footer_defaults via hook

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex h-2 w-2 rounded-full ${
        online ? 'bg-primary animate-pulse' : 'bg-destructive'
      }`}
    />
  );
}

export const GlobalFooter = forwardRef<HTMLElement, {}>(function GlobalFooter(_props, ref) {
  const { currentTenant } = useTenant();
  const { isTenantAdmin } = usePermissions();
  const { data: platformDefaults } = usePlatformFooterDefaults();

  const { data: appVersion } = usePlatformSetting('app_version');
  const { data: lastLegalUpdate } = usePlatformSetting('last_legal_update');
  const { data: govGatewayStatus } = usePlatformSetting('gov_gateway_status');

  const { data: footerConfigRaw } = useQuery({
    queryKey: ['footer_config', currentTenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('footer_configs')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenant?.id,
    staleTime: 5 * 60_000,
  });

  const cfg: FooterConfigData = useMemo(() => {
    const fb: FooterConfigData = platformDefaults ?? {
      show_institutional: true, show_compliance: true, show_support: true,
      show_technical: true, show_bottom_text: true, custom_bottom_text: null,
      support_links: [], compliance_items: [],
    };

    if (!footerConfigRaw) return fb;
    return {
      show_institutional: footerConfigRaw.show_institutional,
      show_compliance: footerConfigRaw.show_compliance,
      show_support: footerConfigRaw.show_support,
      show_technical: footerConfigRaw.show_technical,
      show_bottom_text: footerConfigRaw.show_bottom_text,
      custom_bottom_text: footerConfigRaw.custom_bottom_text,
      support_links: Array.isArray(footerConfigRaw.support_links)
        ? (footerConfigRaw.support_links as unknown as { label: string; href: string }[])
        : fb.support_links,
      compliance_items: Array.isArray(footerConfigRaw.compliance_items)
        ? (footerConfigRaw.compliance_items as unknown as { text: string }[])
        : fb.compliance_items,
    };
  }, [footerConfigRaw, platformDefaults]);

  const environment = import.meta.env.MODE === 'production' ? 'Produção' : 'Homologação';
  const envColor = import.meta.env.MODE === 'production' ? 'text-primary' : 'text-amber-500';
  const canViewTechnical = useMemo(() => isTenantAdmin, [isTenantAdmin]);

  // Count visible sections to decide grid columns
  const visibleSections = [
    cfg.show_institutional,
    cfg.show_compliance,
    cfg.show_support,
    cfg.show_technical && canViewTechnical,
  ].filter(Boolean).length;

  const gridCols = visibleSections <= 2 ? 'sm:grid-cols-2' : visibleSections === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <footer ref={ref} className="border-t border-border bg-card text-card-foreground print:hidden">
      <div className="mx-auto max-w-[1600px] px-8 py-6">
        <div className={`grid grid-cols-1 gap-6 ${gridCols}`}>
          {/* 1. Institucional */}
          {cfg.show_institutional && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-foreground tracking-widest uppercase">
                Institucional
              </h4>
              <p className="text-sm font-medium text-foreground">
                {currentTenant?.name ?? 'PeopleOS'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                © {currentYear} — Todos os direitos reservados.
              </p>
              {currentTenant?.document && (
                <p className="text-[11px] text-muted-foreground">
                  CNPJ: {currentTenant.document}
                </p>
              )}
            </div>
          )}

          {/* 2. Compliance */}
          {cfg.show_compliance && cfg.compliance_items.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground tracking-widest uppercase">
                <Shield className="h-3 w-3 text-primary" />
                Compliance
              </h4>
              <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                {cfg.compliance_items.map((item, i) => (
                  <li key={i}>✔ {item.text}</li>
                ))}
              </ul>
              {lastLegalUpdate && (
                <p className="text-[11px] text-muted-foreground">
                  Atualizado até{' '}
                  <span className="font-medium text-foreground">{lastLegalUpdate}</span>
                </p>
              )}
            </div>
          )}

          {/* 3. Suporte */}
          {cfg.show_support && cfg.support_links.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground tracking-widest uppercase">
                <Headphones className="h-3 w-3 text-primary" />
                Suporte
              </h4>
              <ul className="space-y-0.5 text-[11px]">
                {cfg.support_links.filter(l => l.label).map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.href || '#'}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 4. Técnico */}
          {cfg.show_technical && canViewTechnical && (
            <div className="space-y-1.5">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground tracking-widest uppercase">
                <Cpu className="h-3 w-3 text-primary" />
                Técnico
              </h4>
              <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                <li>
                  Versão:{' '}
                  <span className="font-mono font-medium text-foreground">
                    {appVersion ?? '—'}
                  </span>
                </li>
                <li>
                  Ambiente:{' '}
                  <span className={`inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold ${envColor}`}>
                    {environment}
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  Gov Gateway:
                  <StatusDot online={govGatewayStatus === 'online'} />
                  <span className={govGatewayStatus === 'online' ? 'text-primary font-medium' : 'text-destructive font-medium'}>
                    {govGatewayStatus === 'online' ? 'Online' : 'Offline'}
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>

        {cfg.show_bottom_text && (
          <>
            <Separator className="my-4" />
            <p className="text-center text-[10px] text-muted-foreground">
              {cfg.custom_bottom_text || 'Plataforma de Compliance Trabalhista e SST — Uso restrito a usuários autorizados.'}
            </p>
          </>
        )}
      </div>
    </footer>
  );
});
