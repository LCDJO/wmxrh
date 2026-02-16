/**
 * TenantSetupOrchestrator — Suggests initial tenant configuration
 * based on plan tier and company profile.
 */

import type { TenantSetupOrchestratorAPI, TenantSetupConfig, TenantSetupResult } from './types';
import type { PlanTier } from '@/domains/platform-experience/types';

const INDUSTRY_DEPARTMENTS: Record<string, string[]> = {
  default: ['Administrativo', 'Recursos Humanos', 'Financeiro', 'Operações'],
  commerce: ['Administrativo', 'Vendas', 'Estoque', 'RH', 'Financeiro'],
  industry: ['Administrativo', 'Produção', 'Qualidade', 'RH', 'Manutenção', 'Logística'],
  services: ['Administrativo', 'Operações', 'Comercial', 'RH', 'TI'],
  construction: ['Administrativo', 'Obras', 'Segurança do Trabalho', 'RH', 'Compras'],
  healthcare: ['Administrativo', 'Assistencial', 'RH', 'Faturamento', 'Qualidade'],
};

const PLAN_COMPLIANCE: Record<PlanTier, string[]> = {
  free: ['Cadastro de empresa obrigatório'],
  starter: ['Cadastro de empresa', 'eSocial básico'],
  professional: ['eSocial completo', 'PCMSO', 'PGR', 'NRs aplicáveis'],
  enterprise: ['eSocial completo', 'PCMSO', 'PGR', 'NRs', 'LGPD', 'Auditoria'],
  custom: ['Customizado por contrato'],
};

export function createTenantSetupOrchestrator(): TenantSetupOrchestratorAPI {
  return {
    suggestSetup(planTier: PlanTier, config: TenantSetupConfig): TenantSetupResult {
      const industry = config.industry ?? 'default';
      const departments = INDUSTRY_DEPARTMENTS[industry] ?? INDUSTRY_DEPARTMENTS.default;

      return {
        tenant_id: '',
        company_created: false,
        departments_suggested: departments,
        compliance_requirements: PLAN_COMPLIANCE[planTier] ?? [],
      };
    },
  };
}
