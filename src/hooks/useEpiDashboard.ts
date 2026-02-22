/**
 * useEpiDashboard — Data hook for EPI Dashboard
 *
 * Provides:
 *   - Company-level stats: delivered, expired, near-expiry CAs, unsigned deliveries
 *   - Tenant-level ranking: EPI compliance score per company
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

// ── Types ──

export interface EpiCompanyStats {
  total_delivered: number;
  expired: number;
  near_expiry_cas: number;
  unsigned_deliveries: number;
}

export interface EpiCompanyRanking {
  company_id: string;
  company_name: string;
  total_delivered: number;
  expired: number;
  unsigned: number;
  compliance_pct: number;
}

// ── Company-level stats ──

export function useEpiCompanyStats(companyId?: string | null) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['epi-dashboard', 'company-stats', tenantId, companyId],
    queryFn: async (): Promise<EpiCompanyStats> => {
      if (!tenantId) throw new Error('No tenant');

      const today = new Date().toISOString().split('T')[0];
      const in30d = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      let deliveredQ = supabase
        .from('epi_deliveries' as 'epi_deliveries' & string)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'entregue');

      let expiredQ = supabase
        .from('epi_deliveries' as 'epi_deliveries' & string)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['entregue', 'vencido'])
        .not('data_validade', 'is', null)
        .lt('data_validade', today);

      let nearExpiryCAQ = supabase
        .from('epi_catalog' as 'epi_catalog' & string)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .not('ca_validade', 'is', null)
        .lte('ca_validade', in30d);

      if (companyId) {
        deliveredQ = deliveredQ.eq('company_id', companyId);
        expiredQ = expiredQ.eq('company_id', companyId);
      }

      // Unsigned: deliveries with status 'entregue' that have no valid signature
      let unsignedQ = supabase
        .from('epi_deliveries' as 'epi_deliveries' & string)
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'entregue');

      if (companyId) {
        unsignedQ = unsignedQ.eq('company_id', companyId);
      }

      const [delivered, expired, nearCA, allDeliveries] = await Promise.all([
        deliveredQ,
        expiredQ,
        nearExpiryCAQ,
        unsignedQ,
      ]);

      // Check signatures for delivered EPIs
      let unsignedCount = 0;
      const deliveryIds = ((allDeliveries.data ?? []) as { id: string }[]).map(d => d.id);
      if (deliveryIds.length > 0) {
        const { data: sigs } = await supabase
          .from('epi_signatures' as 'epi_signatures' & string)
          .select('delivery_id')
          .in('delivery_id', deliveryIds)
          .eq('is_valid', true);
        const signedIds = new Set((sigs ?? []).map((s: { delivery_id: string }) => s.delivery_id));
        unsignedCount = deliveryIds.filter(id => !signedIds.has(id)).length;
      }

      return {
        total_delivered: delivered.count ?? 0,
        expired: expired.count ?? 0,
        near_expiry_cas: nearCA.count ?? 0,
        unsigned_deliveries: unsignedCount,
      };
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

// ── Tenant-level: Ranking de compliance EPI por empresa ──

export function useEpiCompanyRanking() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['epi-dashboard', 'company-ranking', tenantId],
    queryFn: async (): Promise<EpiCompanyRanking[]> => {
      if (!tenantId) throw new Error('No tenant');

      const today = new Date().toISOString().split('T')[0];

      // Get all companies
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .is('deleted_at', null);

      if (!companies?.length) return [];

      // Get all deliveries for this tenant grouped by company
      const { data: deliveries } = await supabase
        .from('epi_deliveries' as 'epi_deliveries' & string)
        .select('id, company_id, status, data_validade')
        .eq('tenant_id', tenantId);

      // Get signatures
      const allDeliveryIds = ((deliveries ?? []) as { id: string }[]).map(d => d.id);
      let signedIds = new Set<string>();
      if (allDeliveryIds.length > 0) {
        const { data: sigs } = await supabase
          .from('epi_signatures' as 'epi_signatures' & string)
          .select('delivery_id')
          .in('delivery_id', allDeliveryIds)
          .eq('is_valid', true);
        signedIds = new Set((sigs ?? []).map((s: { delivery_id: string }) => s.delivery_id));
      }

      const ranking: EpiCompanyRanking[] = companies.map((c) => {
        const compDeliveries = ((deliveries ?? []) as { id: string; company_id: string; status: string; data_validade: string | null }[]).filter(d => d.company_id === c.id);
        const delivered = compDeliveries.filter(d => d.status === 'entregue');
        const expired = compDeliveries.filter(d =>
          d.data_validade && new Date(d.data_validade) < new Date(today) &&
          ['entregue', 'vencido'].includes(d.status)
        );
        const unsigned = delivered.filter(d => !signedIds.has(d.id));

        const total = delivered.length;
        const issues = expired.length + unsigned.length;
        const compliance_pct = total > 0 ? Math.round(((total - issues) / total) * 100) : 100;

        return {
          company_id: c.id,
          company_name: c.name,
          total_delivered: total,
          expired: expired.length,
          unsigned: unsigned.length,
          compliance_pct: Math.max(0, compliance_pct),
        };
      });

      return ranking.sort((a, b) => a.compliance_pct - b.compliance_pct);
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}
