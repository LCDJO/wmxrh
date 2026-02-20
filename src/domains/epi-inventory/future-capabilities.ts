/**
 * EPI Inventory — Future Capabilities (Stubs)
 *
 * Preparação para funcionalidades futuras:
 *   1. QR Code por unidade (rastreabilidade individual)
 *   2. Leitura via mobile (scanner integration)
 *   3. Integração ERP compras (purchase order sync)
 *   4. Previsão automática de reposição (demand forecasting)
 *   5. BI de consumo por risco (analytics cross-referencing risk factors)
 */

// ═══════════════════════════════════════════════════════
// 1. QR CODE POR UNIDADE
// ═══════════════════════════════════════════════════════

export interface QRCodePayload {
  asset_id: string;
  serial_number: string;
  epi_catalog_id: string;
  lot_id?: string;
  tenant_id: string;
  generated_at: string;
}

export interface QRCodeGenerationResult {
  asset_id: string;
  qr_data_url: string;       // base64 PNG
  qr_payload: QRCodePayload;
  print_label_url?: string;   // PDF for label printing
}

export interface QRCodeService {
  /** Generate QR code for a single tracked asset */
  generateForAsset(assetId: string, tenantId: string): Promise<QRCodeGenerationResult>;
  /** Bulk generate QR codes for all assets in a lot */
  generateForLot(lotId: string, tenantId: string): Promise<QRCodeGenerationResult[]>;
  /** Generate printable label sheet (PDF) */
  generateLabelSheet(assetIds: string[], tenantId: string): Promise<{ pdf_url: string }>;
  /** Decode a QR payload string back to structured data */
  decodePayload(qrString: string): QRCodePayload | null;
}

/** Stub implementation — returns not-implemented errors */
export const QRCodeServiceStub: QRCodeService = {
  async generateForAsset() {
    throw new Error('[QRCodeService] Not implemented. Planned for future release.');
  },
  async generateForLot() {
    throw new Error('[QRCodeService] Not implemented. Planned for future release.');
  },
  async generateLabelSheet() {
    throw new Error('[QRCodeService] Not implemented. Planned for future release.');
  },
  decodePayload() {
    console.warn('[QRCodeService] Not implemented. Planned for future release.');
    return null;
  },
};

// ═══════════════════════════════════════════════════════
// 2. LEITURA VIA MOBILE (Scanner Integration)
// ═══════════════════════════════════════════════════════

export type MobileScanAction =
  | 'identify'         // Look up asset info
  | 'deliver'          // Register delivery via scan
  | 'return'           // Register return via scan
  | 'inspect'          // Start inspection checklist
  | 'transfer';        // Transfer between warehouses

export interface MobileScanResult {
  action: MobileScanAction;
  asset: QRCodePayload | null;
  employee_id?: string;
  warehouse_id?: string;
  timestamp: string;
  gps_coordinates?: { lat: number; lng: number };
}

export interface MobileScannerService {
  /** Process a scanned QR code and determine the action */
  processScan(qrData: string, userId: string, action: MobileScanAction): Promise<MobileScanResult>;
  /** Register a delivery by scanning asset + employee badge */
  scanDelivery(assetQr: string, employeeBadgeQr: string, userId: string): Promise<{ delivery_id: string }>;
  /** Register a return by scanning asset */
  scanReturn(assetQr: string, userId: string): Promise<{ return_id: string }>;
  /** Get scan history for audit */
  getScanHistory(tenantId: string, limit?: number): Promise<MobileScanResult[]>;
}

export const MobileScannerServiceStub: MobileScannerService = {
  async processScan() {
    throw new Error('[MobileScannerService] Not implemented. Planned for Capacitor/PWA integration.');
  },
  async scanDelivery() {
    throw new Error('[MobileScannerService] Not implemented. Planned for Capacitor/PWA integration.');
  },
  async scanReturn() {
    throw new Error('[MobileScannerService] Not implemented. Planned for Capacitor/PWA integration.');
  },
  async getScanHistory() {
    throw new Error('[MobileScannerService] Not implemented. Planned for Capacitor/PWA integration.');
  },
};

// ═══════════════════════════════════════════════════════
// 3. INTEGRAÇÃO ERP COMPRAS
// ═══════════════════════════════════════════════════════

export interface ERPPurchaseOrder {
  erp_order_id: string;
  erp_system: string;              // 'totvs' | 'sap' | 'senior' | 'sankhya' | 'custom'
  supplier_cnpj: string;
  supplier_name: string;
  items: ERPPurchaseItem[];
  total_value: number;
  currency: string;
  status: 'draft' | 'approved' | 'sent' | 'received' | 'cancelled';
  expected_delivery_date: string;
  nota_fiscal?: string;
  created_at: string;
}

export interface ERPPurchaseItem {
  epi_catalog_id: string;
  epi_name: string;
  quantidade: number;
  custo_unitario: number;
  custo_total: number;
  ca_numero?: string;
}

export interface ERPSyncResult {
  orders_synced: number;
  items_received: number;
  stock_entries_created: number;
  errors: Array<{ order_id: string; error: string }>;
  synced_at: string;
}

