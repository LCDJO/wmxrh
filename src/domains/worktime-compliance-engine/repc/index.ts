/**
 * REP-C Compliance Layer — Barrel Export
 *
 * Portaria MTP 671/2021 · CLT Art. 74
 *
 * REPCComplianceLayer
 *  ├── AFDGenerator              — Arquivo Fonte de Dados (Art. 81-84)
 *  ├── AEJGenerator              — Atestado Entrega ao Julgamento (Art. 85-88)
 *  ├── OfficialTimeSyncService   — Sincronização hora oficial (Art. 75 §3º)
 *  ├── REPCTechnicalLog          — Log técnico append-only (Art. 75-77)
 *  ├── SystemIdentificationManager — Identificação do sistema (Art. 89-92)
 *  ├── InspectionExportService   — Exportação para fiscalização (Art. 83)
 *  └── REPVersionRegistry        — Controle de versões (Art. 78-80)
 */

export { REPCComplianceLayer, getREPCComplianceLayer } from './repc-compliance-layer';
export { AFDGenerator } from './afd-generator';
export { AEJGenerator } from './aej-generator';
export { OfficialTimeSyncService } from './official-time-sync';
export { REPCTechnicalLog } from './repc-technical-log';
export { SystemIdentificationManager } from './system-identification';
export { InspectionExportService } from './inspection-export';
export { REPVersionRegistry } from './rep-version-registry';
export type * from './types';
