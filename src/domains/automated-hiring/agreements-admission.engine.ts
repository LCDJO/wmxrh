/**
 * Automated Hiring — Etapa 6: Termos Obrigatórios
 *
 * Auto-generates mandatory agreements based on position profile
 * and blocks activation until all required terms are signed.
 *
 * Mandatory for ALL hires:
 * - Contrato de Trabalho (CLT Art. 442)
 * - Termo LGPD — consentimento de dados (Lei 13.709/2018)
 * - Termo de Uso de Imagem (CC Art. 20)
 *
 * Conditional (based on position/fleet):
 * - Termo de Uso de Veículo (fleet positions)
 * - Termo de Monitoramento GPS (fleet positions)
 * - Termo de Confidencialidade (sensitive roles)
 * - Termo de Responsabilidade Ferramentas (tool-using roles)
 *
 * Integrations:
 * - Employee Agreement Engine (template + signature)
 * - Fleet Compliance Engine (vehicle/GPS terms)
 * - Security Kernel (audit trail)
 */

import type { HiringWorkflow, ComplianceBlocker } from './types';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export type AgreementCategory =
  | 'contrato_trabalho'
  | 'termo_lgpd'
  | 'termo_imagem'
  | 'termo_veiculo'
  | 'termo_gps'
  | 'termo_confidencialidade'
  | 'termo_ferramentas'
  | 'termo_epi'
  | 'termo_uniforme';

export interface RequiredAgreement {
  category: AgreementCategory;
  name: string;
  description: string;
  legal_basis: string;
  mandatory: boolean;
  /** Only required if condition is met */
  conditional: boolean;
  condition_description: string | null;
}

export interface AgreementSignatureStatus {
  category: AgreementCategory;
  agreement_template_id: string | null;
  generated: boolean;
  generated_at: string | null;
  signed: boolean;
  signed_at: string | null;
  signature_method: 'digital' | 'manual' | null;
  signature_hash: string | null;
  witness_required: boolean;
  witness_signed: boolean;
}

export interface AgreementEtapaInput {
  /** Position flags that determine conditional terms */
  uses_vehicle: boolean;
  uses_gps_monitoring: boolean;
  handles_confidential_data: boolean;
  uses_company_tools: boolean;
  requires_uniform: boolean;
  /** Signature statuses filled by HR / employee */
  signatures: AgreementSignatureStatus[];
}

export interface AgreementEtapaResult {
  valid: boolean;
  blockers: ComplianceBlocker[];
  warnings: ComplianceBlocker[];
  required_agreements: RequiredAgreement[];
  signed_count: number;
  pending_count: number;
  evaluated_at: string;
}

// ═══════════════════════════════════════════════
//  Agreement Catalog
// ═══════════════════════════════════════════════

interface AgreementSpec {
  name: string;
  description: string;
  legal_basis: string;
  mandatory: boolean;
  condition?: (input: AgreementEtapaInput) => boolean;
  condition_description?: string;
  witness_required: boolean;
}

const AGREEMENT_CATALOG: Record<AgreementCategory, AgreementSpec> = {
  contrato_trabalho: {
    name: 'Contrato Individual de Trabalho',
    description: 'Contrato formal de trabalho conforme CLT, definindo cargo, salário, jornada e demais condições',
    legal_basis: 'CLT Art. 442 / Art. 29',
    mandatory: true,
    witness_required: true,
  },
  termo_lgpd: {
    name: 'Termo de Consentimento LGPD',
    description: 'Consentimento para tratamento de dados pessoais conforme Lei Geral de Proteção de Dados',
    legal_basis: 'Lei 13.709/2018 (LGPD), Art. 7º e 8º',
    mandatory: true,
    witness_required: false,
  },
  termo_imagem: {
    name: 'Termo de Uso de Imagem',
    description: 'Autorização para uso de imagem em crachá, sistemas internos e comunicação corporativa',
    legal_basis: 'CC Art. 20 / CF Art. 5º, X',
    mandatory: true,
    witness_required: false,
  },
  termo_veiculo: {
    name: 'Termo de Responsabilidade — Uso de Veículo',
    description: 'Responsabilidade sobre veículo corporativo, multas e conservação',
    legal_basis: 'CC Art. 462 / Política Interna de Frota',
    mandatory: false,
    condition: (input) => input.uses_vehicle,
    condition_description: 'Cargo envolve uso de veículo corporativo',
    witness_required: true,
  },
  termo_gps: {
    name: 'Termo de Ciência — Monitoramento GPS',
    description: 'Ciência de monitoramento por GPS em veículos e dispositivos corporativos',
    legal_basis: 'LGPD Art. 7º, V / TST — poder diretivo',
    mandatory: false,
    condition: (input) => input.uses_gps_monitoring,
    condition_description: 'Cargo sujeito a monitoramento GPS',
    witness_required: false,
  },
  termo_confidencialidade: {
    name: 'Termo de Confidencialidade (NDA)',
    description: 'Sigilo sobre informações confidenciais e dados sensíveis da empresa',
    legal_basis: 'CLT Art. 482, g / Lei 9.279/96',
    mandatory: false,
    condition: (input) => input.handles_confidential_data,
    condition_description: 'Cargo com acesso a dados confidenciais',
    witness_required: true,
  },
  termo_ferramentas: {
    name: 'Termo de Responsabilidade — Ferramentas e Equipamentos',
    description: 'Responsabilidade sobre ferramentas, notebooks e equipamentos fornecidos',
    legal_basis: 'CLT Art. 462, §1º',
    mandatory: false,
    condition: (input) => input.uses_company_tools,
    condition_description: 'Cargo utiliza ferramentas/equipamentos da empresa',
    witness_required: false,
  },
  termo_epi: {
    name: 'Termo de Entrega de EPI',
    description: 'Registro de entrega de equipamentos de proteção individual',
    legal_basis: 'NR-6, item 6.6.1-d',
    mandatory: false,
    // EPI term is handled in Etapa 5, so always false here
    condition: () => false,
    condition_description: 'Gerenciado na Etapa 5 — Entrega de EPI',
    witness_required: false,
  },
  termo_uniforme: {
    name: 'Termo de Entrega de Uniforme',
    description: 'Registro de entrega de uniformes e vestimentas corporativas',
    legal_basis: 'CLT Art. 456-A',
    mandatory: false,
    condition: (input) => input.requires_uniform,
    condition_description: 'Cargo exige uniforme',
    witness_required: false,
  },
};

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function mkBlocker(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'blocker', message: msg, legal_basis: basis ?? null, step: 'agreements' };
}

