/**
 * S-2299 Layout Mapper — Desligamento
 *
 * Maps internal Employee termination data to eSocial S-2299 layout.
 * Layout version: S-1.2
 */

import type { LayoutMapper, ValidationResult } from '../types';
import { CURRENT_LAYOUT_VERSION } from '../types';

export interface S2299Input {
  employee_id: string;
  cpf: string;
  company_document: string;
  matricula: string;
  termination_date: string;
  /** Motivo do desligamento — Tabela 19 eSocial */
  termination_reason_code: string;
  last_effective_date: string;
  /** Verbas rescisórias */
  notice_type?: 'trabalhado' | 'indenizado' | 'dispensado';
  notice_start_date?: string;
  fgts_guide_date?: string;
  pending_salary_days?: number;
  vacation_days?: number;
  thirteenth_proportional?: number;
}

export const s2299Mapper: LayoutMapper<S2299Input> = {
  event_type: 'S-2299',
  layout_version: CURRENT_LAYOUT_VERSION,

  map(input: S2299Input): Record<string, unknown> {
    const noticeTypeMap: Record<string, number> = {
      trabalhado: 1,
      indenizado: 2,
      dispensado: 3,
    };

    return {
      eSocial: {
        evtDeslig: {
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
            matricula: input.matricula.substring(0, 30),
          },
          infoDeslig: {
            mtvDeslig: input.termination_reason_code,
            dtDeslig: input.termination_date,
            dtUltDiaServ: input.last_effective_date || input.termination_date,
            indPagtoAPI: 1, // Na data do desligamento
            dtProjFimAPI: null,
            ...(input.notice_type
              ? {
                  observacoes: [
                    {
                      observacao: `Aviso prévio: ${input.notice_type}`,
                    },
                  ],
                }
              : {}),
            ...(input.notice_type
              ? {
                  infoAvisoPrevio: {
                    tpAvisoP: noticeTypeMap[input.notice_type] || 3,
                    dtAvPrv: input.notice_start_date || input.termination_date,
                  },
                }
              : {}),
            verbasResc: {
              dmDev: [
                {
                  ideDmDev: 'D001',
                  infoPerApur: {
                    ideEstabLot: [
                      {
                        tpInsc: 1,
                        nrInsc: input.company_document?.replace(/\D/g, ''),
                        detVerbas: [],
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };
  },

  validate(payload: Record<string, unknown>): ValidationResult {
    const errors: { field: string; message: string; code: string }[] = [];
    const evt = (payload as any)?.eSocial?.evtDeslig;

    if (!evt) {
      errors.push({ field: 'eSocial.evtDeslig', message: 'Evento obrigatório ausente', code: 'MISSING_ROOT' });
      return { valid: false, errors };
    }

    const cpf = evt?.ideVinculo?.cpfTrab;
    if (!cpf || cpf.length !== 11) {
      errors.push({ field: 'ideVinculo.cpfTrab', message: 'CPF deve conter 11 dígitos', code: 'INVALID_CPF' });
    }

    const dtDeslig = evt?.infoDeslig?.dtDeslig;
    if (!dtDeslig) {
      errors.push({ field: 'infoDeslig.dtDeslig', message: 'Data de desligamento obrigatória', code: 'MISSING_DT_DESLIG' });
    }

    const mtvDeslig = evt?.infoDeslig?.mtvDeslig;
    if (!mtvDeslig) {
      errors.push({ field: 'infoDeslig.mtvDeslig', message: 'Motivo de desligamento obrigatório (Tab. 19)', code: 'MISSING_MOTIVO' });
    }

    const nrInsc = evt?.ideEmpregador?.nrInsc;
    if (!nrInsc || nrInsc.length < 8) {
      errors.push({ field: 'ideEmpregador.nrInsc', message: 'CNPJ do empregador inválido', code: 'INVALID_CNPJ' });
    }

    return { valid: errors.length === 0, errors };
  },
};
