/**
 * Legal Impact Analyzer — Cross-domain impact detection
 *
 * When a legal change is detected (via LegalChangeSummary), this engine
 * identifies affected entities across the platform:
 *   - Cargos (positions) linked via NR/CBO
 *   - Empresas with impacted CNAE
 *   - NR trainings requiring update
 *   - EPIs affected by norm changes
 *
 * Generates LegalImpactNotification for the notification system.
 *
 * Pure domain logic — no I/O. Receives pre-loaded data as input.
 */

import type {
  LegalChangeSummary,
  AreaImpacto,
  GravidadeMudanca,
} from './legal-diff.engine';

// ── Input Types (pre-loaded from DB) ──

export interface CargoSnapshot {
  id: string;
  nome: string;
  cbo_codigo: string | null;
  nivel: string;
  company_id: string;
  /** NR codes from career_legal_mappings */
  nr_codigos: string[];
  exige_epi: boolean;
  exige_exame_medico: boolean;
  adicional_aplicavel: string | null;
}

export interface EmpresaSnapshot {
  id: string;
  name: string;
  cnae_principal: string | null;
  cnaes_secundarios: string[];
  grau_risco: number;
}

export interface TreinamentoNrSnapshot {
  id: string;
  nr_number: number;
  nome: string;
  carga_horaria_inicial: number;
  periodicidade_meses: number;
  /** Total employees enrolled or requiring this */
  total_funcionarios: number;
}

export interface EpiCatalogSnapshot {
  id: string;
  nome: string;
  categoria: string;
  ca_numero: string | null;
  /** Risk agents this EPI protects against */
  risco_relacionado: string[];
  nr_referencia: string | null;
}

export interface LegalImpactInput {
  changeSummary: LegalChangeSummary;
  cargos: CargoSnapshot[];
  empresas: EmpresaSnapshot[];
  treinamentos: TreinamentoNrSnapshot[];
  epis: EpiCatalogSnapshot[];
}

// ── Output Types ──

export type ImpactEntityType = 'cargo' | 'empresa' | 'treinamento_nr' | 'epi';

export interface AffectedCargo {
  entity_type: 'cargo';
  cargo_id: string;
  cargo_nome: string;
  company_id: string;
  motivo: string;
  nr_relacionada: string | null;
}

export interface AffectedEmpresa {
  entity_type: 'empresa';
  empresa_id: string;
  empresa_nome: string;
  motivo: string;
  cnae_afetado: string | null;
}

export interface AffectedTreinamento {
  entity_type: 'treinamento_nr';
  treinamento_id: string;
  treinamento_nome: string;
  nr_number: number;
  motivo: string;
  funcionarios_afetados: number;
}

export interface AffectedEpi {
  entity_type: 'epi';
  epi_id: string;
  epi_nome: string;
  motivo: string;
  ca_numero: string | null;
}

export type AffectedEntity =
  | AffectedCargo
  | AffectedEmpresa
  | AffectedTreinamento
  | AffectedEpi;

export type NotificationPriority = 'info' | 'warning' | 'urgent' | 'critical';
export type NotificationChannel = 'in_app' | 'email' | 'push';

export interface LegalImpactNotification {
  /** Unique notification ID */
  notification_id: string;
  /** Source change that triggered this */
  change_id: string;
  document_code: string;
  document_title: string;

  /** Classification */
  priority: NotificationPriority;
  channels: NotificationChannel[];
  gravidade: GravidadeMudanca;

  /** Human-readable */
  titulo: string;
  mensagem: string;
  resumo_executivo: string;

  /** Affected entities breakdown */
  cargos_afetados: AffectedCargo[];
  empresas_afetadas: AffectedEmpresa[];
  treinamentos_afetados: AffectedTreinamento[];
  epis_afetados: AffectedEpi[];

  /** Aggregated stats */
  total_entidades_afetadas: number;
  areas_impacto: AreaImpacto[];

  /** Action deadline */
  prazo_adequacao: string | null;
  /** When analyzed */
  analyzed_at: string;

  /** Recommended actions (inherited + enriched) */
  acoes: {
    titulo: string;
    descricao: string;
    prioridade: number;
    prazo_dias: number;
    entidades_relacionadas: string[];
  }[];
}

// ── NR Extraction ──

