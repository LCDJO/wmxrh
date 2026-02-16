/**
 * S-2240 Layout Mapper — Condições Ambientais do Trabalho - Agentes Nocivos
 *
 * Maps internal risk exposure data to eSocial S-2240 layout.
 * Layout version: S-1.2
 *
 * Triggered by: risk_exposure.created
 */

import type { LayoutMapper, ValidationResult } from '../types';
import { CURRENT_LAYOUT_VERSION } from '../types';

export interface S2240Input {
  employee_id: string;
  cpf: string;
  company_document: string;
  /** Data de início da exposição */
  start_date: string;
  /** Código do agente nocivo (Tabela 24 eSocial) */
  risk_agent_code: string;
  risk_agent_description?: string;
  /** Intensidade/concentração */
  intensity?: string;
  /** Técnica utilizada na medição */
  measurement_technique?: string;
  /** Uso de EPI: 0=Não aplica, 1=Eficaz, 2=Não eficaz */
  epi_efficacy?: 0 | 1 | 2;
  /** Descrição do EPI */
  epi_description?: string;
  /** Número do CA do EPI */
  epi_ca_number?: string;
  /** Descrição da atividade */
  activity_description?: string;
  /** Código CBO */
  cbo_code?: string;
}

export const s2240Mapper: LayoutMapper<S2240Input> = {
  event_type: 'S-2240',
  layout_version: CURRENT_LAYOUT_VERSION,

  map(input: S2240Input): Record<string, unknown> {
    const cnpj = input.company_document?.replace(/\D/g, '') || '';
    const cpf = input.cpf?.replace(/\D/g, '') || '';

    const agNoc: Record<string, unknown> = {
      codAgNoc: input.risk_agent_code,
      dscAgNoc: input.risk_agent_description || '',
      tpAval: input.measurement_technique ? 2 : 1, // 1=Critério qualitativo, 2=Critério quantitativo
    };

    if (input.intensity) {
      agNoc.intConc = input.intensity;
    }

    // EPI info
    if (input.epi_efficacy !== undefined) {
      agNoc.epcEpi = {
        utilizEPC: 0,
        eficEpc: 'N',
        utilizEPI: input.epi_efficacy > 0 ? 1 : 0,
        eficEpi: input.epi_efficacy === 1 ? 'S' : 'N',
        ...(input.epi_ca_number ? {
          epi: [{
            caEPI: input.epi_ca_number,
            dscEPI: input.epi_description || '',
          }],
        } : {}),
      };
    }

    return {
      eSocial: {
        evtExpRisco: {
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
          ideVinculo: {
            cpfTrab: cpf,
            matricula: input.employee_id.substring(0, 30),
          },
          infoExpRisco: {
            dtIniCondicao: input.start_date,
            infoAmb: {
              localAmb: 1, // Estabelecimento do empregador
              dscSetor: input.activity_description || 'Setor de trabalho',
              tpInsc: 1,
              nrInsc: cnpj,
            },
            infoAtiv: {
              dscAtivDes: input.activity_description || 'Atividade habitual',
            },
            agNoc: [agNoc],
          },
        },
      },
    };
  },

  validate(payload: Record<string, unknown>): ValidationResult {
    const errors: { field: string; message: string; code: string }[] = [];
    const evt = (payload as any)?.eSocial?.evtExpRisco;

    if (!evt) {
      errors.push({ field: 'eSocial.evtExpRisco', message: 'Evento obrigatório ausente', code: 'MISSING_ROOT' });
      return { valid: false, errors };
    }

    const cpf = evt?.ideVinculo?.cpfTrab;
    if (!cpf || cpf.length !== 11) {
      errors.push({ field: 'ideVinculo.cpfTrab', message: 'CPF deve conter 11 dígitos', code: 'INVALID_CPF' });
    }

    const nrInsc = evt?.ideEmpregador?.nrInsc;
    if (!nrInsc || nrInsc.length < 8) {
      errors.push({ field: 'ideEmpregador.nrInsc', message: 'CNPJ raiz inválido', code: 'INVALID_CNPJ' });
    }

    const dtIni = evt?.infoExpRisco?.dtIniCondicao;
    if (!dtIni) {
      errors.push({ field: 'infoExpRisco.dtIniCondicao', message: 'Data de início da condição obrigatória', code: 'MISSING_DT_INI' });
    }

    const agNocList = evt?.infoExpRisco?.agNoc;
    if (!Array.isArray(agNocList) || agNocList.length === 0) {
      errors.push({ field: 'infoExpRisco.agNoc', message: 'Pelo menos um agente nocivo é obrigatório', code: 'MISSING_AG_NOC' });
    } else {
      for (const ag of agNocList) {
        if (!ag.codAgNoc) {
          errors.push({ field: 'agNoc.codAgNoc', message: 'Código do agente nocivo obrigatório', code: 'MISSING_COD_AG_NOC' });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  },
};
