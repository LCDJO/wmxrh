/**
 * EPI Inventory & Asset Tracking Engine — Types
 *
 * Bounded Context: Estoque, Rastreabilidade, Custo e Movimentação de EPIs
 */

// ═══════════════════════════════════════════════════════
// WAREHOUSE
// ═══════════════════════════════════════════════════════

export interface EpiWarehouse {
  id: string;
  tenant_id: string;
  company_id?: string | null;
  name: string;
  code: string;
  address?: string | null;
  is_active: boolean;
  responsible_user_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface EpiWarehouseInput {
  tenant_id: string;
  company_id?: string;
  name: string;
  code: string;
  address?: string;
  responsible_user_id?: string;
}

// ═══════════════════════════════════════════════════════
// LOT (Rastreabilidade de Lote)
// ═══════════════════════════════════════════════════════

export interface EpiLot {
  id: string;
  tenant_id: string;
  epi_catalog_id: string;
  lote_numero: string;
  lote_fabricacao?: string | null;
  lote_validade?: string | null;
  serial_number?: string | null;
  fabricante?: string | null;
  nota_fiscal?: string | null;
  nota_fiscal_data?: string | null;
  custo_unitario: number;
  quantidade_recebida: number;
  fornecedor?: string | null;
  ca_numero?: string | null;
  ca_validade?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EpiLotInput {
  tenant_id: string;
  epi_catalog_id: string;
  lote_numero: string;
  lote_fabricacao?: string;
  lote_validade?: string;
  serial_number?: string;
  fabricante?: string;
  nota_fiscal?: string;
  nota_fiscal_data?: string;
  custo_unitario: number;
  quantidade_recebida: number;
  fornecedor?: string;
  ca_numero?: string;
  ca_validade?: string;
}

// ═══════════════════════════════════════════════════════
// INVENTORY (Posição de Estoque)
// ═══════════════════════════════════════════════════════

export interface EpiInventoryPosition {
  id: string;
  tenant_id: string;
  warehouse_id: string;
  epi_catalog_id: string;
  lot_id?: string | null;
  quantidade_disponivel: number;
  quantidade_reservada: number;
  quantidade_minima: number;
  custo_unitario_medio: number;
  last_movement_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════
// MOVEMENTS (Movimentação de Estoque)
// ═══════════════════════════════════════════════════════

export type EpiMovementType =
  | 'entrada'
  | 'saida_entrega'
  | 'saida_perda'
  | 'ajuste'
  | 'transferencia'
  | 'devolucao';

export type EpiMovementReferenceType =
  | 'delivery'
  | 'purchase'
  | 'adjustment'
  | 'transfer'
  | 'return'
  | 'incident';

export interface EpiInventoryMovement {
  id: string;
  tenant_id: string;
  inventory_id: string;
  warehouse_id: string;
  epi_catalog_id: string;
  lot_id?: string | null;
  movement_type: EpiMovementType;
  quantidade: number;
  custo_unitario?: number | null;
  custo_total?: number | null;
  reference_type?: EpiMovementReferenceType | null;
  reference_id?: string | null;
  delivery_id?: string | null;
  employee_id?: string | null;
  nota_fiscal?: string | null;
  justificativa?: string | null;
  executor_user_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ═══════════════════════════════════════════════════════
// EMPLOYEE COST TRACKING
// ═══════════════════════════════════════════════════════

export interface EpiEmployeeCost {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id?: string | null;
  epi_catalog_id: string;
  delivery_id?: string | null;
  lot_id?: string | null;
  quantidade: number;
  custo_unitario: number;
  custo_total: number;
  data_apropriacao: string;
  centro_custo?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EpiEmployeeCostSummary {
  epi_nome: string;
  total_quantidade: number;
  custo_total_acumulado: number;
}

// ═══════════════════════════════════════════════════════
// SERVICE PORTS
// ═══════════════════════════════════════════════════════

export interface StockEntryInput {
  tenant_id: string;
  warehouse_id: string;
  epi_catalog_id: string;
  lot_id?: string;
  quantidade: number;
  custo_unitario: number;
  nota_fiscal?: string;
  justificativa?: string;
}

export interface StockAdjustmentInput {
  tenant_id: string;
  inventory_id: string;
  quantidade_ajuste: number; // positive = add, negative = subtract
  justificativa: string;
}

export interface StockTransferInput {
  tenant_id: string;
  source_inventory_id: string;
  target_warehouse_id: string;
  quantidade: number;
  justificativa?: string;
}

export interface ExpiringLotResult {
  lot_id: string;
  epi_nome: string;
  lote_numero: string;
  lote_validade: string;
  dias_restantes: number;
  quantidade_em_estoque: number;
}

// ═══════════════════════════════════════════════════════
// ALERTS & THRESHOLDS
// ═══════════════════════════════════════════════════════

export interface StockAlert {
  type: 'low_stock' | 'lot_expiring' | 'lot_expired' | 'no_stock';
  severity: 'info' | 'warning' | 'critical';
  epi_catalog_id: string;
  epi_nome: string;
  warehouse_id?: string;
  warehouse_name?: string;
  lot_id?: string;
  lote_numero?: string;
  quantidade_disponivel?: number;
  quantidade_minima?: number;
  dias_restantes?: number;
  message: string;
}
