/**
 * Automated Hiring — Etapa 5: Entrega de EPI
 *
 * Manages mandatory PPE (EPI) delivery, delivery term generation,
 * and digital signature requirement before employee activation.
 *
 * Rules (NR-6):
 * - Employer MUST provide EPI adequate to risks, free of charge
 * - Employee MUST sign delivery term (termo de entrega)
 * - Without signed term → activation blocked
 * - EPI must have valid CA (Certificado de Aprovação)
 *
 * Integrations:
 * - EPILifecycleEngine (EPI catalog, CA validation)
 * - Employee Agreement Engine (delivery term + digital signature)
 * - Occupational Intelligence (required EPIs by position)
 */

import type { HiringWorkflow, ComplianceBlocker } from './types';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export interface EpiRequirement {
  category: string;
  description: string;
  ca_number: string | null;
  ca_valid: boolean;
  legal_basis: string;
  risk_agent: string | null;
}

export interface EpiDeliveryRecord {
  requirement: EpiRequirement;
  delivered: boolean;
  delivered_at: string | null;
  quantity: number;
  batch_number: string | null;
}

export interface EpiDeliveryTerm {
  term_id: string;
  employee_name: string;
  employee_cpf: string;
  items: EpiDeliveryRecord[];
  generated_at: string;
  signed: boolean;
  signed_at: string | null;
  signature_method: 'digital' | 'manual' | null;
  signature_hash: string | null;
}

export interface EpiEtapaInput {
  /** Required EPI categories from Etapa 2 */
  required_epi_categories: string[];
  /** Risk agents from Etapa 2 */
  risk_agents: string[];
  /** Delivery records filled by HR */
  deliveries: EpiDeliveryRecord[];
  /** Delivery term with signature status */
  delivery_term: EpiDeliveryTerm | null;
}

export interface EpiEtapaResult {
  valid: boolean;
  blockers: ComplianceBlocker[];
  warnings: ComplianceBlocker[];
  requirements: EpiRequirement[];
  delivered_count: number;
  pending_count: number;
  term_signed: boolean;
  evaluated_at: string;
}

// ═══════════════════════════════════════════════
//  EPI Category → Requirement Mapping
// ═══════════════════════════════════════════════

interface EpiSpec {
  description: string;
  legal_basis: string;
  risk_agent: string | null;
}

const EPI_CATALOG: Record<string, EpiSpec> = {
  'capacete_seguranca':     { description: 'Capacete de segurança classe A/B',           legal_basis: 'NR-6, Anexo I-A',  risk_agent: 'impacto_cranio' },
  'oculos_protecao':        { description: 'Óculos de proteção contra impactos',         legal_basis: 'NR-6, Anexo I-B',  risk_agent: 'particulas_volantes' },
  'protetor_auricular':     { description: 'Protetor auricular tipo inserção/concha',    legal_basis: 'NR-6, Anexo I-C',  risk_agent: 'ruido' },
  'luva_protecao':          { description: 'Luvas de proteção (conforme risco)',          legal_basis: 'NR-6, Anexo I-F',  risk_agent: null },
  'luva_isolante':          { description: 'Luva isolante de borracha',                  legal_basis: 'NR-6, Anexo I-F / NR-10', risk_agent: 'eletricidade' },
  'calcado_seguranca':      { description: 'Calçado de segurança com biqueira',          legal_basis: 'NR-6, Anexo I-G',  risk_agent: 'impacto_pes' },
  'bota_borracha':          { description: 'Bota de borracha cano longo',                legal_basis: 'NR-6, Anexo I-G',  risk_agent: 'umidade' },
  'cinto_seguranca':        { description: 'Cinto de segurança tipo paraquedista',       legal_basis: 'NR-6, Anexo I-H / NR-35', risk_agent: 'altura' },
  'talabarte':              { description: 'Talabarte de segurança com ABS',             legal_basis: 'NR-6, Anexo I-H / NR-35', risk_agent: 'altura' },
  'respirador':             { description: 'Respirador semifacial PFF2/PFF3',            legal_basis: 'NR-6, Anexo I-D',  risk_agent: 'poeira_quimico' },
  'mascara_solda':          { description: 'Máscara de solda com filtro auto-escurecimento', legal_basis: 'NR-6, Anexo I-B', risk_agent: 'radiacao' },
  'avental_protecao':       { description: 'Avental de proteção (PVC/raspa)',            legal_basis: 'NR-6, Anexo I-E',  risk_agent: null },
  'manga_protecao':         { description: 'Manga de proteção contra calor/corte',      legal_basis: 'NR-6, Anexo I-E',  risk_agent: 'termico' },
  'protetor_facial':        { description: 'Protetor facial tipo escudo',                legal_basis: 'NR-6, Anexo I-B',  risk_agent: 'projecao_particulas' },
  'vestimenta_conducao':    { description: 'Vestimenta condutiva para eletricidade',     legal_basis: 'NR-6, Anexo I-E / NR-10', risk_agent: 'eletricidade' },
  'creme_protecao':         { description: 'Creme de proteção (grupo 1/2/3)',            legal_basis: 'NR-6, Anexo I-I',  risk_agent: 'quimico_pele' },
};

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function mkBlocker(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'blocker', message: msg, legal_basis: basis ?? null, step: 'epi_assignment' };
}

function mkWarning(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'warning', message: msg, legal_basis: basis ?? null, step: 'epi_assignment' };
}

