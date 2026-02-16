/**
 * S-2200 Layout Mapper — Cadastramento Inicial / Admissão
 *
 * Maps internal Employee entity to eSocial S-2200 layout.
 * Layout version: S-1.2
 *
 * Reference: Manual de Orientação do eSocial v. S-1.2
 */

import type { LayoutMapper, ValidationResult } from '../types';
import { CURRENT_LAYOUT_VERSION } from '../types';

export interface S2200Input {
  employee_id: string;
  name: string;
  cpf: string;
  hire_date: string;
  base_salary: number;
  position_title: string;
  company_document: string;
  company_name: string;
  department_name?: string;
  cbo_code?: string;
  work_schedule?: string;
}

export const s2200Mapper: LayoutMapper<S2200Input> = {
  event_type: 'S-2200',
  layout_version: CURRENT_LAYOUT_VERSION,

  map(input: S2200Input): Record<string, unknown> {
    return {
      eSocial: {
        evtAdmissao: {
          ideEvento: {
            indRetif: 1, // Original
            tpAmb: 2,    // Produção restrita (testing)
            procEmi: 1,  // Aplicativo do empregador
            verProc: '1.0.0',
          },
          ideEmpregador: {
            tpInsc: 1, // CNPJ
            nrInsc: input.company_document?.replace(/\D/g, ''),
          },
          trabalhador: {
            cpfTrab: input.cpf?.replace(/\D/g, ''),
            nmTrab: input.name,
            nascimento: {}, // To be enriched with DOB when available
          },
          vinculo: {
            matricula: input.employee_id.substring(0, 30),
            tpRegTrab: 1, // CLT
            tpRegPrev: 1, // RGPS
            cadIni: 'S',  // Cadastramento inicial
            dtAdm: input.hire_date,
            infoRegimeTrab: {
              infoCeletista: {
                dtAdm: input.hire_date,
                tpAdmissao: 1, // Admissão
                indAdmissao: 1, // Normal
                tpRegJor: 1,    // Jornada com controle de ponto
              },
            },
            infoContrato: {
              nmCargo: input.position_title,
              CBOCargo: input.cbo_code || '000000',
              vrSalFx: input.base_salary,
              undSalFixo: 5, // Mensal
              dscSalVar: null,
              horContratual: {
                qtdHrsSem: 44,
                tpJornada: 2, // Jornada com horário diurno
              },
            },
          },
        },
      },
    };
  },

  validate(payload: Record<string, unknown>): ValidationResult {
    const errors: { field: string; message: string; code: string }[] = [];
    const evt = (payload as any)?.eSocial?.evtAdmissao;

    if (!evt) {
      errors.push({ field: 'eSocial.evtAdmissao', message: 'Evento obrigatório ausente', code: 'MISSING_ROOT' });
      return { valid: false, errors };
    }

    const cpf = evt?.trabalhador?.cpfTrab;
    if (!cpf || cpf.length !== 11) {
      errors.push({ field: 'trabalhador.cpfTrab', message: 'CPF deve conter 11 dígitos', code: 'INVALID_CPF' });
    }

    const dtAdm = evt?.vinculo?.dtAdm;
    if (!dtAdm) {
      errors.push({ field: 'vinculo.dtAdm', message: 'Data de admissão obrigatória', code: 'MISSING_DT_ADM' });
    }

    const salary = evt?.vinculo?.infoContrato?.vrSalFx;
    if (!salary || salary <= 0) {
      errors.push({ field: 'infoContrato.vrSalFx', message: 'Salário deve ser maior que zero', code: 'INVALID_SALARY' });
    }

    const nrInsc = evt?.ideEmpregador?.nrInsc;
    if (!nrInsc || nrInsc.length < 8) {
      errors.push({ field: 'ideEmpregador.nrInsc', message: 'CNPJ do empregador inválido', code: 'INVALID_CNPJ' });
    }

    return { valid: errors.length === 0, errors };
  },
};