/** Extract NR numbers mentioned in the change summary text */
function extractNrReferences(summary: LegalChangeSummary): Set<string> {
  const nrs = new Set<string>();
  const allText = [
    summary.document_code,
    summary.document_title,
    summary.resumo,
    summary.detalhamento,
    ...summary.artigos_alterados.map(a => `${a.artigo} ${a.texto_atual ?? ''}`),
  ].join(' ').toLowerCase();

  // Match NR patterns: NR-7, NR 7, NR7, nr-07, etc.
  const matches = allText.matchAll(/\bnr[\s-]*0*(\d{1,2})\b/gi);
  for (const m of matches) {
    nrs.add(m[1]);
  }
  return nrs;
}

/** Extract CNAE codes mentioned */
function extractCnaeReferences(summary: LegalChangeSummary): Set<string> {
  const cnaes = new Set<string>();
  const allText = [summary.resumo, summary.detalhamento].join(' ');
  const matches = allText.matchAll(/\b(\d{4}-?\d[\/-]?\d{2})\b/g);
  for (const m of matches) {
    cnaes.add(m[1].replace(/[-\/]/g, ''));
  }
  return cnaes;
}

/** Extract risk agent keywords */
function extractRiskKeywords(summary: LegalChangeSummary): string[] {
  const riskTerms = [
    'ruido', 'quimico', 'biologico', 'ergonomico', 'fisico',
    'poeira', 'calor', 'frio', 'vibracao', 'radiacao',
    'solvente', 'acido', 'metal', 'amianto', 'silica',
    'altura', 'eletricidade', 'confinado', 'explosivo', 'inflamavel',
  ];

  const allText = [
    summary.resumo, summary.detalhamento,
    ...summary.artigos_alterados.map(a => a.texto_atual ?? ''),
  ].join(' ').toLowerCase();

  return riskTerms.filter(t => allText.includes(t));
}

// ── Core Analyzer ──

