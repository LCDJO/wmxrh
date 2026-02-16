/**
 * S-1000 Layout Mapper — Informações do Empregador/Contribuinte
 *
 * Maps internal Company entity to eSocial S-1000 layout.
 * Layout version: S-1.2
 *
 * Triggered by: company.created
 */

import type { LayoutMapper, ValidationResult } from '../types';
import { CURRENT_LAYOUT_VERSION } from '../types';

export interface S1000Input {
  company_id: string;
  company_name: string;
  company_document: string;
  legal_nature?: string;
  address?: string;
  email?: string;
  phone?: string;
  classification_code?: string;
  /** FPAS code */
  fpas_code?: string;
  /** Tax regime: 1=Lucro Real, 2=Lucro Presumido, 3=Simples Nacional */
  tax_regime?: number;
}

export const s1000Mapper: LayoutMapper<S1000Input> = {
  event_type: 'S-1000',
  layout_version: CURRENT_LAYOUT_VERSION,

  map(input: S1000Input): Record<string, unknown> {
    const cnpj = input.company_document?.replace(/\D/g, '') || '';
    return {
      eSocial: {
        evtInfoEmpregador: {
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
          infoEmpregador: {
            inclusao: {
              idePeriodo: {
                iniValid: new Date().toISOString().slice(0, 7).replace('-', '-'),
              },
              infoCadastro: {
                nmRazao: input.company_name,
                classTrib: input.classification_code || '01',
                natJurid: input.legal_nature || '2062',
                indCoop: 0,
                indConstr: 0,
                indDesFolha: 0,
                indOpcCP: 0,
                contato: {
                  nmCtt: input.company_name,
                  cpfCtt: '',
                  foneFixo: input.phone?.replace(/\D/g, '') || '',
                  email: input.email || '',
                },
              },
              ...(input.fpas_code ? {
                infoComplementares: {
                  situacaoPJ: {
                    indSitPJ: 0,
                  },
                },
              } : {}),
            },
          },
        },
      },
    };
  },

  validate(payload: Record<string, unknown>): ValidationResult {
    const errors: { field: string; message: string; code: string }[] = [];
    const evt = (payload as any)?.eSocial?.evtInfoEmpregador;

    if (!evt) {
      errors.push({ field: 'eSocial.evtInfoEmpregador', message: 'Evento obrigatório ausente', code: 'MISSING_ROOT' });
      return { valid: false, errors };
    }

    const nrInsc = evt?.ideEmpregador?.nrInsc;
    if (!nrInsc || nrInsc.length < 8) {
      errors.push({ field: 'ideEmpregador.nrInsc', message: 'CNPJ raiz deve conter 8 dígitos', code: 'INVALID_CNPJ' });
    }

    const nmRazao = evt?.infoEmpregador?.inclusao?.infoCadastro?.nmRazao;
    if (!nmRazao || nmRazao.trim().length === 0) {
      errors.push({ field: 'infoCadastro.nmRazao', message: 'Razão social obrigatória', code: 'MISSING_RAZAO' });
    }

    return { valid: errors.length === 0, errors };
  },
};