// ═══════════════════════════════════════════════
//  Engine
// ═══════════════════════════════════════════════

/**
 * Build EPI requirements from categories identified in Etapa 2.
 */
export function buildEpiRequirements(categories: string[], riskAgents: string[]): EpiRequirement[] {
  const requirements: EpiRequirement[] = [];

  for (const cat of categories) {
    const spec = EPI_CATALOG[cat];
    if (spec) {
      requirements.push({
        category: cat,
        description: spec.description,
        ca_number: null,
        ca_valid: false,
        legal_basis: spec.legal_basis,
        risk_agent: spec.risk_agent,
      });
    } else {
      requirements.push({
        category: cat,
        description: `EPI — ${cat}`,
        ca_number: null,
        ca_valid: false,
        legal_basis: 'NR-6',
        risk_agent: null,
      });
    }
  }

  return requirements;
}

/**
 * Generate a delivery term for digital signature.
 */
export function generateDeliveryTerm(
  employeeName: string,
  employeeCpf: string,
  deliveries: EpiDeliveryRecord[],
): EpiDeliveryTerm {
  return {
    term_id: crypto.randomUUID(),
    employee_name: employeeName,
    employee_cpf: employeeCpf,
    items: deliveries,
    generated_at: new Date().toISOString(),
    signed: false,
    signed_at: null,
    signature_method: null,
    signature_hash: null,
  };
}

/**
 * Validate EPI delivery step — checks delivery, CA, and signature.
 */
export function validateEpiDelivery(input: EpiEtapaInput): EpiEtapaResult {
  const blockers: ComplianceBlocker[] = [];
  const warnings: ComplianceBlocker[] = [];

  const requirements = buildEpiRequirements(input.required_epi_categories, input.risk_agents);

  if (requirements.length === 0) {
    // No EPI required — step can be skipped
    return {
      valid: true,
      blockers: [],
      warnings: [],
      requirements: [],
      delivered_count: 0,
      pending_count: 0,
      term_signed: true,
      evaluated_at: new Date().toISOString(),
    };
  }

  // ── 1. Check each required EPI was delivered ──
  const deliveredCategories = new Set(
    input.deliveries.filter(d => d.delivered).map(d => d.requirement.category),
  );

  const pendingCategories: string[] = [];
  for (const req of requirements) {
    if (!deliveredCategories.has(req.category)) {
      pendingCategories.push(req.description);
    }
  }

  if (pendingCategories.length > 0) {
    blockers.push(mkBlocker(
      'EPI_NOT_DELIVERED',
      `${pendingCategories.length} EPI(s) obrigatório(s) não entregue(s): ${pendingCategories.join(', ')}`,
      'NR-6, item 6.3',
    ));
  }

  // ── 2. Check CA validity for delivered EPIs ──
  for (const delivery of input.deliveries) {
    if (delivery.delivered && !delivery.requirement.ca_valid) {
      warnings.push(mkWarning(
        `EPI_CA_INVALID_${delivery.requirement.category.toUpperCase()}`,
        `EPI "${delivery.requirement.description}" sem CA válido — verificar certificação`,
        'NR-6, item 6.2',
      ));
    }
  }

  // ── 3. Delivery term existence ──
  if (!input.delivery_term) {
    blockers.push(mkBlocker(
      'EPI_NO_TERM',
      'Termo de entrega de EPI não gerado',
      'NR-6, item 6.6.1-d',
    ));
  } else if (!input.delivery_term.signed) {
    // ── 4. Digital signature ──
    blockers.push(mkBlocker(
      'EPI_TERM_NOT_SIGNED',
      'Termo de entrega de EPI não assinado digitalmente — assinatura obrigatória para ativação',
      'NR-6, item 6.6.1-d',
    ));
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
    requirements,
    delivered_count: deliveredCategories.size,
    pending_count: pendingCategories.length,
    term_signed: input.delivery_term?.signed ?? false,
    evaluated_at: new Date().toISOString(),
  };
}

/**
 * Apply Etapa 5 to workflow state machine.
 */
export function applyEpiDeliveryToWorkflow(
  workflow: HiringWorkflow,
  input: EpiEtapaInput,
): { workflow: HiringWorkflow; result: EpiEtapaResult } {
  const result = validateEpiDelivery(input);
  const now = new Date().toISOString();

  const epiStep = workflow.steps.find(s => s.step === 'epi_assignment')!;

  if (result.valid) {
    epiStep.status = 'completed';
    epiStep.completed_at = now;
    epiStep.error_message = null;
    epiStep.metadata = {
      requirements_count: result.requirements.length,
      delivered_count: result.delivered_count,
      term_id: input.delivery_term?.term_id,
      term_signed: true,
      signature_method: input.delivery_term?.signature_method,
      signature_hash: input.delivery_term?.signature_hash,
      validated_at: now,
    };

    // Advance to agreements
    workflow.current_step = 'agreements';
    const agreementStep = workflow.steps.find(s => s.step === 'agreements')!;
    agreementStep.status = 'in_progress';
    agreementStep.started_at = now;
  } else {
    epiStep.status = 'blocked';
    epiStep.error_message = result.blockers.map(b => b.message).join('; ');
    epiStep.metadata = {
      requirements_count: result.requirements.length,
      delivered_count: result.delivered_count,
      pending_count: result.pending_count,
      term_signed: result.term_signed,
    };
  }

  workflow.updated_at = now;
  return { workflow, result };
}