export function analyzeLegalImpact(input: LegalImpactInput): LegalImpactNotification {
  const { changeSummary, cargos, empresas, treinamentos, epis } = input;

  const nrRefs = extractNrReferences(changeSummary);
  const cnaeRefs = extractCnaeReferences(changeSummary);
  const riskKeywords = extractRiskKeywords(changeSummary);
  const areas = changeSummary.areas_impactadas;

  // ── Identify affected cargos ──
  const cargosAfetados: AffectedCargo[] = [];

  for (const cargo of cargos) {
    const reasons: string[] = [];

    // Match by NR code
    for (const nrCode of cargo.nr_codigos) {
      const nrNum = nrCode.replace(/\D/g, '');
      if (nrRefs.has(nrNum)) {
        reasons.push(`NR-${nrNum} alterada`);
      }
    }

    // Match by area impact
    if (cargo.exige_epi && areas.includes('epi')) {
      reasons.push('Exige EPI e norma de EPI foi alterada');
    }
    if (cargo.exige_exame_medico && (areas.includes('saude_ocupacional') || areas.includes('pcmso'))) {
      reasons.push('Exige exame médico e norma de saúde foi alterada');
    }
    if (cargo.adicional_aplicavel && (areas.includes('adicional_insalubridade') || areas.includes('adicional_periculosidade'))) {
      reasons.push(`Adicional ${cargo.adicional_aplicavel} pode ser afetado`);
    }

    if (reasons.length > 0) {
      cargosAfetados.push({
        entity_type: 'cargo',
        cargo_id: cargo.id,
        cargo_nome: cargo.nome,
        company_id: cargo.company_id,
        motivo: reasons.join('; '),
        nr_relacionada: cargo.nr_codigos[0] ?? null,
      });
    }
  }

  // ── Identify affected empresas ──
  const empresasAfetadas: AffectedEmpresa[] = [];

  for (const empresa of empresas) {
    const reasons: string[] = [];

    // CNAE match
    const allCnaes = [empresa.cnae_principal, ...empresa.cnaes_secundarios].filter(Boolean) as string[];
    for (const cnae of allCnaes) {
      const normalized = cnae.replace(/[-\/]/g, '');
      if (cnaeRefs.has(normalized)) {
        reasons.push(`CNAE ${cnae} mencionado na alteração`);
      }
    }

    // Risk grade match
    if (empresa.grau_risco >= 3 && (areas.includes('seguranca_trabalho') || areas.includes('pgr'))) {
      reasons.push(`Grau de risco ${empresa.grau_risco} — alteração em segurança do trabalho`);
    }

    // Generic match by area
    if (areas.includes('sindical') && reasons.length === 0) {
      // All companies potentially affected by union changes
      reasons.push('Alteração em norma sindical pode afetar convenção coletiva');
    }

    if (reasons.length > 0) {
      empresasAfetadas.push({
        entity_type: 'empresa',
        empresa_id: empresa.id,
        empresa_nome: empresa.name,
        motivo: reasons.join('; '),
        cnae_afetado: allCnaes[0] ?? null,
      });
    }
  }

  // ── Identify affected treinamentos ──
  const treinamentosAfetados: AffectedTreinamento[] = [];

  for (const trein of treinamentos) {
    const nrNum = String(trein.nr_number);
    if (nrRefs.has(nrNum)) {
      treinamentosAfetados.push({
        entity_type: 'treinamento_nr',
        treinamento_id: trein.id,
        treinamento_nome: trein.nome,
        nr_number: trein.nr_number,
        motivo: `NR-${nrNum} alterada — verificar carga horária e conteúdo programático`,
        funcionarios_afetados: trein.total_funcionarios,
      });
    }
  }

  // ── Identify affected EPIs ──
  const episAfetados: AffectedEpi[] = [];

  for (const epi of epis) {
    const reasons: string[] = [];

    // Match by NR reference
    if (epi.nr_referencia) {
      const nrNum = epi.nr_referencia.replace(/\D/g, '');
      if (nrRefs.has(nrNum)) {
        reasons.push(`NR-${nrNum} alterada — verificar especificações`);
      }
    }

    // Match by risk agent keywords
    for (const riskKw of riskKeywords) {
      if (epi.risco_relacionado.some(r => r.toLowerCase().includes(riskKw))) {
        reasons.push(`Agente de risco "${riskKw}" mencionado na alteração`);
        break;
      }
    }

    // Generic EPI area match
    if (areas.includes('epi') && reasons.length === 0 && epi.categoria) {
      reasons.push('Norma de EPI alterada — revisar catálogo');
    }

    if (reasons.length > 0) {
      episAfetados.push({
        entity_type: 'epi',
        epi_id: epi.id,
        epi_nome: epi.nome,
        motivo: reasons.join('; '),
        ca_numero: epi.ca_numero,
      });
    }
  }

  // ── Build notification ──
  const totalAffected =
    cargosAfetados.length + empresasAfetadas.length +
    treinamentosAfetados.length + episAfetados.length;

  const priority = mapPriority(changeSummary.gravidade, totalAffected);
  const channels = mapChannels(priority);

  const parts: string[] = [];
  if (cargosAfetados.length > 0) parts.push(`${cargosAfetados.length} cargo(s)`);
  if (empresasAfetadas.length > 0) parts.push(`${empresasAfetadas.length} empresa(s)`);
  if (treinamentosAfetados.length > 0) parts.push(`${treinamentosAfetados.length} treinamento(s)`);
  if (episAfetados.length > 0) parts.push(`${episAfetados.length} EPI(s)`);

  const mensagem = totalAffected === 0
    ? `Alteração em ${changeSummary.document_title} detectada, sem impacto direto identificado.`
    : `Alteração em ${changeSummary.document_title} impacta: ${parts.join(', ')}.`;

  const acoes = buildEnrichedActions(
    changeSummary,
    cargosAfetados,
    empresasAfetadas,
    treinamentosAfetados,
    episAfetados
  );

  return {
    notification_id: `impact_${changeSummary.change_id}_${Date.now()}`,
    change_id: changeSummary.change_id,
    document_code: changeSummary.document_code,
    document_title: changeSummary.document_title,
    priority,
    channels,
    gravidade: changeSummary.gravidade,
    titulo: `Impacto Legal: ${changeSummary.document_title}`,
    mensagem,
    resumo_executivo: buildResumoExecutivo(changeSummary, totalAffected, cargosAfetados, treinamentosAfetados),
    cargos_afetados: cargosAfetados,
    empresas_afetadas: empresasAfetadas,
    treinamentos_afetados: treinamentosAfetados,
    epis_afetados: episAfetados,
    total_entidades_afetadas: totalAffected,
    areas_impacto: changeSummary.areas_impactadas,
    prazo_adequacao: changeSummary.prazo_adequacao,
    analyzed_at: new Date().toISOString(),
    acoes,
  };
}

// ── Helpers ──

