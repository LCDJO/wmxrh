/**
 * S-1010 Layout Mapper — Tabela de Rubricas
 *
 * Maps internal salary rubric definitions to eSocial S-1010 layout.
 * Layout version: S-1.2
 *
 * Triggered by: rubric.created
 */

import type { LayoutMapper, ValidationResult } from '../types';
import { CURRENT_LAYOUT_VERSION } from '../types';

export interface S1010Input {
  rubric_id: string;
  company_document: string;
  /** Código da rubrica (e.g. "001") */
  code: string;
  /** Identificador da tabela de rubricas */
  table_id?: string;
  name: string;
  /** Natureza da rubrica (código eSocial: 1000–9999) */
  nature_code: string;
  /** 1=Provento, 2=Desconto, 3=Informativa */
  type: 1 | 2 | 3;
  /** Incidência tributária sobre IRRF: 0–4 */
  irrf_incidence?: number;
  /** Incidência sobre contribuição previdenciária: 0–4 */
  cp_incidence?: number;
  /** Incidência sobre FGTS: 0–4 */
  fgts_incidence?: number;
  /** Observações */
  description?: string;
}

export const s1010Mapper: LayoutMapper<S1010Input> = {
  event_type: 'S-1010',
  layout_version: CURRENT_LAYOUT_VERSION,

  map(input: S1010Input): Record<string, unknown> {
    const cnpj = input.company_document?.replace(/\D/g, '') || '';
    return {
      eSocial: {
        evtTabRubrica: {
          ideEvento: {
            indRetif: 1,
            tpAmb: 2,
            procEmi: 1,
            verProc: '1.0.0',
          },
          ideEmpregador: {
            tpInsc: 1,
            nrInsc: cnpj.substring(0, 8),
          },
          infoRubrica: {
            inclusao: {
              ideRubrica: {
                codRubr: input.code,
                ideTabRubr: input.table_id || 'TAB01',
                iniValid: new Date().toISOString().slice(0, 7),
              },
              dadosRubrica: {
                dscRubr: input.name,
                natRubr: input.nature_code,
                tpRubr: input.type,
                codIncCP: input.cp_incidence ?? 0,
                codIncIRRF: input.irrf_incidence ?? 0,
                codIncFGTS: input.fgts_incidence ?? 0,
                observacao: input.description || null,
              },
            },
          },
        },
      },
    };
  },

  validate(payload: Record<string, unknown>): ValidationResult {
    const errors: { field: string; message: string; code: string }[] = [];
    const evt = (payload as any)?.eSocial?.evtTabRubrica;

    if (!evt) {
      errors.push({ field: 'eSocial.evtTabRubrica', message: 'Evento obrigatório ausente', code: 'MISSING_ROOT' });
      return { valid: false, errors };
    }

    const nrInsc = evt?.ideEmpregador?.nrInsc;
    if (!nrInsc || nrInsc.length < 8) {
      errors.push({ field: 'ideEmpregador.nrInsc', message: 'CNPJ raiz inválido', code: 'INVALID_CNPJ' });
    }

    const inclusao = evt?.infoRubrica?.inclusao;
    if (!inclusao?.ideRubrica?.codRubr) {
      errors.push({ field: 'ideRubrica.codRubr', message: 'Código da rubrica obrigatório', code: 'MISSING_COD_RUBR' });
    }

    if (!inclusao?.dadosRubrica?.dscRubr) {
      errors.push({ field: 'dadosRubrica.dscRubr', message: 'Descrição da rubrica obrigatória', code: 'MISSING_DSC_RUBR' });
    }

    const natRubr = inclusao?.dadosRubrica?.natRubr;
    if (!natRubr || String(natRubr).length < 4) {
      errors.push({ field: 'dadosRubrica.natRubr', message: 'Natureza da rubrica inválida (4 dígitos)', code: 'INVALID_NAT_RUBR' });
    }

    const tpRubr = inclusao?.dadosRubrica?.tpRubr;
    if (![1, 2, 3].includes(tpRubr)) {
      errors.push({ field: 'dadosRubrica.tpRubr', message: 'Tipo de rubrica deve ser 1, 2 ou 3', code: 'INVALID_TP_RUBR' });
    }

    return { valid: errors.length === 0, errors };
  },
};
