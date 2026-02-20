/**
 * Impact Mapping Engine
 *
 * Cross-references a legislative change against company/position data
 * (CNAE, CBO, NRs, PCMSO, EPIs) to produce per-company impact reports.
 *
 * Pure domain logic — no I/O.
 */

// ── Output Types ──

export type RiscoJuridico = 'baixo' | 'medio' | 'alto' | 'critico';

export interface CargoAfetado {
  cargo_id: string;
  cargo_nome: string;
  cbo_codigo: string | null;
  motivo_impacto: string[];
  funcionarios_count: number;
  nivel_risco: RiscoJuridico;
}

export interface CompanyLegalImpact {
  company_id: string;
  company_name: string;
  cnae_principal: string | null;
  cargos_afetados: CargoAfetado[];
  numero_colaboradores_afetados: number;
  risco_juridico_estimado: RiscoJuridico;
  prazo_adequacao: number; // days
  areas_impacto: string[];
  acoes_recomendadas: string[];
}

export interface ImpactMappingResult {
  impacts: CompanyLegalImpact[];
  total_companies_affected: number;
  total_employees_affected: number;
  highest_risk: RiscoJuridico;
  generated_at: string;
}

// ── Input Types ──

export interface ImpactMappingInput {
  norm_codigo: string;
  norm_tipo: string; // NR, CLT, CCT, Portaria, etc.
  areas_impactadas: string[];
  nrs_afetadas: string[]; // e.g. ['NR-7', 'NR-9']
  companies: CompanyData[];
}

export interface CompanyData {
  id: string;
  name: string;
  cnae_principal: string | null;
  grau_risco: number; // 1-4
  cargos: CargoData[];
}

export interface CargoData {
  id: string;
  nome: string;
  cbo_codigo: string | null;
  nrs_aplicaveis: string[];
  exige_epi: boolean;
  exige_exame_medico: boolean;
  pcmso_ativo: boolean;
  epis_vinculados: string[];
  funcionarios_count: number;
}

// ── CNAE → Risk Area Mapping ──

const CNAE_RISK_AREAS: Record<string, string[]> = {
  '05': ['seguranca_trabalho', 'saude_ocupacional', 'epi'],  // Mining
  '06': ['seguranca_trabalho', 'saude_ocupacional', 'epi'],
  '10': ['saude_ocupacional', 'seguranca_trabalho'],          // Food
  '23': ['seguranca_trabalho', 'epi', 'saude_ocupacional'],   // Non-metallic minerals
  '24': ['seguranca_trabalho', 'epi', 'saude_ocupacional'],   // Metallurgy
  '25': ['seguranca_trabalho', 'epi'],                        // Metal products
  '41': ['seguranca_trabalho', 'treinamentos', 'epi'],        // Construction
  '42': ['seguranca_trabalho', 'treinamentos', 'epi'],
  '43': ['seguranca_trabalho', 'treinamentos', 'epi'],
  '49': ['jornada', 'saude_ocupacional'],                     // Transport
  '50': ['seguranca_trabalho', 'saude_ocupacional'],
  '86': ['saude_ocupacional'],                                // Health
};

// ── CBO → NR Mapping (common occupational groups) ──

const CBO_NR_MAP: Record<string, string[]> = {
  '7': ['NR-6', 'NR-12', 'NR-18', 'NR-35'],   // Workers in production
  '8': ['NR-6', 'NR-12', 'NR-20'],              // Industrial operators
  '9': ['NR-6', 'NR-18', 'NR-33', 'NR-35'],    // Maintenance/repair
  '3': ['NR-10', 'NR-17'],                       // Technicians
  '6': ['NR-31'],                                // Agricultural workers
};

// ── Main Engine ──

export function mapLegalImpact(input: ImpactMappingInput): ImpactMappingResult {
  const impacts: CompanyLegalImpact[] = [];

  for (const company of input.companies) {
    const companyImpact = analyzeCompanyImpact(input, company);
    if (companyImpact.cargos_afetados.length > 0) {
      impacts.push(companyImpact);
    }
  }

  // Sort by risk (critical first)
  const riskOrder: Record<RiscoJuridico, number> = { critico: 0, alto: 1, medio: 2, baixo: 3 };
  impacts.sort((a, b) => riskOrder[a.risco_juridico_estimado] - riskOrder[b.risco_juridico_estimado]);

  const totalEmployees = impacts.reduce((s, i) => s + i.numero_colaboradores_afetados, 0);

  return {
    impacts,
    total_companies_affected: impacts.length,
    total_employees_affected: totalEmployees,
    highest_risk: impacts[0]?.risco_juridico_estimado || 'baixo',
    generated_at: new Date().toISOString(),
  };
}

