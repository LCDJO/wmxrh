/**
 * EPI Inventory & Asset Tracking Engine
 *
 * Bounded Context: Estoque, Rastreabilidade, Custo e Movimentação de EPIs
 *
 * Integrations:
 * - EPILifecycleEngine: Delivery triggers automatic stock deduction (DB trigger)
 * - EPILifecycleEngine: Return triggers stock re-entry (DB trigger)
 * - Occupational Risk Engine: EPI requirements drive demand forecasting
 * - Safety Automation Engine: Stock alerts feed safety playbooks
 * - Payroll Simulation Engine: Employee cost tracking for total cost projection
 * - Security Kernel: RLS policies enforce tenant isolation
 */

// Types
export type {
  EpiWarehouse,
  EpiWarehouseInput,
  EpiLot,
  EpiLotInput,
  EpiInventoryPosition,
  EpiMovementType,
  EpiMovementReferenceType,
  EpiInventoryMovement,
  EpiEmployeeCost,
  EpiEmployeeCostSummary,
  StockEntryInput,
  StockAdjustmentInput,
  StockTransferInput,
  ExpiringLotResult,
  StockAlert,
} from './types';

// Inventory Service
export {
  createWarehouse,
  listWarehouses,
  registerStockEntry,
  adjustStock,
  transferStock,
  getInventoryPositions,
  getMovementHistory,
  getStockAlerts,
} from './inventory.service';

// Lot Service
export {
  createLot,
  listLots,
  getLotById,
  scanExpiringLots,
} from './lot.service';

// Cost Tracking Service
export {
  getEmployeeCostHistory,
  getEmployeeCostSummary,
  getTenantCostReport,
} from './cost-tracking.service';

// Cost Engine Integration (Payroll + Workforce Intelligence)
export {
  getEpiCostsForPayroll,
  getEpiCostIntelligence,
} from './cost-engine.integration';

export type {
  EpiCostForPayroll,
  EpiCostIntelligence,
} from './cost-engine.integration';

// Domain Events & Asset Types
export type {
  EpiAsset,
  EpiAssetStatus,
  EpiStockAlert,
  EPIStockReducedEvent,
  EPICostAllocatedEvent,
  EpiInventoryDomainEvent,
} from './types';

// Future Capabilities (Stubs)
export {
  QRCodeServiceStub,
  MobileScannerServiceStub,
  ERPIntegrationServiceStub,
  DemandForecastingServiceStub,
  RiskConsumptionBIServiceStub,
} from './future-capabilities';

export type {
  QRCodePayload,
  QRCodeGenerationResult,
  QRCodeService,
  MobileScanAction,
  MobileScanResult,
  MobileScannerService,
  ERPPurchaseOrder,
  ERPPurchaseItem,
  ERPSyncResult,
  ERPIntegrationService,
  DemandForecastItem,
  ReplenishmentPlan,
  DemandForecastingService,
  RiskConsumptionMetric,
  ConsumptionByRiskReport,
  RiskConsumptionBIService,
} from './future-capabilities';
