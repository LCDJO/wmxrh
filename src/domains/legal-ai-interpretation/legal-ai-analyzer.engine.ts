/**
 * Legal AI Analyzer Engine
 *
 * Summarizes legislative changes, classifies severity,
 * and identifies impact types across modules.
 *
 * Pure domain logic — no I/O.
 */

// ── Output Type ──

export type NivelGravidade = 'baixo' | 'medio' | 'alto' | 'critico';

export type TipoImpacto = 'salarial' | 'sst' | 'documental' | 'treinamento' | 'esocial';

export interface LegalInterpretation {
  resumo_executivo: string;
  explicacao_simples: string;
  nivel_gravidade: NivelGravidade;
  modulos_afetados: TipoImpacto[];
  recomendacao_acao: string;
}

// ── Input ──

export interface LegalChangeInput {
  norm_codigo: string;
  norm_titulo: string;
  orgao_emissor: string;
  data_vigencia: string;
  texto_alteracao: string;
  areas_impactadas: string[];
  artigos_alterados?: number;
  artigos_adicionados?: number;
  artigos_revogados?: number;
  mudancas_chave?: string[];
}

// ── Keyword → Impact Mapping ──

const IMPACT_KEYWORDS: Record<TipoImpacto, string[]> = {
  salarial: [
    'salário', 'salario', 'piso', 'remuneração', 'remuneracao', 'reajuste',
    'adicional', 'insalubridade', 'periculosidade', 'hora extra', 'folha',
    'vencimento', 'gratificação', 'gratificacao', 'comissão', 'comissao',
  ],
  sst: [
    'nr-', 'segurança', 'seguranca', 'risco', 'epi', 'epc', 'cipa',
    'pgr', 'pcmso', 'ltcat', 'acidente', 'insalubridade', 'periculosidade',
    'ergonomia', 'medicina do trabalho', 'saúde ocupacional', 'saude ocupacional',
  ],
  documental: [
    'documento', 'registro', 'formulário', 'formulario', 'relatório', 'relatorio',
    'certidão', 'certidao', 'declaração', 'declaracao', 'comprovante', 'atestado',
    'laudo', 'parecer', 'contrato', 'termo',
  ],
  treinamento: [
    'treinamento', 'capacitação', 'capacitacao', 'reciclagem', 'certificação',
    'certificacao', 'carga horária', 'carga horaria', 'curso', 'instrução',
    'instrucao', 'qualificação', 'qualificacao', 'habilitação', 'habilitacao',
  ],
  esocial: [
    'esocial', 'e-social', 'evento s-', 'layout', 'sst digital',
    'dctfweb', 'efd-reinf', 'caged', 'rais', 'gfip', 'sefip',
  ],
};

const AREA_TO_IMPACT: Record<string, TipoImpacto> = {
  folha_pagamento: 'salarial',
  jornada: 'salarial',
  beneficios: 'salarial',
  sindical: 'salarial',
  seguranca_trabalho: 'sst',
  saude_ocupacional: 'sst',
  epi: 'sst',
  treinamentos: 'treinamento',
  esocial: 'esocial',
  admissao: 'documental',
  demissao: 'documental',
  ferias: 'documental',
};

// ── Main Analyzer ──

export function analyzeLegalChange(input: LegalChangeInput): LegalInterpretation {
  const modulos = identifyImpactTypes(input);
  const gravidade = classifySeverity(input);
  const resumo = buildResumoExecutivo(input, gravidade, modulos);
  const explicacao = buildExplicacaoSimples(input, gravidade, modulos);
  const recomendacao = buildRecomendacao(gravidade, modulos);

  return {
    resumo_executivo: resumo,
    explicacao_simples: explicacao,
    nivel_gravidade: gravidade,
    modulos_afetados: modulos,
    recomendacao_acao: recomendacao,
  };
}

// ── Impact Identification ──

function identifyImpactTypes(input: LegalChangeInput): TipoImpacto[] {
  const found = new Set<TipoImpacto>();

  // From area mappings
  for (const area of input.areas_impactadas) {
    const mapped = AREA_TO_IMPACT[area];
    if (mapped) found.add(mapped);
  }

  // From text keyword analysis
  const searchText = `${input.norm_titulo} ${input.texto_alteracao} ${(input.mudancas_chave || []).join(' ')}`.toLowerCase();

  for (const [tipo, keywords] of Object.entries(IMPACT_KEYWORDS)) {
    if (keywords.some(kw => searchText.includes(kw))) {
      found.add(tipo as TipoImpacto);
    }
  }

  // NR codes always imply SST
  if (/\bNR[-\s]?\d/i.test(input.norm_codigo)) {
    found.add('sst');
    found.add('treinamento');
  }

  // CCT always implies salarial
  if (/\bCCT\b/i.test(input.norm_codigo)) {
    found.add('salarial');
  }

  return Array.from(found).sort();
}

