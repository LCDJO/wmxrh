/**
 * REP-C Compliance Layer — Types
 *
 * Portaria MTP 671/2021, Seção IV — REP-C (Registrador Eletrônico de Ponto via Programa)
 * CLT Art. 74 §2º
 *
 * Referências normativas:
 *   - Art. 75-80 da Portaria 671: Requisitos técnicos do REP-C
 *   - Art. 81-84: Arquivo Fonte de Dados (AFD)
 *   - Art. 85-88: Atestado de Entrega do Julgamento (AEJ)
 *   - Art. 89-92: Identificação do sistema e certificação
 */

// ══════════════════════════════════════════════════════════════════
// AFD — Arquivo Fonte de Dados (Portaria 671, Art. 81-84)
// ══════════════════════════════════════════════════════════════════

/** Tipo de registro no AFD conforme layout da Portaria 671 */
export type AFDRecordType =
  | '1'   // Header (identificação do empregador)
  | '2'   // Detalhe (marcação de ponto)
  | '3'   // Ajuste (inclusão/alteração)
  | '9';  // Trailer (totalizadores)

export interface AFDHeader {
  tipo_registro: '1';
  cnpj_cpf: string;           // 14 dígitos (CNPJ) ou 11 (CPF)
  cei_caepf: string;          // CEI/CAEPF (14 dígitos)
  razao_social: string;       // Razão social (até 150 chars)
  numero_registro_rep: string; // Nº registro do REP-C no MTE
  data_inicio: string;         // DDMMAAAA
  data_fim: string;            // DDMMAAAA
  data_geracao: string;        // DDMMAAAA
  hora_geracao: string;        // HHMM
}

export interface AFDDetail {
  tipo_registro: '2';
  nsr: number;                 // Número Sequencial de Registro
  data_marcacao: string;       // DDMMAAAA
  hora_marcacao: string;       // HHMM
  pis: string;                 // PIS/PASEP do trabalhador (11 dígitos)
  cpf: string;                 // CPF mascarado
  nome_empregado: string;
}

export interface AFDAdjustment {
  tipo_registro: '3';
  nsr_original: number;
  data_original: string;
  hora_original: string;
  data_nova: string;
  hora_nova: string;
  tipo_operacao: 'I' | 'A' | 'E'; // Inclusão, Alteração, Exclusão
  motivo: string;
  responsavel_cpf: string;
  data_operacao: string;
  hora_operacao: string;
}

export interface AFDTrailer {
  tipo_registro: '9';
  total_registros_tipo_2: number;
  total_registros_tipo_3: number;
  total_geral: number;
}

export type AFDRecord = AFDHeader | AFDDetail | AFDAdjustment | AFDTrailer;

export interface AFDFile {
  header: AFDHeader;
  details: AFDDetail[];
  adjustments: AFDAdjustment[];
  trailer: AFDTrailer;
  /** SHA-256 do conteúdo completo para verificação de integridade */
  content_hash: string;
  generated_at: string;
}

// ══════════════════════════════════════════════════════════════════
// AEJ — Atestado de Entrega ao Julgamento (Art. 85-88)
// ══════════════════════════════════════════════════════════════════

export interface AEJFile {
  /** Identificação do empregador */
  cnpj_cpf: string;
  razao_social: string;
  /** Período coberto */
  periodo_inicio: string;
  periodo_fim: string;
  /** Jornadas diárias */
  jornadas: AEJJornada[];
  /** Espelhos mensais por empregado */
  espelhos_mensais: AEJEspelhoMensal[];
  /** Metadados */
  generated_at: string;
  generated_by: string;
  content_hash: string;
}

export interface AEJJornada {
  pis: string;
  cpf: string;
  nome: string;
  data: string;                // DDMMAAAA
  marcacoes: string[];         // HHMM[]
  entradas: string[];          // HHMM[] — todas as entradas
  saidas: string[];            // HHMM[] — todas as saídas
  intervalos: AEJIntervalo[];  // Intervalos (intrajornada/interjornada)
  horas_trabalhadas: string;   // HH:MM
  horas_extras: string;        // HH:MM
  horas_noturnas: string;      // HH:MM
  banco_horas_saldo: string;   // +HH:MM ou -HH:MM
  faltas_atrasos: string;      // HH:MM
  observacoes: string;
}

