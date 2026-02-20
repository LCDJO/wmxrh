/**
 * Explainability Layer Engine
 *
 * Produces transparent, auditable explanations for every legal interpretation:
 *  - Original article text (before/after)
 *  - Technical explanation (for legal/SST specialists)
 *  - Simplified explanation (plain language for SMEs)
 *  - Traceability metadata
 *
 * Pure domain logic — no I/O.
 */

// ── Types ──

export type NivelComplexidade = 'simples' | 'moderado' | 'complexo';

export interface ArtigoAlterado {
  numero: string;            // e.g. "Art. 7º, §2º"
  norma: string;             // e.g. "NR-01"
  titulo: string;
  trecho_antigo: string;
  trecho_novo: string;
  palavras_chave: string[];
}

export interface ExplicacaoTecnica {
  resumo: string;
  fundamentacao_legal: string;
  implicacoes_praticas: string[];
  normas_correlatas: string[];
  nivel_complexidade: NivelComplexidade;
  termos_tecnicos: TermoTecnico[];
}

export interface TermoTecnico {
  termo: string;
  definicao: string;
  contexto: string;
}

export interface ExplicacaoSimplificada {
  titulo_simples: string;
  o_que_mudou: string;
  por_que_importa: string;
  o_que_fazer: string[];
  analogia: string | null;
  nivel_urgencia: 'informativo' | 'atencao' | 'acao_imediata';
}

export interface ExplainabilityRecord {
  id: string;
  artigo: ArtigoAlterado;
  explicacao_tecnica: ExplicacaoTecnica;
  explicacao_simplificada: ExplicacaoSimplificada;
  confianca: number;            // 0-1
  fontes: string[];
  generated_at: string;
}

export interface ExplainabilityInput {
  norm_codigo: string;
  artigos: ArtigoInput[];
  areas_impactadas: string[];
  nrs_afetadas: string[];
}

export interface ArtigoInput {
  numero: string;
  titulo: string;
  trecho_antigo: string;
  trecho_novo: string;
}

export interface ExplainabilityResult {
  records: ExplainabilityRecord[];
  total_artigos: number;
  complexidade_media: NivelComplexidade;
  generated_at: string;
}

// ── Keyword extraction ──

const LEGAL_KEYWORDS: Record<string, string[]> = {
  seguranca: ['risco', 'perigo', 'acidente', 'incidente', 'proteção', 'prevenção', 'segurança'],
  saude: ['saúde', 'médico', 'exame', 'pcmso', 'atestado', 'doença', 'ocupacional'],
  treinamento: ['treinamento', 'capacitação', 'reciclagem', 'qualificação', 'habilitação', 'carga horária'],
  epi: ['epi', 'equipamento', 'proteção individual', 'ca ', 'certificado aprovação'],
  jornada: ['jornada', 'hora', 'intervalo', 'descanso', 'compensação', 'banco de horas'],
  remuneracao: ['salário', 'remuneração', 'adicional', 'insalubridade', 'periculosidade', 'piso'],
  esocial: ['esocial', 'evento', 'layout', 'transmissão', 'obrigação acessória'],
  pgr: ['pgr', 'gerenciamento', 'inventário de riscos', 'plano de ação'],
  ergonomia: ['ergonomia', 'ergonômico', 'postura', 'mobiliário', 'aet'],
  construcao: ['construção', 'obra', 'canteiro', 'pcmat', 'andaime', 'escavação'],
};

// ── Term definitions ──

