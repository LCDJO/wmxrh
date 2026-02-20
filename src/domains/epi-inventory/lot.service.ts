/**
 * EPI Inventory — Lot Tracking Service
 *
 * Rastreabilidade de lotes: fabricação, validade, NF, custo unitário.
 */

import { supabase } from '@/integrations/supabase/client';
import type { EpiLot, EpiLotInput, ExpiringLotResult } from './types';

export async function createLot(input: EpiLotInput): Promise<EpiLot> {
  const { data, error } = await supabase
    .from('epi_lots')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar lote: ${error.message}`);
  return data as unknown as EpiLot;
}

export async function listLots(
  tenantId: string,
  epiCatalogId?: string
): Promise<EpiLot[]> {
  let query = supabase
    .from('epi_lots')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (epiCatalogId) query = query.eq('epi_catalog_id', epiCatalogId);

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao listar lotes: ${error.message}`);
  return (data ?? []) as unknown as EpiLot[];
}

export async function getLotById(lotId: string): Promise<EpiLot | null> {
  const { data, error } = await supabase
    .from('epi_lots')
    .select('*')
    .eq('id', lotId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar lote: ${error.message}`);
  return data as unknown as EpiLot | null;
}

export async function scanExpiringLots(
  tenantId: string,
  daysAhead: number = 30
): Promise<ExpiringLotResult[]> {
  const { data, error } = await supabase.rpc('scan_expiring_epi_lots', {
    _tenant_id: tenantId,
    _days_ahead: daysAhead,
  });

  if (error) throw new Error(`Erro ao escanear lotes: ${error.message}`);
  return (data ?? []) as unknown as ExpiringLotResult[];
}