function mkWarning(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'warning', message: msg, legal_basis: basis ?? null, step: 'agreements' };
}

// ═══════════════════════════════════════════════
//  Engine
// ═══════════════════════════════════════════════

/**
 * Determine which agreements are required based on position profile.
 */
export function resolveRequiredAgreements(input: AgreementEtapaInput): RequiredAgreement[] {
  const result: RequiredAgreement[] = [];

  for (const [cat, spec] of Object.entries(AGREEMENT_CATALOG)) {
    const category = cat as AgreementCategory;
    const isConditional = !spec.mandatory;
    const conditionMet = spec.mandatory || (spec.condition ? spec.condition(input) : false);

    if (conditionMet) {
      result.push({
        category,
        name: spec.name,
        description: spec.description,
        legal_basis: spec.legal_basis,
        mandatory: spec.mandatory,
        conditional: isConditional,
        condition_description: spec.condition_description ?? null,
      });
    }
  }

  return result;
}

/**
 * Validate all required agreements are signed.
 */
export function validateAgreements(input: AgreementEtapaInput): AgreementEtapaResult {
  const blockers: ComplianceBlocker[] = [];
  const warnings: ComplianceBlocker[] = [];

  const requiredAgreements = resolveRequiredAgreements(input);

  const signatureMap = new Map(
    input.signatures.map(s => [s.category, s]),
  );

  let signedCount = 0;
  const pendingNames: string[] = [];

  for (const agreement of requiredAgreements) {
    const sig = signatureMap.get(agreement.category);

    if (!sig || !sig.generated) {
      pendingNames.push(agreement.name);
      blockers.push(mkBlocker(
        `AGREEMENT_NOT_GENERATED_${agreement.category.toUpperCase()}`,
        `Termo "${agreement.name}" não gerado`,
        agreement.legal_basis,
      ));
      continue;
    }

    if (!sig.signed) {
      pendingNames.push(agreement.name);
      blockers.push(mkBlocker(
        `AGREEMENT_NOT_SIGNED_${agreement.category.toUpperCase()}`,
        `Termo "${agreement.name}" pendente de assinatura`,
        agreement.legal_basis,
      ));
      continue;
    }

    // Check witness if required
    const spec = AGREEMENT_CATALOG[agreement.category];
    if (spec.witness_required && !sig.witness_signed) {
      warnings.push(mkWarning(
        `AGREEMENT_NO_WITNESS_${agreement.category.toUpperCase()}`,
        `Termo "${agreement.name}" assinado, mas sem testemunha — recomendado para validade jurídica`,
        agreement.legal_basis,
      ));
    }

    signedCount++;
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
    required_agreements: requiredAgreements,
    signed_count: signedCount,
    pending_count: pendingNames.length,
    evaluated_at: new Date().toISOString(),
  };
}

/**
 * Apply Etapa 6 to workflow state machine.
 */
export function applyAgreementsToWorkflow(
  workflow: HiringWorkflow,
  input: AgreementEtapaInput,
): { workflow: HiringWorkflow; result: AgreementEtapaResult } {
  const result = validateAgreements(input);
  const now = new Date().toISOString();

  const agreementStep = workflow.steps.find(s => s.step === 'agreements')!;

  if (result.valid) {
    agreementStep.status = 'completed';
    agreementStep.completed_at = now;
    agreementStep.error_message = null;
    agreementStep.metadata = {
      total_required: result.required_agreements.length,
      signed_count: result.signed_count,
      categories: result.required_agreements.map(a => a.category),
      validated_at: now,
    };

    // Advance to compliance gate
    workflow.current_step = 'compliance_gate';
    workflow.status = 'documents_pending';
    const complianceStep = workflow.steps.find(s => s.step === 'compliance_gate')!;
    complianceStep.status = 'in_progress';
    complianceStep.started_at = now;
  } else {
    agreementStep.status = 'blocked';
    agreementStep.error_message = result.blockers.map(b => b.message).join('; ');
    agreementStep.metadata = {
      total_required: result.required_agreements.length,
      signed_count: result.signed_count,
      pending_count: result.pending_count,
    };

    workflow.status = 'documents_pending';
  }

  workflow.updated_at = now;
  return { workflow, result };
}
