/**
 * Career Intelligence — Future Preparation Module
 *
 * Stub services for future features:
 *  1. External salary benchmarking (market data integration)
 *  2. AI-powered organizational structure suggestions
 *  3. Automatic legislation updates (NR/CLT/CCT monitoring)
 *  4. Union/syndicate integration (CCT auto-import)
 *
 * All services follow the "available but pending" pattern:
 * they expose typed interfaces, return meaningful stubs,
 * and gate access by plan tier.
 */

import type {
  CareerPosition,
  CareerSalaryBenchmark,
  BenchmarkFonte,
  CareerNivel,
} from './types';

// ═══════════════════════════════════════════════════════════════
// 1) EXTERNAL SALARY BENCHMARKING
// ═══════════════════════════════════════════════════════════════

export interface ExternalBenchmarkSource {
  id: string;
  name: string;
  type: 'api' | 'csv_upload' | 'manual';
  description: string;
  available: boolean;
}

export interface ExternalBenchmarkResult {
  position_name: string;
  cbo_codigo: string | null;
  region: string;
  fonte: BenchmarkFonte;
  valor_minimo: number;
  valor_mediano: number;
  valor_maximo: number;
  sample_size: number;
  referencia_data: string;
  source_name: string;
}

export interface ExternalBenchmarkQuery {
  cbo_codigo?: string;
  position_name?: string;
  region?: string;
  nivel?: CareerNivel;
}

