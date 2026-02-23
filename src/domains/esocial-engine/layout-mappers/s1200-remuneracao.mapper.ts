/**
 * S-1200 Layout Mapper — Remuneração do Trabalhador Vinculado
 *
 * Maps payroll/remuneration data to eSocial S-1200 layout.
 * Layout version: S-1.2
 */

import type { LayoutMapper, ValidationResult } from '../types';
import { CURRENT_LAYOUT_VERSION } from '../types';

export interface S1200RubricaItem {
  /** Código da rubrica (must match S-1010) */
  code: string;
  /** Tipo: 1=Provento, 2=Desconto, 3=Informativa */
  type: 1 | 2 | 3;
  value: number;
}

export interface S1200Input {
  employee_id: string;
  cpf: string;
  matricula: string;
  company_document: string;
  /** Período de apuração YYYY-MM */
  competencia: string;
  /** Rubricas */
  items: S1200RubricaItem[];
  /** Indicativo de apuração: 1=Mensal, 2=Anual(13o) */
  ind_apuracao?: number;
}

export const s1200Mapper: LayoutMapper<S1200Input> = {
  event_type: 'S-1200',
  layout_version: CURRENT_LAYOUT_VERSION,

  map(input: S1200Input): Record<string, unknown> {
    const detVerbas = input.items.map((item) => ({
      codRubr: item.code,
      ideTabRubr: 'TAB1',
      qtdRubr: null,
      fatorRubr: null,
      vrUnit: null,
      vrRubr: item.value,
    }));

    return {
      eSocial: {
        evtRemun: {
          ideEvento: {
            indRetif: 1,
            tpAmb: 2,
            procEmi: 1,
            verProc: '1.0.0',
            indApuracao: input.ind_apuracao || 1,
            perApur: input.competencia,
          },
          ideEmpregador: {
            tpInsc: 1,
            nrInsc: input.company_document?.replace(/\D/g, ''),
          },
          ideTrabalhador: {
            cpfTrab: input.cpf?.replace(/\D/g, ''),
          },
          dmDev: [
            {
              ideDmDev: 'D001',
              codCateg: null,
              infoPerApur: {
                ideEstabLot: [
                  {
                    tpInsc: 1,
                    nrInsc: input.company_document?.replace(/\D/g, ''),
                    codLotacao: 'LOT1',
                    detVerbas,
                  },
                ],
              },
            },
          ],
        },
      },
    };
  },

  validate(payload: Record<string, unknown>): ValidationResult {
    const errors: { field: string; message: string; code: string }[] = [];
    const evt = (payload as any)?.eSocial?.evtRemun;

    if (!evt) {
      errors.push({ field: 'eSocial.evtRemun', message: 'Evento obrigatório ausente', code: 'MISSING_ROOT' });
      return { valid: false, errors };
    }

    const cpf = evt?.ideTrabalhador?.cpfTrab;
    if (!cpf || cpf.length !== 11) {
      errors.push({ field: 'ideTrabalhador.cpfTrab', message: 'CPF deve conter 11 dígitos', code: 'INVALID_CPF' });
    }

    const perApur = evt?.ideEvento?.perApur;
    if (!perApur || !/^\d{4}-\d{2}$/.test(perApur)) {
      errors.push({ field: 'ideEvento.perApur', message: 'Período de apuração deve ser YYYY-MM', code: 'INVALID_PER_APUR' });
    }

    const dmDev = evt?.dmDev;
    if (!dmDev || !Array.isArray(dmDev) || dmDev.length === 0) {
      errors.push({ field: 'dmDev', message: 'Pelo menos uma demonstração de valores é obrigatória', code: 'MISSING_DM_DEV' });
    }

    const nrInsc = evt?.ideEmpregador?.nrInsc;
    if (!nrInsc || nrInsc.length < 8) {
      errors.push({ field: 'ideEmpregador.nrInsc', message: 'CNPJ do empregador inválido', code: 'INVALID_CNPJ' });
    }

    return { valid: errors.length === 0, errors };
  },
};