function mapPriority(gravidade: GravidadeMudanca, totalAffected: number): NotificationPriority {
  if (gravidade === 'critica') return 'critical';
  if (gravidade === 'alta' || totalAffected >= 10) return 'urgent';
  if (gravidade === 'media' || totalAffected >= 3) return 'warning';
  return 'info';
}

function mapChannels(priority: NotificationPriority): NotificationChannel[] {
  switch (priority) {
    case 'critical': return ['in_app', 'email', 'push'];
    case 'urgent': return ['in_app', 'email'];
    case 'warning': return ['in_app'];
    default: return ['in_app'];
  }
}

function buildResumoExecutivo(
  summary: LegalChangeSummary,
  total: number,
  cargos: AffectedCargo[],
  treinamentos: AffectedTreinamento[]
): string {
  const lines: string[] = [];
  lines.push(`Documento: ${summary.document_code} — ${summary.document_title}`);
  lines.push(`Gravidade: ${summary.gravidade.toUpperCase()}`);
  lines.push(`Total de entidades impactadas: ${total}`);

  if (cargos.length > 0) {
    lines.push(`Cargos afetados: ${cargos.slice(0, 5).map(c => c.cargo_nome).join(', ')}${cargos.length > 5 ? ` (+${cargos.length - 5})` : ''}`);
  }

  const totalFunc = treinamentos.reduce((s, t) => s + t.funcionarios_afetados, 0);
  if (totalFunc > 0) {
    lines.push(`Funcionários potencialmente afetados via treinamentos: ${totalFunc}`);
  }

  if (summary.prazo_adequacao) {
    lines.push(`Prazo para adequação: ${summary.prazo_adequacao}`);
  }

  return lines.join('\n');
}

function buildEnrichedActions(
  summary: LegalChangeSummary,
  cargos: AffectedCargo[],
  empresas: AffectedEmpresa[],
  treinamentos: AffectedTreinamento[],
  epis: AffectedEpi[]
): LegalImpactNotification['acoes'] {
  const acoes: LegalImpactNotification['acoes'] = [];
  let p = 1;

  if (cargos.length > 0) {
    acoes.push({
      prioridade: p++,
      titulo: 'Revisar mapeamentos legais dos cargos afetados',
      descricao: `${cargos.length} cargo(s) possuem NRs ou requisitos impactados pela alteração. Verificar exigências de EPI, exames e adicionais.`,
      prazo_dias: summary.gravidade === 'critica' ? 5 : 15,
      entidades_relacionadas: cargos.map(c => c.cargo_id),
    });
  }

  if (empresas.length > 0) {
    acoes.push({
      prioridade: p++,
      titulo: 'Verificar conformidade das empresas afetadas',
      descricao: `${empresas.length} empresa(s) com CNAE ou grau de risco impactado. Revisar PGR e programas de SST.`,
      prazo_dias: summary.gravidade === 'critica' ? 5 : 15,
      entidades_relacionadas: empresas.map(e => e.empresa_id),
    });
  }

  if (treinamentos.length > 0) {
    const total = treinamentos.reduce((s, t) => s + t.funcionarios_afetados, 0);
    acoes.push({
      prioridade: p++,
      titulo: 'Atualizar programa de treinamentos NR',
      descricao: `${treinamentos.length} treinamento(s) afetado(s), impactando ~${total} funcionário(s). Revisar conteúdo programático e carga horária.`,
      prazo_dias: 30,
      entidades_relacionadas: treinamentos.map(t => t.treinamento_id),
    });
  }

  if (epis.length > 0) {
    acoes.push({
      prioridade: p++,
      titulo: 'Revisar catálogo de EPIs',
      descricao: `${epis.length} EPI(s) com norma de referência ou agente de risco alterado. Verificar CAs e especificações.`,
      prazo_dias: 15,
      entidades_relacionadas: epis.map(e => e.epi_id),
    });
  }

  // Inherit generic actions from change summary
  for (const acao of summary.acoes_recomendadas) {
    if (!acoes.some(a => a.titulo.toLowerCase().includes(acao.titulo.toLowerCase().substring(0, 15)))) {
      acoes.push({
        prioridade: p++,
        titulo: acao.titulo,
        descricao: acao.descricao,
        prazo_dias: acao.prazo_sugerido_dias,
        entidades_relacionadas: [],
      });
    }
  }

  return acoes;
}