// ── Severity Classification ──

function classifySeverity(input: LegalChangeInput): NivelGravidade {
  let score = 0;

  // Number of impacted areas
  score += input.areas_impactadas.length * 2;

  // Article changes
  const revogados = input.artigos_revogados || 0;
  const alterados = input.artigos_alterados || 0;
  const adicionados = input.artigos_adicionados || 0;

  score += revogados * 4;
  score += alterados * 2;
  score += adicionados * 1;

  // Key changes weight
  score += (input.mudancas_chave?.length || 0) * 2;

  // Text length as proxy for complexity
  if (input.texto_alteracao.length > 2000) score += 3;
  else if (input.texto_alteracao.length > 500) score += 1;

  // Severity keywords in text
  const text = input.texto_alteracao.toLowerCase();
  if (text.includes('revogad')) score += 4;
  if (text.includes('obrigatóri') || text.includes('obrigatori')) score += 3;
  if (text.includes('multa') || text.includes('penalidade') || text.includes('infração') || text.includes('infracao')) score += 3;
  if (text.includes('prazo')) score += 2;
  if (text.includes('imediata') || text.includes('urgente')) score += 4;

  if (score >= 20) return 'critico';
  if (score >= 12) return 'alto';
  if (score >= 6) return 'medio';
  return 'baixo';
}

// ── Text Builders ──

function buildResumoExecutivo(input: LegalChangeInput, gravidade: NivelGravidade, modulos: TipoImpacto[]): string {
  const gravidadeLabel: Record<NivelGravidade, string> = {
    critico: 'CRÍTICO', alto: 'ALTO', medio: 'MÉDIO', baixo: 'BAIXO',
  };

  const moduloLabels: Record<TipoImpacto, string> = {
    salarial: 'Salarial/Remuneração', sst: 'Segurança e Saúde do Trabalho',
    documental: 'Documental/Registros', treinamento: 'Treinamentos/Capacitação',
    esocial: 'eSocial/Obrigações Digitais',
  };

  const modulosStr = modulos.map(m => moduloLabels[m]).join(', ');

  return (
    `[${gravidadeLabel[gravidade]}] A ${input.norm_codigo} — "${input.norm_titulo}" — publicada por ${input.orgao_emissor} ` +
    `com vigência em ${formatDate(input.data_vigencia)}, impacta os módulos: ${modulosStr}. ` +
    (input.artigos_alterados
      ? `Total de ${input.artigos_alterados} artigo(s) alterado(s), ${input.artigos_adicionados || 0} adicionado(s) e ${input.artigos_revogados || 0} revogado(s).`
      : '')
  );
}

function buildExplicacaoSimples(input: LegalChangeInput, gravidade: NivelGravidade, modulos: TipoImpacto[]): string {
  const parts: string[] = [];

  parts.push(`A norma ${input.norm_codigo} foi atualizada e isso pode afetar a sua empresa.`);

  if (modulos.includes('salarial')) {
    parts.push('Pode haver impacto em salários, pisos salariais ou adicionais dos colaboradores.');
  }
  if (modulos.includes('sst')) {
    parts.push('Há mudanças relacionadas à segurança e saúde no trabalho que precisam ser revisadas.');
  }
  if (modulos.includes('treinamento')) {
    parts.push('Treinamentos obrigatórios podem precisar de atualização ou reciclagem.');
  }
  if (modulos.includes('esocial')) {
    parts.push('Eventos do eSocial podem precisar de ajuste nos layouts ou prazos de envio.');
  }
  if (modulos.includes('documental')) {
    parts.push('Documentos e registros obrigatórios podem ter novos requisitos.');
  }

  if (gravidade === 'critico' || gravidade === 'alto') {
    parts.push('Ação urgente recomendada para evitar multas e sanções.');
  }

  return parts.join(' ');
}

function buildRecomendacao(gravidade: NivelGravidade, modulos: TipoImpacto[]): string {
  const acoes: string[] = [];

  if (gravidade === 'critico') {
    acoes.push('Convocar reunião urgente com RH, Jurídico e SST para análise de impacto.');
  } else if (gravidade === 'alto') {
    acoes.push('Agendar revisão dos processos afetados em até 15 dias.');
  }

  if (modulos.includes('sst')) acoes.push('Revisar PGR, PCMSO e catálogo de EPIs.');
  if (modulos.includes('salarial')) acoes.push('Rodar simulação de folha com novos parâmetros.');
  if (modulos.includes('treinamento')) acoes.push('Verificar cronograma de reciclagem de treinamentos.');
  if (modulos.includes('esocial')) acoes.push('Validar layouts do eSocial com a versão vigente.');
  if (modulos.includes('documental')) acoes.push('Atualizar modelos de documentos e checklists.');

  if (acoes.length === 0) acoes.push('Monitorar a norma e agendar revisão periódica.');

  return acoes.join(' ');
}

// ── Util ──

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso; }
}
