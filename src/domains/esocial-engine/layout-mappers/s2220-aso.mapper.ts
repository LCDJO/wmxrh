/**
 * S-2220 Layout Mapper — ASO / Monitoramento da Saúde
 *
 * Maps health exams to eSocial S-2220 (SST).
 * Layout version: S-1.2
 */

import type { LayoutMapper, ValidationResult } from '../types';
import { CURRENT_LAYOUT_VERSION } from '../types';

export interface S2220Input {
  employee_id: string;
  cpf: string;
  company_document: string;
  exam_date: string;
  exam_type: 'admissional' | 'periodico' | 'demissional' | 'mudanca_funcao' | 'retorno_trabalho';
  result: 'apto' | 'inapto' | 'apto_restricao';
  physician_name: string;
  physician_crm: string;
  next_exam_date?: string;
  cbo_code?: string;
}

const EXAM_TYPE_MAP: Record<string, number> = {
  admissional: 0,
  periodico: 1,
  retorno_trabalho: 2,
  mudanca_funcao: 3,
  demissional: 4,
};

const RESULT_MAP: Record<string, number> = {
  apto: 1,
  inapto: 2,
  apto_restricao: 3,
};

export const s2220Mapper: LayoutMapper<S2220Input> = {
  event_type: 'S-2220',
  layout_version: CURRENT_LAYOUT_VERSION,

  map(input: S2220Input): Record<string, unknown> {
    return {
      eSocial: {
        evtMonit: {
          ideEvento: {
            indRetif: 1,
            tpAmb: 2,
            procEmi: 1,
            verProc: '1.0.0',
          },
          ideEmpregador: {
            tpInsc: 1,
            nrInsc: input.company_document?.replace(/\D/g, ''),
          },
          ideVinculo: {
            cpfTrab: input.cpf?.replace(/\D/g, ''),
            matricula: input.employee_id.substring(0, 30),
          },
          exMedOcup: {
            tpExameOcup: EXAM_TYPE_MAP[input.exam_type] ?? 1,
            aso: {
              dtAso: input.exam_date,
              resAso: RESULT_MAP[input.result] ?? 1,
              medico: {
                nmMed: input.physician_name,
                nrCRM: input.physician_crm,
                ufCRM: 'SP', // Default, should be enriched
              },
            },
          },
        },
      },
    };
  },

  validate(payload: Record<string, unknown>): ValidationResult {
    const errors: { field: string; message: string; code: string }[] = [];
    const evt = (payload as any)?.eSocial?.evtMonit;

    if (!evt) {
      errors.push({ field: 'eSocial.evtMonit', message: 'Evento ausente', code: 'MISSING_ROOT' });
      return { valid: false, errors };
    }

    if (!evt.exMedOcup?.aso?.dtAso) {
      errors.push({ field: 'dtAso', message: 'Data do ASO obrigatória', code: 'MISSING_DATE' });
    }

    if (!evt.exMedOcup?.aso?.medico?.nmMed) {
      errors.push({ field: 'nmMed', message: 'Nome do médico obrigatório', code: 'MISSING_PHYSICIAN' });
    }

    return { valid: errors.length === 0, errors };
  },
};
