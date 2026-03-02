/**
 * SystemIdentificationManager — Identificação do REP-C conforme Art. 89-92.
 */

import type { REPCSystemIdentification } from './types';

const DEFAULT_SYSTEM: Omit<REPCSystemIdentification, 'employer_cnpj' | 'employer_razao_social' | 'deployment_date'> = {
  software_name: 'PontoID REP-C',
  software_version: '1.0.0',
  developer_name: 'PontoID Tecnologia Ltda',
  developer_cnpj: '00.000.000/0001-00',
};

export class SystemIdentificationManager {
  private identifications = new Map<string, REPCSystemIdentification>();

  getIdentification(tenantId: string): REPCSystemIdentification {
    const existing = this.identifications.get(tenantId);
    if (existing) return { ...existing };

    // Return default with placeholders
    return {
      ...DEFAULT_SYSTEM,
      employer_cnpj: '',
      employer_razao_social: '',
      deployment_date: new Date().toISOString().slice(0, 10),
    };
  }

  updateEmployer(
    tenantId: string,
    employer: Pick<REPCSystemIdentification, 'employer_cnpj' | 'employer_razao_social' | 'employer_cei_caepf'>,
  ): void {
    const current = this.getIdentification(tenantId);
    this.identifications.set(tenantId, {
      ...current,
      ...employer,
    });
  }

  updateSoftwareVersion(version: string): void {
    for (const [tid, id] of this.identifications) {
      this.identifications.set(tid, { ...id, software_version: version });
    }
  }
}