export interface AEJIntervalo {
  inicio: string;              // HHMM
  fim: string;                 // HHMM
  duracao_minutos: number;
  tipo: 'intrajornada' | 'interjornada';
  conforme_clt: boolean;       // >= 1h para jornada > 6h
}

/** Espelho mensal agrupado por empregado */
export interface AEJEspelhoMensal {
  pis: string;
  cpf: string;
  nome: string;
  competencia: string;         // MMAAAA
  dias: AEJJornada[];
  total_horas_trabalhadas: string;
  total_horas_extras: string;
  total_horas_noturnas: string;
  total_banco_horas: string;
  total_faltas_atrasos: string;
}

// ══════════════════════════════════════════════════════════════════
// REP-C Technical Log (Art. 75-77)
// ══════════════════════════════════════════════════════════════════

export type REPCLogEventType =
  | 'system_start'
  | 'system_stop'
  | 'time_sync'
  | 'ntp_sync_success'
  | 'ntp_sync_failure'
  | 'clock_registration'
  | 'clock_adjustment'
  | 'user_login'
  | 'user_logout'
  | 'config_change'
  | 'export_generated'
  | 'inspection_request'
  | 'integrity_check'
  | 'version_update'
  | 'certificate_renewal'
  | 'error';

export interface REPCLogEntry {
  id: string;
  tenant_id: string;
  timestamp: string;             // ISO 8601 com timezone
  server_timestamp: string;
  event_type: REPCLogEventType;
  nsr?: number;
  description: string;
  actor_id?: string;
  actor_cpf?: string;
  ip_address?: string;
  metadata?: Record<string, unknown>;
  integrity_hash: string;
  previous_hash: string | null;
}

// ══════════════════════════════════════════════════════════════════
// System Identification (Art. 89-92)
// ══════════════════════════════════════════════════════════════════

export interface REPCSystemIdentification {
  /** Nome comercial do software */
  software_name: string;
  /** Versão atual do sistema */
  software_version: string;
  /** Razão social do desenvolvedor */
  developer_name: string;
  /** CNPJ do desenvolvedor */
  developer_cnpj: string;
  /** Número de registro no INPI (se aplicável) */
  inpi_registration?: string;
  /** Certificado de conformidade */
  compliance_certificate_id?: string;
  compliance_certificate_issuer?: string;
  compliance_certificate_valid_until?: string;
  /** Identificação do empregador que utiliza */
  employer_cnpj: string;
  employer_razao_social: string;
  employer_cei_caepf?: string;
  /** Data de implantação */
  deployment_date: string;
  /** URL do sistema */
  system_url?: string;
}

// ══════════════════════════════════════════════════════════════════
// REP Version Registry (Art. 78-80)
// ══════════════════════════════════════════════════════════════════

export interface REPVersion {
  id: string;
  version: string;
  release_date: string;
  changelog: string;
  is_current: boolean;
  compliance_level: 'full' | 'partial' | 'non_compliant';
  portaria_version: string;       // e.g. '671/2021'
  features: string[];
  breaking_changes: string[];
  deployed_at?: string;
  deployed_by?: string;
  content_hash: string;           // Hash do binário/código-fonte
}

// ══════════════════════════════════════════════════════════════════
// Official Time Sync (Art. 75 §3º — sincronização com hora oficial)
// ══════════════════════════════════════════════════════════════════

export interface TimeSyncResult {
  synced: boolean;
  ntp_server: string;
  local_time: string;
  server_time: string;
  offset_ms: number;
  round_trip_ms: number;
  stratum: number;
  synced_at: string;
  max_drift_ms: number;           // Máximo desvio permitido (1000ms por padrão)
  within_tolerance: boolean;
}

