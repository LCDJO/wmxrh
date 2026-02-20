/**
 * Regulatory Monitor Engine — Pure analysis (no I/O)
 *
 * Detects changes in the legislative landscape by comparing
 * known norms against incoming data from government sources.
 *
 * Integrations:
 *  - Government Integration Gateway (source data)
 *  - Occupational Intelligence (NR catalog)
 *  - External Data Service (NR version checks)
 */

import type {
  RegulatoryNorm,
  NormVersion,
  MonitorCheckInput,
  NormaTipo,
  UpdateSourceType,
} from './types';

export interface MonitorCheckResult {
  new_norms: DetectedNormChange[];
  updated_norms: DetectedNormChange[];
  revoked_norms: DetectedNormChange[];
  total_changes: number;
  checked_at: string;
}

export interface DetectedNormChange {
  codigo: string;
  tipo: NormaTipo;
  titulo: string;
  change_type: 'new' | 'updated' | 'revoked';
  resumo: string;
  data_publicacao: string;
  source: UpdateSourceType;
  confidence: number; // 0-1
}

// ── Known NR versions (static reference) ──
const KNOWN_NR_VERSIONS: Record<number, { titulo: string; ultima_revisao: string }> = {
  1: { titulo: 'Disposições Gerais e Gerenciamento de Riscos Ocupacionais', ultima_revisao: '2024-08-27' },
  4: { titulo: 'Serviços Especializados em Segurança e Medicina do Trabalho', ultima_revisao: '2022-01-03' },
  5: { titulo: 'Comissão Interna de Prevenção de Acidentes', ultima_revisao: '2024-08-27' },
  6: { titulo: 'Equipamento de Proteção Individual', ultima_revisao: '2022-01-03' },
  7: { titulo: 'Programa de Controle Médico de Saúde Ocupacional', ultima_revisao: '2024-01-01' },
  9: { titulo: 'Avaliação e Controle das Exposições Ocupacionais', ultima_revisao: '2023-04-26' },
  10: { titulo: 'Segurança em Instalações e Serviços em Eletricidade', ultima_revisao: '2022-01-03' },
  12: { titulo: 'Segurança no Trabalho em Máquinas e Equipamentos', ultima_revisao: '2022-01-03' },
  15: { titulo: 'Atividades e Operações Insalubres', ultima_revisao: '2022-01-03' },
  16: { titulo: 'Atividades e Operações Perigosas', ultima_revisao: '2022-01-03' },
  17: { titulo: 'Ergonomia', ultima_revisao: '2022-01-03' },
  18: { titulo: 'Segurança e Saúde no Trabalho na Indústria da Construção', ultima_revisao: '2022-01-03' },
  20: { titulo: 'Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis', ultima_revisao: '2022-01-03' },
  23: { titulo: 'Proteção Contra Incêndios', ultima_revisao: '2022-01-03' },
  24: { titulo: 'Condições Sanitárias e de Conforto nos Locais de Trabalho', ultima_revisao: '2022-01-03' },
  25: { titulo: 'Resíduos Industriais', ultima_revisao: '2022-01-03' },
  26: { titulo: 'Sinalização de Segurança', ultima_revisao: '2022-01-03' },
  28: { titulo: 'Fiscalização e Penalidades', ultima_revisao: '2022-01-03' },
  29: { titulo: 'Norma Regulamentadora de Segurança e Saúde no Trabalho Portuário', ultima_revisao: '2022-01-03' },
  33: { titulo: 'Segurança e Saúde nos Trabalhos em Espaços Confinados', ultima_revisao: '2022-01-03' },
  34: { titulo: 'Condições e Meio Ambiente de Trabalho na Indústria da Construção e Reparação Naval', ultima_revisao: '2022-01-03' },
  35: { titulo: 'Trabalho em Altura', ultima_revisao: '2022-01-03' },
  36: { titulo: 'Segurança e Saúde no Trabalho em Empresas de Abate', ultima_revisao: '2022-01-03' },
  37: { titulo: 'Segurança e Saúde em Plataformas de Petróleo', ultima_revisao: '2022-01-03' },
  38: { titulo: 'Segurança e Saúde no Trabalho nas Atividades de Limpeza Urbana', ultima_revisao: '2022-12-15' },
};

/**
 * Checks for regulatory changes by comparing known norms against reference data.
 * Pure function — no I/O, suitable for edge function or client-side use.
 */
export function checkForChanges(input: MonitorCheckInput): MonitorCheckResult {
  const { config, current_norms } = input;
  const now = new Date().toISOString();
  const changes: DetectedNormChange[] = [];

  // Check NRs
  if (config.nrs_especificas.length > 0 || config.tipos_monitorados.includes('NR')) {
    const nrsToCheck = config.nrs_especificas.length > 0
      ? config.nrs_especificas
      : Object.keys(KNOWN_NR_VERSIONS).map(Number);

    for (const nr of nrsToCheck) {
      const known = KNOWN_NR_VERSIONS[nr];
      if (!known) continue;

      const existingNorm = current_norms.find(
        n => n.tipo === 'NR' && n.codigo === `NR-${nr}`
      );

      if (!existingNorm) {
        changes.push({
          codigo: `NR-${nr}`,
          tipo: 'NR',
          titulo: known.titulo,
          change_type: 'new',
          resumo: `NR-${nr} não está registrada na base interna. Recomenda-se cadastrar.`,
          data_publicacao: known.ultima_revisao,
          source: 'manual',
          confidence: 1.0,
        });
      } else if (existingNorm.updated_at < known.ultima_revisao) {
        changes.push({
          codigo: `NR-${nr}`,
          tipo: 'NR',
          titulo: known.titulo,
          change_type: 'updated',
          resumo: `NR-${nr} possui atualização mais recente (${known.ultima_revisao}) que a versão registrada.`,
          data_publicacao: known.ultima_revisao,
          source: 'manual',
          confidence: 0.8,
        });
      }
    }
  }

  const newNorms = changes.filter(c => c.change_type === 'new');
  const updatedNorms = changes.filter(c => c.change_type === 'updated');
  const revokedNorms = changes.filter(c => c.change_type === 'revoked');

  return {
    new_norms: newNorms,
    updated_norms: updatedNorms,
    revoked_norms: revokedNorms,
    total_changes: changes.length,
    checked_at: now,
  };
}

/**
 * Returns the known NR reference catalog.
 */
export function getKnownNrCatalog(): Record<number, { titulo: string; ultima_revisao: string }> {
  return { ...KNOWN_NR_VERSIONS };
}
