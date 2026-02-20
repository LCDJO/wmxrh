/**
 * GlobalFooter — Enterprise SaaS footer with dynamic tenant/platform data.
 * Sections gated by PermissionScope; white-label ready via tenant context.
 */
import { useMemo } from 'react';
import { Shield, Headphones, Cpu, ExternalLink } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex h-2 w-2 rounded-full ${
        online ? 'bg-primary animate-pulse' : 'bg-destructive'
      }`}
    />
  );
}

export function GlobalFooter() {
  const { currentTenant } = useTenant();
  const { can, isTenantAdmin } = usePermissions();

  // Dynamic platform data
  const { data: appVersion } = usePlatformSetting('app_version');
  const { data: lastLegalUpdate } = usePlatformSetting('last_legal_update');
  const { data: govGatewayStatus } = usePlatformSetting('gov_gateway_status');

  const environment = import.meta.env.MODE === 'production' ? 'Produção' : 'Homologação';
  const envColor = import.meta.env.MODE === 'production' ? 'text-primary' : 'text-amber-500';

  const canViewTechnical = useMemo(() => isTenantAdmin, [isTenantAdmin]);

  return (
    <footer className="border-t border-border bg-card text-card-foreground print:hidden">
      <div className="mx-auto max-w-[1600px] px-8 py-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* ── 1. Institucional (white-label) ── */}
          <div className="space-y-2.5">
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

          {/* ── 2. Compliance & Segurança ── */}
          <div className="space-y-2.5">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground tracking-widest uppercase">
              <Shield className="h-3 w-3 text-primary" />
              Compliance
            </h4>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              <li>✔ CLT — Consolidação das Leis do Trabalho</li>
              <li>✔ Normas Regulamentadoras (NR)</li>
              <li>✔ eSocial — Leiautes S-2.5+</li>
            </ul>
            <p className="text-[11px] text-muted-foreground">
              Regulatório atualizado até{' '}
              <span className="font-medium text-foreground">
                {lastLegalUpdate ?? '—'}
              </span>
            </p>
          </div>

          {/* ── 3. Suporte ── */}
          <div className="space-y-2.5">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground tracking-widest uppercase">
              <Headphones className="h-3 w-3 text-primary" />
              Suporte
            </h4>
            <ul className="space-y-1 text-[11px]">
              {[
                { label: 'Central de Ajuda', href: '#' },
                { label: 'Documentação Técnica', href: '#' },
                { label: 'Política de Privacidade', href: '#' },
                { label: 'Termos de Uso', href: '#' },
                { label: 'Contato', href: '#' },
              ].map(link => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                    <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── 4. Técnico (gated by permission) ── */}
          {canViewTechnical && (
            <div className="space-y-2.5">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground tracking-widest uppercase">
                <Cpu className="h-3 w-3 text-primary" />
                Técnico
              </h4>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                <li>
                  Versão:{' '}
                  <span className="font-mono font-medium text-foreground">
                    {appVersion ?? '—'}
                  </span>
                </li>
                <li>
                  Ambiente:{' '}
                  <span
                    className={`inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold ${envColor}`}
                  >
                    {environment}
                  </span>
                </li>
                <li>
                  Atualização legislativa:{' '}
                  <span className="font-medium text-foreground">
                    {lastLegalUpdate ?? '—'}
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

        <Separator className="my-5" />

        <p className="text-center text-[10px] text-muted-foreground">
          Plataforma de Compliance Trabalhista e SST — Uso restrito a usuários autorizados.
        </p>
      </div>
    </footer>
  );
}
