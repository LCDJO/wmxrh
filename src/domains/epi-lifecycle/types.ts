/**
 * EPI Lifecycle & Legal Compliance Engine — Types
 *
 * Bounded Context: Gestão do Ciclo de Vida de EPIs
 */

// ═══════════════════════════════════════════════════════
// CATALOG
// ═══════════════════════════════════════════════════════

export interface EpiCatalogItem {
  id: string;
  tenant_id: string;
  nome: string;
  descricao?: string | null;
  categoria: string;
  ca_numero?: string | null;
  ca_validade?: string | null;
  fabricante?: string | null;
  modelo?: string | null;
  nr_referencia?: number | null;
  validade_meses: number;
  requer_treinamento: boolean;
  nr_treinamento_codigo?: number | null;
  foto_url?: string | null;
  vida_util_dias?: number | null;
  exige_lote: boolean;
  rastreavel_individualmente: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════
// DELIVERY
// ═══════════════════════════════════════════════════════

export type EpiDeliveryMotivo =
  | 'entrega_inicial'
  | 'substituicao_desgaste'
  | 'substituicao_dano'
  | 'substituicao_vencimento'
  | 'novo_risco';

export type EpiDeliveryStatus =
  | 'entregue'
  | 'devolvido'
  | 'vencido'
  | 'substituido'
  | 'extraviado';

export interface EpiDelivery {
  id: string;
  tenant_id: string;
  company_id?: string | null;
  employee_id: string;
  epi_catalog_id: string;
  risk_exposure_id?: string | null;
  quantidade: number;
  motivo: EpiDeliveryMotivo;
  data_entrega: string;
  data_validade?: string | null;
  data_devolucao?: string | null;
  motivo_devolucao?: string | null;
  lote?: string | null;
  ca_numero?: string | null;
  observacoes?: string | null;
  status: EpiDeliveryStatus;
  entregue_por?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════
// SIGNATURE (Prova Jurídica)
// ═══════════════════════════════════════════════════════

export type EpiSignatureType = 'digital' | 'manuscrita_digitalizada' | 'biometrica';

export interface EpiSignature {
  id: string;
  tenant_id: string;
  delivery_id: string;
  employee_id: string;
  tipo_assinatura: EpiSignatureType;
  assinatura_hash?: string | null;
  assinatura_data?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  termo_aceite: string;
  assinado_em: string;
  documento_url?: string | null;
  is_valid: boolean;
  invalidado_em?: string | null;
  invalidado_por?: string | null;
  motivo_invalidacao?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ═══════════════════════════════════════════════════════
// RISK MAPPING
// ═══════════════════════════════════════════════════════

export interface EpiRiskMapping {
  id: string;
  tenant_id: string;
  epi_catalog_id: string;
  risk_agent: string;
  nr_aplicavel?: number | null;
  obrigatorio: boolean;
  descricao?: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════════════════
// AUDIT
// ═══════════════════════════════════════════════════════

export type EpiAuditAction =
  | 'entrega'
  | 'assinatura'
  | 'substituicao'
  | 'devolucao'
  | 'vencimento_detectado'
  | 'extravio'
  | 'invalidacao_assinatura';

export interface EpiAuditEntry {
  id: string;
  tenant_id: string;
  delivery_id?: string | null;
  employee_id?: string | null;
  action: EpiAuditAction;
  executor: string;
  executor_user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ═══════════════════════════════════════════════════════
// EXPIRED EPI SCAN RESULT
// ═══════════════════════════════════════════════════════

export interface ExpiredEpiResult {
  delivery_id: string;
  employee_id: string;
  employee_name: string;
  epi_nome: string;
  data_validade: string;
  dias_vencido: number;
}

// ═══════════════════════════════════════════════════════
// SERVICE PORTS
// ═══════════════════════════════════════════════════════

export interface EpiDeliveryInput {
  tenant_id: string;
  company_id?: string;
  employee_id: string;
  epi_catalog_id: string;
  risk_exposure_id?: string;
  quantidade?: number;
  motivo?: EpiDeliveryMotivo;
  data_entrega?: string;
  lote?: string;
  ca_numero?: string;
  observacoes?: string;
}

export interface EpiSignatureInput {
  tenant_id: string;
  delivery_id: string;
  employee_id: string;
  tipo_assinatura?: EpiSignatureType;
  assinatura_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  termo_aceite?: string;
}

export interface EpiReplacementInput {
  tenant_id: string;
  old_delivery_id: string;
  motivo: EpiDeliveryMotivo;
  observacoes?: string;
}
