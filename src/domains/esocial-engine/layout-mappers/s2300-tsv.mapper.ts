/**
 * S-2300 Layout Mapper — Trabalhador Sem Vínculo de Emprego (TSV)
 *
 * Maps internal Employee entity to eSocial S-2300 layout.
 * Covers: estagiários, autônomos, diretores sem vínculo, cooperados.
 * Layout version: S-1.2
 */

import type { LayoutMapper, ValidationResult } from '../types';
import { CURRENT_LAYOUT_VERSION } from '../types';

export interface S2300Input {
  employee_id: string;
  name: string;
  cpf: string;
  start_date: string;
  company_document: string;
  company_name: string;
  /** eSocial category: 201, 202, 301, 302, 305, 401, etc. */
  category: string;
  position_title?: string;
  cbo_code?: string;
  remuneration?: number;
  /** Estágio fields */
  internship_institution?: string;
  internship_area?: string;
  internship_supervisor?: string;
  contract_end_date?: string;
}

export const s2300Mapper: LayoutMapper<S2300Input> = {
  event_type: 'S-2300',
  layout_version: CURRENT_LAYOUT_VERSION,

  map(input: S2300Input): Record<string, unknown> {
    const isInternship = input.category?.startsWith('3');

    return {
      eSocial: {
        evtTSVInicio: {
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
          trabalhador: {
            cpfTrab: input.cpf?.replace(/\D/g, ''),
            nmTrab: input.name,
          },
          infoTSVInicio: {
            cadIni: 'S',
            codCateg: input.category,
            dtInicio: input.start_date,
            natAtividade: isInternship ? 2 : 1,
            infoComplementares: {
              cargoFuncao: {
                nmCargo: input.position_title || 'Não informado',
                CBOCargo: input.cbo_code || '000000',
              },
              ...(input.remuneration
                ? {
                    remuneracao: {
                      vrSalFx: input.remuneration,
                      undSalFixo: 5, // Mensal
                    },
                  }
                : {}),
              ...(isInternship
                ? {
                    infoEstagiario: {
                      natEstagio: 'O',
                      instEnsino: {
                        nmRazao: input.internship_institution || '',
                      },
                      ageIntegracao: null,
                      supervisorEstagio: input.internship_supervisor
                        ? { nmSuperv: input.internship_supervisor }
                        : null,
                    },
                  }
                : {}),
            },
          },
        },
      },
    };
  },

  validate(payload: Record<string, unknown>): ValidationResult {
    const errors: { field: string; message: string; code: string }[] = [];
    const evt = (payload as any)?.eSocial?.evtTSVInicio;

    if (!evt) {
      errors.push({ field: 'eSocial.evtTSVInicio', message: 'Evento obrigatório ausente', code: 'MISSING_ROOT' });
      return { valid: false, errors };
    }

    const cpf = evt?.trabalhador?.cpfTrab;
    if (!cpf || cpf.length !== 11) {
      errors.push({ field: 'trabalhador.cpfTrab', message: 'CPF deve conter 11 dígitos', code: 'INVALID_CPF' });
    }

    const dtInicio = evt?.infoTSVInicio?.dtInicio;
    if (!dtInicio) {
      errors.push({ field: 'infoTSVInicio.dtInicio', message: 'Data de início obrigatória', code: 'MISSING_DT_INICIO' });
    }

    const codCateg = evt?.infoTSVInicio?.codCateg;
    if (!codCateg) {
      errors.push({ field: 'infoTSVInicio.codCateg', message: 'Categoria do trabalhador obrigatória', code: 'MISSING_CATEGORY' });
    }

    const nrInsc = evt?.ideEmpregador?.nrInsc;
    if (!nrInsc || nrInsc.length < 8) {
      errors.push({ field: 'ideEmpregador.nrInsc', message: 'CNPJ do empregador inválido', code: 'INVALID_CNPJ' });
    }

    return { valid: errors.length === 0, errors };
  },
};
