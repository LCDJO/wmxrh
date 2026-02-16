/**
 * S-2206 Layout Mapper — Alteração de Contrato de Trabalho
 *
 * Maps salary adjustments / contract changes to eSocial S-2206.
 * Layout version: S-1.2
 */

import type { LayoutMapper, ValidationResult } from '../types';
import { CURRENT_LAYOUT_VERSION } from '../types';

export interface S2206Input {
  employee_id: string;
  cpf: string;
  company_document: string;
  effective_date: string;
  new_salary: number;
  position_title: string;
  cbo_code?: string;
  reason?: string;
}

export const s2206Mapper: LayoutMapper<S2206Input> = {
  event_type: 'S-2206',
  layout_version: CURRENT_LAYOUT_VERSION,

  map(input: S2206Input): Record<string, unknown> {
    return {
      eSocial: {
        evtAltContratual: {
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
          altContratual: {
            dtAlteracao: input.effective_date,
            infoContrato: {
              nmCargo: input.position_title,
              CBOCargo: input.cbo_code || '000000',
              vrSalFx: input.new_salary,
              undSalFixo: 5,
            },
          },
        },
      },
    };
  },

  validate(payload: Record<string, unknown>): ValidationResult {
    const errors: { field: string; message: string; code: string }[] = [];
    const evt = (payload as any)?.eSocial?.evtAltContratual;

    if (!evt) {
      errors.push({ field: 'eSocial.evtAltContratual', message: 'Evento ausente', code: 'MISSING_ROOT' });
      return { valid: false, errors };
    }

    if (!evt.altContratual?.dtAlteracao) {
      errors.push({ field: 'dtAlteracao', message: 'Data de alteração obrigatória', code: 'MISSING_DATE' });
    }

    const salary = evt.altContratual?.infoContrato?.vrSalFx;
    if (!salary || salary <= 0) {
      errors.push({ field: 'vrSalFx', message: 'Novo salário deve ser maior que zero', code: 'INVALID_SALARY' });
    }

    return { valid: errors.length === 0, errors };
  },
};