export interface ERPIntegrationService {
  /** Sync pending purchase orders from ERP */
  syncPurchaseOrders(tenantId: string): Promise<ERPSyncResult>;
  /** Create a purchase requisition based on stock needs */
  createRequisition(tenantId: string, items: ERPPurchaseItem[]): Promise<{ requisition_id: string }>;
  /** Confirm goods receipt and auto-create stock entries */
  confirmReceipt(tenantId: string, orderId: string, notaFiscal: string): Promise<{ entries_created: number }>;
  /** Get integration status */
  getStatus(tenantId: string): Promise<{ connected: boolean; last_sync: string | null; erp_system: string }>;
}

export const ERPIntegrationServiceStub: ERPIntegrationService = {
  async syncPurchaseOrders() {
    throw new Error('[ERPIntegrationService] Not implemented. Requires ERP adapter configuration.');
  },
  async createRequisition() {
    throw new Error('[ERPIntegrationService] Not implemented. Requires ERP adapter configuration.');
  },
  async confirmReceipt() {
    throw new Error('[ERPIntegrationService] Not implemented. Requires ERP adapter configuration.');
  },
  async getStatus() {
    return { connected: false, last_sync: null, erp_system: 'none' };
  },
};

// ═══════════════════════════════════════════════════════
// 4. PREVISÃO AUTOMÁTICA DE REPOSIÇÃO
// ═══════════════════════════════════════════════════════

export interface DemandForecastItem {
  epi_catalog_id: string;
  epi_name: string;
  warehouse_id: string;
  current_stock: number;
  avg_daily_consumption: number;    // based on last 90 days
  dias_cobertura: number;           // days until stockout
  suggested_order_qty: number;      // to cover next 60 days
  suggested_order_date: string;     // when to place order
  confidence: number;               // 0-1
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface ReplenishmentPlan {
  tenant_id: string;
  generated_at: string;
  horizon_days: number;
  items: DemandForecastItem[];
  total_estimated_cost: number;
  critical_items: number;           // items with < 7 days coverage
  warning_items: number;            // items with < 30 days coverage
}

export interface DemandForecastingService {
  /** Generate replenishment plan for a tenant */
  generatePlan(tenantId: string, horizonDays?: number): Promise<ReplenishmentPlan>;
  /** Get forecast for a specific EPI */
  forecastItem(tenantId: string, epiCatalogId: string): Promise<DemandForecastItem>;
  /** Get seasonal adjustment factors */
  getSeasonalFactors(tenantId: string): Promise<Record<string, number[]>>;
  /** Auto-create purchase requisitions for critical items */
  autoRequisition(tenantId: string): Promise<{ requisitions_created: number }>;
}

export const DemandForecastingServiceStub: DemandForecastingService = {
  async generatePlan() {
    throw new Error('[DemandForecastingService] Not implemented. Requires consumption history analysis module.');
  },
  async forecastItem() {
    throw new Error('[DemandForecastingService] Not implemented. Requires consumption history analysis module.');
  },
  async getSeasonalFactors() {
    throw new Error('[DemandForecastingService] Not implemented. Requires consumption history analysis module.');
  },
  async autoRequisition() {
    throw new Error('[DemandForecastingService] Not implemented. Requires ERP integration.');
  },
};

// ═══════════════════════════════════════════════════════
// 5. BI DE CONSUMO POR RISCO
// ═══════════════════════════════════════════════════════

export interface RiskConsumptionMetric {
  risk_factor_id: string;
  risk_factor_name: string;
  risk_category: string;           // 'fisico' | 'quimico' | 'biologico' | 'ergonomico' | 'acidente'
  employees_exposed: number;
  epis_required: number;
  epis_delivered: number;
  compliance_rate: number;          // 0-100%
  total_cost_period: number;
  avg_cost_per_employee: number;
  replacement_frequency: number;    // avg replacements per employee per year
  most_consumed_epi: string;
  trend_vs_previous: number;        // % change vs previous period
}

export interface ConsumptionByRiskReport {
  tenant_id: string;
  period_start: string;
  period_end: string;
  metrics: RiskConsumptionMetric[];
  total_cost: number;
  total_employees: number;
  overall_compliance: number;
  top_cost_drivers: Array<{ risk_factor: string; cost: number; percentage: number }>;
  recommendations: string[];
}

export interface RiskConsumptionBIService {
  /** Generate consumption-by-risk report */
  generateReport(tenantId: string, periodStart: string, periodEnd: string): Promise<ConsumptionByRiskReport>;
  /** Get time-series data for charts */
  getTimeSeries(tenantId: string, riskFactorId: string, granularity: 'daily' | 'weekly' | 'monthly'): Promise<Array<{ date: string; cost: number; deliveries: number }>>;
  /** Compare consumption across risk categories */
  compareCategoryConsumption(tenantId: string): Promise<Array<{ category: string; cost: number; deliveries: number; employees: number }>>;
  /** Predict future costs based on risk exposure trends */
  predictCosts(tenantId: string, months: number): Promise<{ predicted_total: number; confidence: number; by_category: Record<string, number> }>;
}

export const RiskConsumptionBIServiceStub: RiskConsumptionBIService = {
  async generateReport() {
    throw new Error('[RiskConsumptionBIService] Not implemented. Requires BI analytics module.');
  },
  async getTimeSeries() {
    throw new Error('[RiskConsumptionBIService] Not implemented. Requires BI analytics module.');
  },
  async compareCategoryConsumption() {
    throw new Error('[RiskConsumptionBIService] Not implemented. Requires BI analytics module.');
  },
  async predictCosts() {
    throw new Error('[RiskConsumptionBIService] Not implemented. Requires BI analytics and ML module.');
  },
};