const TERM_GLOSSARY: Record<string, string> = {
  pgr: 'Programa de Gerenciamento de Riscos — documento obrigatório que identifica perigos e estabelece medidas de controle.',
  pcmso: 'Programa de Controle Médico de Saúde Ocupacional — programa que define exames médicos obrigatórios.',
  epi: 'Equipamento de Proteção Individual — dispositivo de uso pessoal para proteção contra riscos.',
  ca: 'Certificado de Aprovação — documento que atesta a conformidade do EPI.',
  aet: 'Análise Ergonômica do Trabalho — estudo das condições de trabalho para adequação ergonômica.',
  sesmt: 'Serviço Especializado em Engenharia de Segurança e em Medicina do Trabalho.',
  cipa: 'Comissão Interna de Prevenção de Acidentes e de Assédio.',
  aso: 'Atestado de Saúde Ocupacional — documento emitido após exame médico ocupacional.',
  rls: 'Row Level Security — política de segurança a nível de linha no banco de dados.',
  nr: 'Norma Regulamentadora — regulamento do Ministério do Trabalho sobre segurança e saúde.',
  cbo: 'Classificação Brasileira de Ocupações — código que identifica funções/cargos.',
  cnae: 'Classificação Nacional de Atividades Econômicas — código da atividade empresarial.',
  esocial: 'Sistema de Escrituração Digital das Obrigações Fiscais, Previdenciárias e Trabalhistas.',
  gro: 'Gerenciamento de Riscos Ocupacionais — capítulo da NR-1 sobre gestão de riscos.',
};

// ── Main Engine ──

export function generateExplainability(input: ExplainabilityInput): ExplainabilityResult {
  const records: ExplainabilityRecord[] = [];

  for (const artigo of input.artigos) {
    const record = buildExplainabilityRecord(input.norm_codigo, artigo, input.areas_impactadas, input.nrs_afetadas);
    records.push(record);
  }

  const complexidades = records.map(r => r.explicacao_tecnica.nivel_complexidade);
  const complexidadeMedia = computeAverageComplexity(complexidades);

  return {
    records,
    total_artigos: records.length,
    complexidade_media: complexidadeMedia,
    generated_at: new Date().toISOString(),
  };
}

// ── Record Builder ──

function buildExplainabilityRecord(
  norm: string,
  artigo: ArtigoInput,
  areas: string[],
  nrs: string[]
): ExplainabilityRecord {
  const artigoAlterado = buildArtigoAlterado(norm, artigo);
  const tecnica = buildExplicacaoTecnica(norm, artigo, areas, nrs);
  const simplificada = buildExplicacaoSimplificada(norm, artigo, areas);
  const confianca = computeConfidence(artigo);

  return {
    id: crypto.randomUUID(),
    artigo: artigoAlterado,
    explicacao_tecnica: tecnica,
    explicacao_simplificada: simplificada,
    confianca,
    fontes: [`${norm}`, ...nrs.filter(n => n !== norm)],
    generated_at: new Date().toISOString(),
  };
}

function buildArtigoAlterado(norm: string, artigo: ArtigoInput): ArtigoAlterado {
  const combined = `${artigo.trecho_antigo} ${artigo.trecho_novo}`.toLowerCase();
  const palavras: string[] = [];

  for (const [category, keywords] of Object.entries(LEGAL_KEYWORDS)) {
    if (keywords.some(kw => combined.includes(kw))) {
      palavras.push(category);
    }
  }

  return {
    numero: artigo.numero,
    norma: norm,
    titulo: artigo.titulo,
    trecho_antigo: artigo.trecho_antigo,
    trecho_novo: artigo.trecho_novo,
    palavras_chave: palavras,
  };
}

// ── Technical Explanation ──

function buildExplicacaoTecnica(
  norm: string,
  artigo: ArtigoInput,
  areas: string[],
  nrs: string[]
): ExplicacaoTecnica {
  const diff = computeDiff(artigo.trecho_antigo, artigo.trecho_novo);
  const complexidade = classifyComplexity(artigo, diff);

  const implicacoes = deriveImplicacoes(areas, norm);
  const termos = extractTermosTecnicos(artigo);

  return {
    resumo: `O ${artigo.numero} da ${norm} foi alterado, modificando ${diff.palavrasAlteradas} palavra(s) do texto original. ${diff.tipoMudanca === 'ampliacao' ? 'A nova redação amplia' : diff.tipoMudanca === 'restricao' ? 'A nova redação restringe' : 'A nova redação modifica'} o escopo da obrigação.`,
    fundamentacao_legal: `Fundamentado na ${norm}, ${artigo.numero} — "${artigo.titulo}". ${nrs.length > 1 ? `Correlação com: ${nrs.filter(n => n !== norm).join(', ')}.` : ''}`,
    implicacoes_praticas: implicacoes,
    normas_correlatas: nrs.filter(n => n !== norm),
    nivel_complexidade: complexidade,
    termos_tecnicos: termos,
  };
}