export function createExternalBenchmarkService() {
  const sources: ExternalBenchmarkSource[] = [
    { id: 'caged', name: 'CAGED/RAIS (MTE)', type: 'api', description: 'Dados oficiais do Ministério do Trabalho', available: false },
    { id: 'glassdoor', name: 'Glassdoor Brasil', type: 'api', description: 'Benchmark de mercado via Glassdoor', available: false },
    { id: 'salary_csv', name: 'Importação CSV', type: 'csv_upload', description: 'Upload de pesquisa salarial externa', available: false },
    { id: 'manual', name: 'Entrada Manual', type: 'manual', description: 'Cadastro manual de referências', available: true },
  ];

  return {
    getSources: () => sources,

    isAvailable: (planTier: string) =>
      planTier === 'professional' || planTier === 'enterprise',

    async queryBenchmark(
      _tenantId: string,
      query: ExternalBenchmarkQuery
    ): Promise<{ results: ExternalBenchmarkResult[]; warning: string }> {
      return {
        results: [],
        warning: `Benchmark externo ainda não está disponível. Consulta para CBO ${query.cbo_codigo ?? query.position_name ?? '—'} ficará disponível em breve.`,
      };
    },

    async importFromCsv(
      _tenantId: string,
      _fileData: unknown
    ): Promise<{ imported: number; errors: string[] }> {
      return {
        imported: 0,
        errors: ['Importação de benchmark via CSV não está disponível nesta versão.'],
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// 2) AI ORGANIZATIONAL STRUCTURE SUGGESTIONS
// ═══════════════════════════════════════════════════════════════

export interface OrgStructureSuggestion {
  type: 'new_position' | 'merge_positions' | 'split_position' | 'new_career_path' | 'salary_adjustment';
  title: string;
  description: string;
  confidence: number; // 0-1
  impact: 'baixo' | 'medio' | 'alto';
  affected_positions: string[];
  rationale: string;
}

export interface OrgAnalysisInput {
  positions: CareerPosition[];
  benchmarks: CareerSalaryBenchmark[];
  employee_count_by_position: Record<string, number>;
  total_employees: number;
}

export function createOrgStructureAIService() {
  return {
    isAvailable: (planTier: string) => planTier === 'enterprise',

    async analyzStructure(
      _tenantId: string,
      input: OrgAnalysisInput
    ): Promise<OrgStructureSuggestion[]> {
      const suggestions: OrgStructureSuggestion[] = [];

      // Rule-based fallback (no AI yet)
      for (const pos of input.positions) {
        const empCount = input.employee_count_by_position[pos.id] ?? 0;

        // Suggest split if too many employees in one position
        if (empCount > 20) {
          suggestions.push({
            type: 'split_position',
            title: `Considerar subdivisão de "${pos.nome}"`,
            description: `Cargo com ${empCount} colaboradores pode se beneficiar de níveis (Jr/Pl/Sr).`,
            confidence: 0.6,
            impact: 'medio',
            affected_positions: [pos.id],
            rationale: `Cargos com mais de 20 colaboradores sem diferenciação de nível dificultam a gestão de carreira e progressão salarial.`,
          });
        }

        // Suggest career path if position has no path
        if (pos.nivel === 'junior' && empCount > 5) {
          suggestions.push({
            type: 'new_career_path',
            title: `Criar trilha de carreira para "${pos.nome}"`,
            description: `Posição júnior com ${empCount} colaboradores se beneficiaria de uma trilha de progressão.`,
            confidence: 0.7,
            impact: 'alto',
            affected_positions: [pos.id],
            rationale: `Trilhas de carreira aumentam retenção e motivação. Posições júnior com volume significativo precisam de perspectiva de crescimento.`,
          });
        }

        // Salary gap detection
        const benchmarks = input.benchmarks.filter(b => b.career_position_id === pos.id);
        if (benchmarks.length > 0) {
          const latest = benchmarks.sort((a, b) =>
            new Date(b.referencia_data).getTime() - new Date(a.referencia_data).getTime()
          )[0];
          const midpoint = (pos.faixa_salarial_min + pos.faixa_salarial_max) / 2;
          const gap = ((midpoint - latest.valor_mediano) / latest.valor_mediano) * 100;

          if (gap < -15) {
            suggestions.push({
              type: 'salary_adjustment',
              title: `Ajustar faixa salarial de "${pos.nome}"`,
              description: `Faixa ${Math.abs(Math.round(gap))}% abaixo da mediana de mercado.`,
              confidence: 0.8,
              impact: 'alto',
              affected_positions: [pos.id],
              rationale: `Defasagem salarial acima de 15% aumenta risco de turnover e dificulta atração de talentos qualificados.`,
            });
          }
        }
      }

      return suggestions;
    },

    async generateReport(
      _tenantId: string,
      _input: OrgAnalysisInput
    ): Promise<{ available: false; message: string }> {
      return {
        available: false,
        message: 'Relatório de estrutura organizacional com IA será disponibilizado em breve. Atualmente disponível: análise baseada em regras.',
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// 3) AUTOMATIC LEGISLATION UPDATES
// ═══════════════════════════════════════════════════════════════

export interface LegislationUpdate {
  id: string;
  tipo: 'NR' | 'CLT' | 'CCT' | 'Portaria';
  referencia: string;
  titulo: string;
  resumo: string;
  data_publicacao: string;
  impacto: 'informativo' | 'acao_requerida' | 'urgente';
  posicoes_afetadas: string[];
  fonte_url: string | null;
}

export interface LegislationMonitorConfig {
  nrs_monitoradas: number[];
  monitorar_clt: boolean;
  monitorar_ccts: boolean;
  notificar_email: boolean;
  frequencia: 'diaria' | 'semanal' | 'mensal';
}

export function createLegislationMonitorService() {
  const defaultConfig: LegislationMonitorConfig = {
    nrs_monitoradas: [1, 4, 5, 6, 7, 9, 10, 12, 15, 16, 17, 18, 20, 23, 24, 25, 26, 28, 29, 33, 34, 35, 36, 37, 38],
    monitorar_clt: true,
    monitorar_ccts: true,
    notificar_email: false,
    frequencia: 'semanal',
  };

  return {
    isAvailable: (planTier: string) =>
      planTier === 'professional' || planTier === 'enterprise',

    getDefaultConfig: () => ({ ...defaultConfig }),

    async checkUpdates(
      _tenantId: string,
      _config?: Partial<LegislationMonitorConfig>
    ): Promise<{ updates: LegislationUpdate[]; last_checked: string; message: string }> {
      return {
        updates: [],
        last_checked: new Date().toISOString(),
        message: 'Monitoramento automático de legislação será ativado em breve. Atualização manual disponível via cadastro de referências legais.',
      };
    },

    async getKnownNrVersions(): Promise<Record<number, { versao: string; ultima_atualizacao: string }>> {
      // Static known versions (last known update)
      return {
        1: { versao: '2024', ultima_atualizacao: '2024-08-27' },
        4: { versao: '2022', ultima_atualizacao: '2022-01-03' },
        5: { versao: '2024', ultima_atualizacao: '2024-08-27' },
        6: { versao: '2022', ultima_atualizacao: '2022-01-03' },
        7: { versao: '2024', ultima_atualizacao: '2024-01-01' },
        9: { versao: '2023', ultima_atualizacao: '2023-04-26' },
        12: { versao: '2022', ultima_atualizacao: '2022-01-03' },
        15: { versao: '2022', ultima_atualizacao: '2022-01-03' },
        16: { versao: '2022', ultima_atualizacao: '2022-01-03' },
        17: { versao: '2022', ultima_atualizacao: '2022-01-03' },
        18: { versao: '2022', ultima_atualizacao: '2022-01-03' },
        35: { versao: '2022', ultima_atualizacao: '2022-01-03' },
      };
    },

    /** Returns which of the tenant's positions would be affected by a given NR update */
    assessImpact(
      nrNumber: number,
      positions: CareerPosition[],
      applicableNrsByPosition: Map<string, number[]>
    ): { position_id: string; position_name: string }[] {
      return positions
        .filter(p => {
          const nrs = applicableNrsByPosition.get(p.id) ?? [];
          return nrs.includes(nrNumber);
        })
        .map(p => ({ position_id: p.id, position_name: p.nome }));
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// 4) UNION / SYNDICATE INTEGRATION
// ═══════════════════════════════════════════════════════════════

export interface SyndicateInfo {
  id: string;
  nome: string;
  cnpj: string | null;
  uf: string;
  categoria: string;
  data_base_mes: number;
  piso_salarial: number | null;
  teto_salarial: number | null;
  jornada_semanal: number | null;
}

export interface CctSyncResult {
  synced: boolean;
  agreement_id: string | null;
  clauses_imported: number;
  salary_floor_updated: boolean;
  warnings: string[];
}

export function createSyndicateIntegrationService() {
  return {
    isAvailable: (planTier: string) => planTier === 'enterprise',

    async searchSyndicate(
      _query: string,
      _uf?: string
    ): Promise<{ results: SyndicateInfo[]; message: string }> {
      return {
        results: [],
        message: 'Busca de sindicatos será integrada com a base do MTE. Atualmente, cadastre manualmente via Convenções Coletivas.',
      };
    },

    async syncCct(
      _tenantId: string,
      _syndicateId: string
    ): Promise<CctSyncResult> {
      return {
        synced: false,
        agreement_id: null,
        clauses_imported: 0,
        salary_floor_updated: false,
        warnings: ['Sincronização automática de CCT não está disponível nesta versão. Cadastre a convenção manualmente.'],
      };
    },

    async checkCctExpiry(
      _tenantId: string
    ): Promise<{ expiring_soon: { agreement_id: string; union_name: string; valid_until: string; days_remaining: number }[]; message: string }> {
      return {
        expiring_soon: [],
        message: 'Verificação de vigência de CCTs será automatizada em breve.',
      };
    },

    /** Pure function: estimates salary floor from CCT data */
    estimateSalaryFloor(
      baseSalaryFloor: number,
      readjustmentPct: number | null,
      monthsSinceBaseDate: number
    ): number {
      if (!readjustmentPct || monthsSinceBaseDate < 12) return baseSalaryFloor;
      const years = Math.floor(monthsSinceBaseDate / 12);
      return Math.round(baseSalaryFloor * Math.pow(1 + readjustmentPct / 100, years));
    },
  };
}
