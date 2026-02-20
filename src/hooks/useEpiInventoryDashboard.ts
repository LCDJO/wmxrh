/**
 * useEpiInventoryDashboard — Hooks for EPI Inventory Dashboard
 *
 * Company-level: stock positions, lots by expiry, cost by department, assets in use
 * Tenant-level: cost ranking by company, stock rupture risk
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

// ── Types ──

export interface InventoryStockItem {
  epi_catalog_id: string;
  epi_nome: string;
  warehouse_id: string;
  warehouse_name: string;
  quantidade_disponivel: number;
  quantidade_reservada: number;
  quantidade_minima: number;
  custo_unitario_medio: number;
  last_movement_at: string | null;
}

export interface LotExpiryGroup {
  status: string;
  total: number;
}

export interface DepartmentCost {
  department_id: string;
  department_name: string;
  mes: string;
  custo_total: number;
  quantidade: number;
}

export interface AssetInUse {
  employee_id: string;
  employee_name: string;
  epi_nome: string;
  serial_number: string;
  data_entrega: string | null;
  asset_id: string;
}

export interface CompanyCostRanking {
  company_id: string;
  company_name: string;
  custo_total: number;
  total_itens: number;
  total_colaboradores: number;
}

export interface StockRuptureRisk {
  inventory_id: string;
  epi_nome: string;
  warehouse_name: string;
  quantidade_disponivel: number;
  quantidade_minima: number;
  risco: string;
  dias_cobertura: number;
}

// ── Hooks ──

export function useInventoryStock() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['epi-inventory-dashboard', 'stock', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_epi_inventory_summary', {
        _tenant_id: tenantId!,
      });
      if (error) throw error;
      return (data ?? []) as unknown as InventoryStockItem[];
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useLotsByExpiry() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['epi-inventory-dashboard', 'lots-expiry', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_epi_lots_by_expiry', {
        _tenant_id: tenantId!,
      });
      if (error) throw error;
      return (data ?? []) as unknown as LotExpiryGroup[];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useCostByDepartment() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['epi-inventory-dashboard', 'cost-dept', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_epi_cost_by_department', {
        _tenant_id: tenantId!,
        _months: 3,
      });
      if (error) throw error;
      return (data ?? []) as unknown as DepartmentCost[];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useAssetsInUse() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['epi-inventory-dashboard', 'assets-in-use', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_epi_assets_in_use', {
        _tenant_id: tenantId!,
      });
      if (error) throw error;
      return (data ?? []) as unknown as AssetInUse[];
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useCompanyCostRanking() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['epi-inventory-dashboard', 'cost-ranking', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_epi_cost_ranking_by_company', {
        _tenant_id: tenantId!,
      });
      if (error) throw error;
      return (data ?? []) as unknown as CompanyCostRanking[];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useStockRuptureRisk() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['epi-inventory-dashboard', 'rupture-risk', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_epi_stock_rupture_risk', {
        _tenant_id: tenantId!,
      });
      if (error) throw error;
      return (data ?? []) as unknown as StockRuptureRisk[];
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}