function deriveImplicacoes(areas: string[], norm: string): string[] {
  const map: Record<string, string> = {
    seguranca_trabalho: `Revisão obrigatória dos procedimentos de segurança conforme ${norm}.`,
    saude_ocupacional: `Atualização do PCMSO e cronograma de exames ocupacionais.`,
    treinamentos: `Adequação da carga horária e conteúdo programático dos treinamentos obrigatórios.`,
    epi: `Reavaliação do catálogo de EPIs e verificação dos CAs vigentes.`,
    folha_pagamento: `Possível impacto nos adicionais de insalubridade/periculosidade na folha.`,
    esocial: `Ajuste nos eventos e layouts do eSocial para refletir as alterações.`,
    jornada: `Revisão das regras de controle de jornada e banco de horas.`,
    sindical: `Análise de impacto em cláusulas de convenções coletivas vigentes.`,
  };

  return areas.map(a => map[a]).filter(Boolean);
}

function extractTermosTecnicos(artigo: ArtigoInput): TermoTecnico[] {
  const combined = `${artigo.trecho_antigo} ${artigo.trecho_novo}`.toLowerCase();
  const found: TermoTecnico[] = [];

  for (const [termo, definicao] of Object.entries(TERM_GLOSSARY)) {
    if (combined.includes(termo)) {
      found.push({
        termo: termo.toUpperCase(),
        definicao,
        contexto: `Referenciado no ${artigo.numero}`,
      });
    }
  }

  return found;
}

// ── Simplified Explanation ──

function buildExplicacaoSimplificada(
  norm: string,
  artigo: ArtigoInput,
  areas: string[]
): ExplicacaoSimplificada {
  const urgencia = areas.some(a => ['seguranca_trabalho', 'saude_ocupacional'].includes(a))
    ? 'acao_imediata'
    : areas.some(a => ['epi', 'treinamentos', 'esocial'].includes(a))
      ? 'atencao'
      : 'informativo';

  const oQueFazer = buildSimpleActions(areas);

  return {
    titulo_simples: `Mudança na ${norm}: ${artigo.titulo}`,
    o_que_mudou: `O governo atualizou uma regra de segurança/saúde no trabalho (${artigo.numero} da ${norm}). O texto antigo foi substituído por uma nova versão que pode afetar como sua empresa gerencia a segurança dos funcionários.`,
    por_que_importa: urgencia === 'acao_imediata'
      ? 'Essa mudança afeta diretamente a segurança e saúde dos seus funcionários. Não se adequar pode gerar multas, interdições e responsabilidade legal em caso de acidentes.'
      : urgencia === 'atencao'
        ? 'Essa mudança exige ajustes nos processos da empresa. O prazo para adequação é limitado e o não cumprimento pode resultar em autuações.'
        : 'Essa mudança traz ajustes que devem ser observados para manter a empresa em conformidade com a legislação vigente.',
    o_que_fazer: oQueFazer,
    analogia: buildAnalogia(areas),
    nivel_urgencia: urgencia,
  };
}

function buildSimpleActions(areas: string[]): string[] {
  const actions: string[] = [];
  const actionMap: Record<string, string> = {
    seguranca_trabalho: 'Peça ao seu técnico de segurança para revisar os documentos de prevenção de riscos.',
    saude_ocupacional: 'Verifique com o médico do trabalho se os exames dos funcionários estão em dia.',
    treinamentos: 'Confira se os treinamentos de segurança precisam ser refeitos ou atualizados.',
    epi: 'Revise se os equipamentos de proteção (capacete, luvas, etc.) ainda estão adequados.',
    folha_pagamento: 'Consulte o contador para verificar se há impacto nos adicionais de salário.',
    esocial: 'Peça ao responsável pelo eSocial para verificar se precisa atualizar algum envio.',
    jornada: 'Revise as regras de horário de trabalho e banco de horas dos funcionários.',
    sindical: 'Consulte o sindicato ou advogado trabalhista sobre possíveis impactos no acordo coletivo.',
  };

  for (const area of areas) {
    if (actionMap[area]) actions.push(actionMap[area]);
  }

  if (actions.length === 0) {
    actions.push('Consulte um profissional de segurança do trabalho para avaliar se a mudança afeta sua empresa.');
  }

  return actions;
}

