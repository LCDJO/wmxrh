/**
 * Shared hook to fetch platform footer defaults as fallback
 * when a tenant has no footer_configs record.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FooterDefaultsData {
  show_institutional: boolean;
  show_compliance: boolean;
  show_support: boolean;
  show_technical: boolean;
  show_bottom_text: boolean;
  custom_bottom_text: string | null;
  support_links: { label: string; href: string }[];
  compliance_items: { text: string }[];
}

const HARDCODED_DEFAULTS: FooterDefaultsData = {
  show_institutional: true,
  show_compliance: true,
  show_support: true,
  show_technical: true,
  show_bottom_text: true,
  custom_bottom_text: null,
  support_links: [
    { label: 'Central de Ajuda', href: '#' },
    { label: 'Documentação Técnica', href: '#' },
    { label: 'Política de Privacidade', href: '#' },
    { label: 'Termos de Uso', href: '#' },
    { label: 'Contato', href: '#' },
  ],
  compliance_items: [
    { text: 'CLT — Consolidação das Leis do Trabalho' },
    { text: 'Normas Regulamentadoras (NR)' },
    { text: 'eSocial — Leiautes S-2.5+' },
  ],
};

export function usePlatformFooterDefaults() {
  return useQuery({
    queryKey: ['platform_footer_defaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_footer_defaults')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error || !data) return HARDCODED_DEFAULTS;
      return {
        show_institutional: data.show_institutional,
        show_compliance: data.show_compliance,
        show_support: data.show_support,
        show_technical: data.show_technical,
        show_bottom_text: data.show_bottom_text,
        custom_bottom_text: data.custom_bottom_text,
        support_links: Array.isArray(data.support_links)
          ? (data.support_links as unknown as { label: string; href: string }[])
          : HARDCODED_DEFAULTS.support_links,
        compliance_items: Array.isArray(data.compliance_items)
          ? (data.compliance_items as unknown as { text: string }[])
          : HARDCODED_DEFAULTS.compliance_items,
      } as FooterDefaultsData;
    },
    staleTime: 10 * 60_000,
  });
}

export { HARDCODED_DEFAULTS };