// ── Company Analysis ──

function analyzeCompanyImpact(input: ImpactMappingInput, company: CompanyData): CompanyLegalImpact {
  const cargosAfetados: CargoAfetado[] = [];
  const companyAreas = new Set<string>();

  // Check CNAE relevance
  const cnaePrefix = company.cnae_principal?.substring(0, 2) || '';
  const cnaeAreas = CNAE_RISK_AREAS[cnaePrefix] || [];
  const cnaeOverlap = cnaeAreas.filter(a => input.areas_impactadas.includes(a));
  cnaeOverlap.forEach(a => companyAreas.add(a));

  for (const cargo of company.cargos) {
    const motivos = evaluateCargoImpact(input, cargo, cnaeOverlap, company.grau_risco);
    if (motivos.length === 0) continue;

    motivos.forEach(m => {
      if (m.area) companyAreas.add(m.area);
    });

    const nivel = classifyCargoRisk(motivos.length, cargo, company.grau_risco);

    cargosAfetados.push({
      cargo_id: cargo.id,
      cargo_nome: cargo.nome,
      cbo_codigo: cargo.cbo_codigo,
      motivo_impacto: motivos.map(m => m.reason),
      funcionarios_count: cargo.funcionarios_count,
      nivel_risco: nivel,
    });
  }

  const totalFuncionarios = cargosAfetados.reduce((s, c) => s + c.funcionarios_count, 0);
  const overallRisk = classifyOverallRisk(cargosAfetados, company.grau_risco);
  const prazo = inferPrazo(overallRisk, input.areas_impactadas);
  const acoes = buildAcoes(input, cargosAfetados, Array.from(companyAreas));

  return {
    company_id: company.id,
    company_name: company.name,
    cnae_principal: company.cnae_principal,
    cargos_afetados: cargosAfetados,
    numero_colaboradores_afetados: totalFuncionarios,
    risco_juridico_estimado: overallRisk,
    prazo_adequacao: prazo,
    areas_impacto: Array.from(companyAreas),
    acoes_recomendadas: acoes,
  };
}

// ── Cargo Impact Evaluation ──

interface ImpactMotivo {
  reason: string;
  area: string | null;
}

function evaluateCargoImpact(
  input: ImpactMappingInput,
  cargo: CargoData,
  cnaeOverlap: string[],
  grauRisco: number,
): ImpactMotivo[] {
  const motivos: ImpactMotivo[] = [];

  // 1. NR overlap: cargo NRs vs affected NRs
  for (const nr of input.nrs_afetadas) {
    if (cargo.nrs_aplicaveis.includes(nr)) {
      motivos.push({ reason: `${nr} é aplicável a este cargo`, area: 'seguranca_trabalho' });
    }
  }

  // 2. CBO → NR inference
  if (cargo.cbo_codigo) {
    const cboGroup = cargo.cbo_codigo.charAt(0);
    const inferredNrs = CBO_NR_MAP[cboGroup] || [];
    for (const nr of input.nrs_afetadas) {
      if (inferredNrs.includes(nr) && !cargo.nrs_aplicaveis.includes(nr)) {
        motivos.push({ reason: `${nr} inferida pelo CBO ${cargo.cbo_codigo} (grupo ${cboGroup})`, area: 'seguranca_trabalho' });
      }
    }
  }

  // 3. CNAE overlap triggers
  if (cnaeOverlap.length > 0) {
    motivos.push({ reason: `CNAE da empresa tem risco em: ${cnaeOverlap.join(', ')}`, area: cnaeOverlap[0] });
  }

  // 4. EPI impact
  if (cargo.exige_epi && input.areas_impactadas.includes('epi')) {
    motivos.push({ reason: 'Cargo exige EPI — norma altera requisitos de EPI', area: 'epi' });
    if (cargo.epis_vinculados.length > 0) {
      motivos.push({ reason: `${cargo.epis_vinculados.length} EPI(s) vinculado(s) a revisar`, area: 'epi' });
    }
  }

  // 5. PCMSO impact
  if (cargo.pcmso_ativo && input.areas_impactadas.includes('saude_ocupacional')) {
    motivos.push({ reason: 'PCMSO ativo — norma altera requisitos de saúde ocupacional', area: 'saude_ocupacional' });
  }

  // 6. Medical exam impact
  if (cargo.exige_exame_medico && input.areas_impactadas.includes('saude_ocupacional')) {
    motivos.push({ reason: 'Cargo exige exame médico — possível alteração na periodicidade ou tipo', area: 'saude_ocupacional' });
  }

  // 7. Training impact
  if (input.areas_impactadas.includes('treinamentos') && cargo.nrs_aplicaveis.length > 0) {
    motivos.push({ reason: 'Cargo com NRs aplicáveis pode ter alteração nos treinamentos obrigatórios', area: 'treinamentos' });
  }

  // 8. High risk company amplifier
  if (grauRisco >= 3 && motivos.length > 0) {
    motivos.push({ reason: `Empresa grau de risco ${grauRisco} — impacto amplificado`, area: null });
  }

  return motivos;
}