function buildAnalogia(areas: string[]): string | null {
  if (areas.includes('seguranca_trabalho')) {
    return 'É como quando mudam as regras de trânsito: mesmo que você já dirija bem, precisa se atualizar para não levar multa.';
  }
  if (areas.includes('saude_ocupacional')) {
    return 'Pense como uma atualização na carteira de vacinação: alguns exames que antes não eram necessários agora passam a ser obrigatórios.';
  }
  if (areas.includes('epi')) {
    return 'É como trocar o extintor de incêndio vencido: o equipamento antigo pode não proteger mais conforme o novo padrão.';
  }
  if (areas.includes('treinamentos')) {
    return 'Funciona como a reciclagem da CNH: de tempos em tempos é preciso renovar o conhecimento para continuar habilitado.';
  }
  return null;
}

// ── Diff & Classification Helpers ──

interface DiffResult {
  palavrasAlteradas: number;
  tipoMudanca: 'ampliacao' | 'restricao' | 'modificacao';
  percentualMudanca: number;
}

function computeDiff(antigo: string, novo: string): DiffResult {
  const wordsOld = antigo.toLowerCase().split(/\s+/).filter(Boolean);
  const wordsNew = novo.toLowerCase().split(/\s+/).filter(Boolean);
  const oldSet = new Set(wordsOld);
  const newSet = new Set(wordsNew);

  let removed = 0;
  let added = 0;
  for (const w of wordsOld) if (!newSet.has(w)) removed++;
  for (const w of wordsNew) if (!oldSet.has(w)) added++;

  const totalUnique = new Set([...wordsOld, ...wordsNew]).size;
  const changed = removed + added;

  return {
    palavrasAlteradas: changed,
    tipoMudanca: wordsNew.length > wordsOld.length * 1.2 ? 'ampliacao'
      : wordsNew.length < wordsOld.length * 0.8 ? 'restricao'
      : 'modificacao',
    percentualMudanca: totalUnique > 0 ? Math.round((changed / totalUnique) * 100) : 0,
  };
}

function classifyComplexity(artigo: ArtigoInput, diff: DiffResult): NivelComplexidade {
  const combined = `${artigo.trecho_novo}`.toLowerCase();
  const hasMultipleNRs = (combined.match(/nr-\d+/g) || []).length > 1;
  const hasLegalTerms = ['decreto', 'portaria', 'instrução normativa', 'lei complementar'].some(t => combined.includes(t));

  if (diff.percentualMudanca > 50 || hasMultipleNRs || hasLegalTerms) return 'complexo';
  if (diff.percentualMudanca > 20) return 'moderado';
  return 'simples';
}

function computeConfidence(artigo: ArtigoInput): number {
  let score = 0.7;
  if (artigo.trecho_antigo.length > 50) score += 0.1;
  if (artigo.trecho_novo.length > 50) score += 0.1;
  if (artigo.numero && artigo.titulo) score += 0.05;
  return Math.min(1, Math.round(score * 100) / 100);
}

function computeAverageComplexity(list: NivelComplexidade[]): NivelComplexidade {
  if (list.length === 0) return 'simples';
  const scores: Record<NivelComplexidade, number> = { simples: 1, moderado: 2, complexo: 3 };
  const avg = list.reduce((s, c) => s + scores[c], 0) / list.length;
  if (avg >= 2.5) return 'complexo';
  if (avg >= 1.5) return 'moderado';
  return 'simples';
}
