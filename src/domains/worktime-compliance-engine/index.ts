/**
 * WorkTime Compliance Engine — Barrel Export
 *
 * Motor de registro de ponto eletrônico 100% aderente à legislação brasileira
 * (Portaria 671/2021, CLT Art. 74).
 *
 * API-first · Antifraude · Imutável · Auditável · Mobile-ready
 *
 * Arquitetura:
 *   WorkTimeEngine
 *    ├── TimeEntryController      — Registro e ajuste de ponto
 *    ├── GeoFenceValidator        — Validação de geofence
 *    ├── DeviceIntegrityValidator  — Registro e validação de dispositivos
 *    ├── ImmutableTimeLedger      — Ledger append-only com chain verification
 *    ├── TimeComplianceAuditor    — Auditoria CLT + Portaria 671
 *    ├── TimeExportService        — Exportação AFD/AFDT/ACJEF/AEJ
 *    └── AntiFraudAnalyzer        — Detecção de fraude de ponto
 *
 * Integrações:
 *   - Tenant IAM (isolamento por tenant)
 *   - ComplianceAutomationEngine (auditorias automatizadas)
 *   - AccountEnforcementEngine (bloqueio por fraude)
 *   - API Management (controle de acesso)
 *   - Control Plane (configuração por tenant)
 *   - Audit Logger (trilha de auditoria)
 */

export { WorkTimeEngine, getWorkTimeEngine } from './worktime-engine';
export { TimeEntryController } from './time-entry-controller';
export { GeoFenceValidator } from './geofence-validator';
export { DeviceIntegrityValidator } from './device-integrity-validator';
export { ImmutableTimeLedger } from './immutable-time-ledger';
export { TimeComplianceAuditor } from './time-compliance-auditor';
export { TimeExportService } from './time-export-service';
export { AntiFraudAnalyzer } from './anti-fraud-analyzer';
export { computeEntryHash, computeAdjustmentHash, computeEntryHashSHA256, computeAdjustmentHashSHA256, verifyHashChain } from './integrity';
export type * from './types';

// ── REP-C Compliance Layer (Portaria 671/2021) ──
export {
  REPCComplianceLayer, getREPCComplianceLayer,
  AFDGenerator, AEJGenerator, OfficialTimeSyncService,
  REPCTechnicalLog, SystemIdentificationManager,
  InspectionExportService, REPVersionRegistry,
} from './repc';
export type * from './repc/types';