// ── Risk Classification ──

function classifyCargoRisk(motivoCount: number, cargo: CargoData, grauRisco: number): RiscoJuridico {
  let score = motivoCount * 2;
  score += cargo.nrs_aplicaveis.length;
  if (cargo.exige_epi) score += 1;
  if (cargo.exige_exame_medico) score += 1;
  if (cargo.pcmso_ativo) score += 1;
  score += Math.max(0, grauRisco - 1);
  score += Math.min(cargo.funcionarios_count / 10, 5);

  if (score >= 15) return 'critico';
  if (score >= 10) return 'alto';
  if (score >= 5) return 'medio';
  return 'baixo';
}

function classifyOverallRisk(cargos: CargoAfetado[], grauRisco: number): RiscoJuridico {
  if (cargos.length === 0) return 'baixo';

  const riskValues: Record<RiscoJuridico, number> = { critico: 4, alto: 3, medio: 2, baixo: 1 };
  const maxRisk = Math.max(...cargos.map(c => riskValues[c.nivel_risco]));
  const totalFuncionarios = cargos.reduce((s, c) => s + c.funcionarios_count, 0);

  let adjusted = maxRisk;
  if (totalFuncionarios > 100) adjusted = Math.min(adjusted + 1, 4);
  if (grauRisco >= 3) adjusted = Math.min(adjusted + 1, 4);

  if (adjusted >= 4) return 'critico';
  if (adjusted >= 3) return 'alto';
  if (adjusted >= 2) return 'medio';
  return 'baixo';
}

// ── Prazo & Actions ──

function inferPrazo(risco: RiscoJuridico, areas: string[]): number {
  const basePrazos: Record<RiscoJuridico, number> = { critico: 15, alto: 30, medio: 60, baixo: 90 };
  let prazo = basePrazos[risco];

  if (areas.includes('esocial')) prazo = Math.min(prazo, 30);
  if (areas.includes('folha_pagamento')) prazo = Math.min(prazo, 30);

  return prazo;
}

function buildAcoes(
  input: ImpactMappingInput,
  cargos: CargoAfetado[],
  areas: string[],
): string[] {
  const acoes: string[] = [];

  if (areas.includes('seguranca_trabalho')) acoes.push('Revisar PGR e mapeamento de riscos');
  if (areas.includes('saude_ocupacional')) acoes.push('Atualizar PCMSO e cronograma de exames');
  if (areas.includes('epi')) acoes.push('Revisar catálogo de EPIs e fichas de entrega');
  if (areas.includes('treinamentos')) acoes.push('Atualizar cronograma de treinamentos obrigatórios');
  if (areas.includes('folha_pagamento')) acoes.push('Simular impacto em folha de pagamento');
  if (areas.includes('esocial')) acoes.push('Validar eventos eSocial afetados');

  const criticalCargos = cargos.filter(c => c.nivel_risco === 'critico' || c.nivel_risco === 'alto');
  if (criticalCargos.length > 0) {
    acoes.push(`Priorizar ${criticalCargos.length} cargo(s) de alto/crítico risco: ${criticalCargos.map(c => c.cargo_nome).slice(0, 3).join(', ')}`);
  }

  if (input.nrs_afetadas.length > 0) {
    acoes.push(`Verificar conformidade com: ${input.nrs_afetadas.join(', ')}`);
  }

  if (acoes.length === 0) acoes.push('Monitorar e agendar revisão periódica');

  return acoes;
}
