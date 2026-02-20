/**
 * EPI Inventory & Asset Tracking Engine — Inventory Service
 *
 * Manages stock positions, entries, adjustments, and transfers.
 * Integrates with EPILifecycleEngine via DB triggers for automatic deduction on delivery.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  EpiWarehouse,
  EpiWarehouseInput,
  EpiInventoryPosition,
  StockEntryInput,
  StockAdjustmentInput,
  StockTransferInput,
  EpiInventoryMovement,
  StockAlert,
} from './types';

// ═══════════════════════════════════════════════════════
// WAREHOUSE MANAGEMENT
// ═══════════════════════════════════════════════════════

export async function createWarehouse(input: EpiWarehouseInput): Promise<EpiWarehouse> {
  const { data, error } = await supabase
    .from('epi_warehouses')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar almoxarifado: ${error.message}`);
  return data as unknown as EpiWarehouse;
}

export async function listWarehouses(tenantId: string): Promise<EpiWarehouse[]> {
  const { data, error } = await supabase
    .from('epi_warehouses')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name');

  if (error) throw new Error(`Erro ao listar almoxarifados: ${error.message}`);
  return (data ?? []) as unknown as EpiWarehouse[];
}

// ═══════════════════════════════════════════════════════
// STOCK ENTRY (Entrada de Estoque)
// ═══════════════════════════════════════════════════════

export async function registerStockEntry(input: StockEntryInput): Promise<EpiInventoryPosition> {
  // Upsert inventory position
  const { data: existing } = await supabase
    .from('epi_inventory')
    .select('id, quantidade_disponivel, custo_unitario_medio')
    .eq('tenant_id', input.tenant_id)
    .eq('warehouse_id', input.warehouse_id)
    .eq('epi_catalog_id', input.epi_catalog_id)
    .eq('lot_id', input.lot_id ?? '')
    .maybeSingle();

  let inventoryId: string;

  if (existing) {
    // Update existing position with weighted average cost
    const oldQty = (existing as any).quantidade_disponivel ?? 0;
    const oldCost = (existing as any).custo_unitario_medio ?? 0;
    const newAvgCost =
      oldQty + input.quantidade > 0
        ? (oldQty * oldCost + input.quantidade * input.custo_unitario) / (oldQty + input.quantidade)
        : input.custo_unitario;

    const { error } = await supabase
      .from('epi_inventory')
      .update({
        quantidade_disponivel: oldQty + input.quantidade,
        custo_unitario_medio: Math.round(newAvgCost * 100) / 100,
        last_movement_at: new Date().toISOString(),
      })
      .eq('id', (existing as any).id);

    if (error) throw new Error(`Erro ao atualizar estoque: ${error.message}`);
    inventoryId = (existing as any).id;
  } else {
    // Create new position
    const { data: created, error } = await supabase
      .from('epi_inventory')
      .insert({
        tenant_id: input.tenant_id,
        warehouse_id: input.warehouse_id,
        epi_catalog_id: input.epi_catalog_id,
        lot_id: input.lot_id ?? null,
        quantidade_disponivel: input.quantidade,
        custo_unitario_medio: input.custo_unitario,
        last_movement_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar posição de estoque: ${error.message}`);
    inventoryId = (created as any).id;
  }

  // Log movement
  await supabase.from('epi_inventory_movements').insert({
    tenant_id: input.tenant_id,
    inventory_id: inventoryId,
    warehouse_id: input.warehouse_id,
    epi_catalog_id: input.epi_catalog_id,
    lot_id: input.lot_id ?? null,
    movement_type: 'entrada',
    quantidade: input.quantidade,
    custo_unitario: input.custo_unitario,
    custo_total: input.custo_unitario * input.quantidade,
    reference_type: 'purchase',
    nota_fiscal: input.nota_fiscal,
    justificativa: input.justificativa,
  });

  // Return updated position
  const { data: position } = await supabase
    .from('epi_inventory')
    .select('*')
    .eq('id', inventoryId)
    .single();

  return position as unknown as EpiInventoryPosition;
}

// ═══════════════════════════════════════════════════════
// STOCK ADJUSTMENT (Ajuste de Inventário)
// ═══════════════════════════════════════════════════════

export async function adjustStock(input: StockAdjustmentInput): Promise<void> {
  const { data: inv, error: fetchErr } = await supabase
    .from('epi_inventory')
    .select('*')
    .eq('id', input.inventory_id)
    .single();

  if (fetchErr || !inv) throw new Error('Posição de estoque não encontrada');

  const record = inv as any;
  const newQty = record.quantidade_disponivel + input.quantidade_ajuste;
  if (newQty < 0) throw new Error('Ajuste resultaria em estoque negativo');

  await supabase
    .from('epi_inventory')
    .update({ quantidade_disponivel: newQty, last_movement_at: new Date().toISOString() })
    .eq('id', input.inventory_id);

  await supabase.from('epi_inventory_movements').insert({
    tenant_id: input.tenant_id,
    inventory_id: input.inventory_id,
    warehouse_id: record.warehouse_id,
    epi_catalog_id: record.epi_catalog_id,
    lot_id: record.lot_id,
    movement_type: 'ajuste',
    quantidade: input.quantidade_ajuste,
    reference_type: 'adjustment',
    justificativa: input.justificativa,
  });
}

// ═══════════════════════════════════════════════════════
// STOCK TRANSFER (Transferência entre almoxarifados)
// ═══════════════════════════════════════════════════════

export async function transferStock(input: StockTransferInput): Promise<void> {
  const { data: source, error: srcErr } = await supabase
    .from('epi_inventory')
    .select('*')
    .eq('id', input.source_inventory_id)
    .single();

  if (srcErr || !source) throw new Error('Posição de origem não encontrada');

  const src = source as any;
  if (src.quantidade_disponivel < input.quantidade) {
    throw new Error('Quantidade insuficiente para transferência');
  }

  // Deduct from source
  await supabase
    .from('epi_inventory')
    .update({
      quantidade_disponivel: src.quantidade_disponivel - input.quantidade,
      last_movement_at: new Date().toISOString(),
    })
    .eq('id', input.source_inventory_id);

  // Add to target (upsert)
  const { data: target } = await supabase
    .from('epi_inventory')
    .select('id, quantidade_disponivel')
    .eq('tenant_id', input.tenant_id)
    .eq('warehouse_id', input.target_warehouse_id)
    .eq('epi_catalog_id', src.epi_catalog_id)
    .eq('lot_id', src.lot_id ?? '')
    .maybeSingle();

  let targetId: string;
  if (target) {
    await supabase
      .from('epi_inventory')
      .update({
        quantidade_disponivel: (target as any).quantidade_disponivel + input.quantidade,
        last_movement_at: new Date().toISOString(),
      })
      .eq('id', (target as any).id);
    targetId = (target as any).id;
  } else {
    const { data: created } = await supabase
      .from('epi_inventory')
      .insert({
        tenant_id: input.tenant_id,
        warehouse_id: input.target_warehouse_id,
        epi_catalog_id: src.epi_catalog_id,
        lot_id: src.lot_id,
        quantidade_disponivel: input.quantidade,
        custo_unitario_medio: src.custo_unitario_medio,
        last_movement_at: new Date().toISOString(),
      })
      .select()
      .single();
    targetId = (created as any).id;
  }

  // Log both movements
  const movementBase = {
    tenant_id: input.tenant_id,
    epi_catalog_id: src.epi_catalog_id,
    lot_id: src.lot_id,
    movement_type: 'transferencia' as const,
    quantidade: input.quantidade,
    custo_unitario: src.custo_unitario_medio,
    custo_total: src.custo_unitario_medio * input.quantidade,
    reference_type: 'transfer' as const,
    justificativa: input.justificativa,
  };

  await supabase.from('epi_inventory_movements').insert([
    { ...movementBase, inventory_id: input.source_inventory_id, warehouse_id: src.warehouse_id },
    { ...movementBase, inventory_id: targetId, warehouse_id: input.target_warehouse_id },
  ]);
}

// ═══════════════════════════════════════════════════════
// INVENTORY QUERIES
// ═══════════════════════════════════════════════════════

export async function getInventoryPositions(
  tenantId: string,
  warehouseId?: string
): Promise<EpiInventoryPosition[]> {
  let query = supabase
    .from('epi_inventory')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });

  if (warehouseId) query = query.eq('warehouse_id', warehouseId);

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao buscar estoque: ${error.message}`);
  return (data ?? []) as unknown as EpiInventoryPosition[];
}

export async function getMovementHistory(
  tenantId: string,
  filters?: { warehouse_id?: string; epi_catalog_id?: string; employee_id?: string; limit?: number }
): Promise<EpiInventoryMovement[]> {
  let query = supabase
    .from('epi_inventory_movements')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filters?.warehouse_id) query = query.eq('warehouse_id', filters.warehouse_id);
  if (filters?.epi_catalog_id) query = query.eq('epi_catalog_id', filters.epi_catalog_id);
  if (filters?.employee_id) query = query.eq('employee_id', filters.employee_id);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao buscar movimentações: ${error.message}`);
  return (data ?? []) as unknown as EpiInventoryMovement[];
}

// ═══════════════════════════════════════════════════════
// STOCK ALERTS
// ═══════════════════════════════════════════════════════

export async function getStockAlerts(tenantId: string): Promise<StockAlert[]> {
  const alerts: StockAlert[] = [];

  // Low stock alerts
  const { data: lowStock } = await supabase
    .from('epi_inventory')
    .select('*, epi_catalog:epi_catalog_id(nome), warehouse:warehouse_id(name)')
    .eq('tenant_id', tenantId)
    .lt('quantidade_disponivel', 5); // simplified; real logic uses quantidade_minima

  for (const item of (lowStock ?? []) as any[]) {
    const qty = item.quantidade_disponivel ?? 0;
    const min = item.quantidade_minima ?? 5;
    if (qty <= min) {
      alerts.push({
        type: qty === 0 ? 'no_stock' : 'low_stock',
        severity: qty === 0 ? 'critical' : 'warning',
        epi_catalog_id: item.epi_catalog_id,
        epi_nome: item.epi_catalog?.nome ?? '',
        warehouse_id: item.warehouse_id,
        warehouse_name: item.warehouse?.name ?? '',
        quantidade_disponivel: qty,
        quantidade_minima: min,
        message:
          qty === 0
            ? `Sem estoque de ${item.epi_catalog?.nome} em ${item.warehouse?.name}`
            : `Estoque baixo de ${item.epi_catalog?.nome} em ${item.warehouse?.name}: ${qty}/${min}`,
      });
    }
  }

  // Expiring lot alerts via DB function
  const { data: expiringLots } = await supabase.rpc('scan_expiring_epi_lots', {
    _tenant_id: tenantId,
    _days_ahead: 30,
  });

  for (const lot of (expiringLots ?? []) as any[]) {
    alerts.push({
      type: lot.dias_restantes <= 0 ? 'lot_expired' : 'lot_expiring',
      severity: lot.dias_restantes <= 0 ? 'critical' : 'warning',
      epi_catalog_id: '',
      epi_nome: lot.epi_nome,
      lot_id: lot.lot_id,
      lote_numero: lot.lote_numero,
      dias_restantes: lot.dias_restantes,
      message:
        lot.dias_restantes <= 0
          ? `Lote ${lot.lote_numero} de ${lot.epi_nome} VENCIDO há ${Math.abs(lot.dias_restantes)} dias`
          : `Lote ${lot.lote_numero} de ${lot.epi_nome} vence em ${lot.dias_restantes} dias`,
    });
  }

  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