export interface TimeSyncConfig {
  ntp_servers: string[];           // Pool de servidores NTP
  sync_interval_minutes: number;   // Intervalo entre sincronizações
  max_drift_ms: number;            // Desvio máximo tolerado
  fallback_to_local: boolean;      // Permitir fallback sem NTP
}

// ══════════════════════════════════════════════════════════════════
// Inspection Export (Art. 83 — Disponibilização para fiscalização)
// ══════════════════════════════════════════════════════════════════

export type InspectionExportFormat = 'AFD' | 'AEJ' | 'AFDT' | 'ACJEF' | 'PDF' | 'XML';

export interface InspectionExportRequest {
  id: string;
  tenant_id: string;
  requested_by: string;            // CPF do auditor fiscal
  request_date: string;
  period_start: string;
  period_end: string;
  formats: InspectionExportFormat[];
  employee_ids?: string[];         // null = todos
  inspection_number?: string;      // Número do auto de infração
  status: 'requested' | 'generating' | 'ready' | 'delivered' | 'expired';
  files: InspectionExportFile[];
  delivered_at?: string;
  delivered_to?: string;
  notes?: string;
}

export interface InspectionExportFile {
  format: InspectionExportFormat;
  file_url: string;
  file_hash: string;
  file_size_bytes: number;
  record_count: number;
  generated_at: string;
}

// ══════════════════════════════════════════════════════════════════
// REPCComplianceLayer API
// ══════════════════════════════════════════════════════════════════

export interface REPCComplianceLayerAPI {
  afd: AFDGeneratorAPI;
  aej: AEJGeneratorAPI;
  timeSync: OfficialTimeSyncAPI;
  technicalLog: REPCTechnicalLogAPI;
  systemId: SystemIdentificationAPI;
  inspection: InspectionExportAPI;
  versions: REPVersionRegistryAPI;
}

export interface AFDGeneratorAPI {
  generate(tenantId: string, periodStart: string, periodEnd: string, employeeIds?: string[]): Promise<AFDFile>;
  validate(afd: AFDFile): { valid: boolean; errors: string[] };
  toText(afd: AFDFile): string;
}

export interface AEJGeneratorAPI {
  generate(tenantId: string, periodStart: string, periodEnd: string, employeeIds?: string[]): Promise<AEJFile>;
  validate(aej: AEJFile): { valid: boolean; errors: string[] };
  toText(aej: AEJFile): string;
}

export interface OfficialTimeSyncAPI {
  sync(): Promise<TimeSyncResult>;
  getLastSync(): TimeSyncResult | null;
  getConfig(): TimeSyncConfig;
  isWithinTolerance(): boolean;
  getServerTime(): string;
}

export interface REPCTechnicalLogAPI {
  log(tenantId: string, event: Omit<REPCLogEntry, 'id' | 'tenant_id' | 'timestamp' | 'server_timestamp' | 'integrity_hash' | 'previous_hash'>): REPCLogEntry;
  getEntries(tenantId: string, from: string, to: string): REPCLogEntry[];
  verifyChain(tenantId: string): { valid: boolean; broken_at?: string };
}

export interface SystemIdentificationAPI {
  getIdentification(tenantId: string): REPCSystemIdentification;
  updateEmployer(tenantId: string, employer: Pick<REPCSystemIdentification, 'employer_cnpj' | 'employer_razao_social' | 'employer_cei_caepf'>): void;
}

export interface InspectionExportAPI {
  createRequest(tenantId: string, request: Omit<InspectionExportRequest, 'id' | 'status' | 'files'>): Promise<InspectionExportRequest>;
  generateFiles(requestId: string): Promise<InspectionExportRequest>;
  markDelivered(requestId: string, deliveredTo: string): void;
  getRequests(tenantId: string): InspectionExportRequest[];
}

export interface REPVersionRegistryAPI {
  getCurrent(): REPVersion;
  getHistory(): REPVersion[];
  register(version: Omit<REPVersion, 'id' | 'is_current'>): REPVersion;
}
