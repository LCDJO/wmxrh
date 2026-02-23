/**
 * AgreementComplianceDashboardService
 *
 * Provides company-level and tenant-level metrics for the Dashboard Jurídico:
 *
 * Company:
 *   - termos pendentes
 *   - termos por cargo
 *   - termos expirando (próximos 30 dias)
 *   - colaboradores bloqueados por ausência de assinatura
 *
 * Tenant:
 *   - ranking de conformidade por empresa
 *   - risco jurídico consolidado
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface CompanyAgreementMetrics {
  company_id: string;
  company_name: string;
  total_agreements: number;
  pending_count: number;
  signed_count: number;
  expired_count: number;
  expiring_soon_count: number;
  blocked_employees: BlockedEmployee[];
  by_position: PositionAgreementCount[];
  compliance_rate: number;
  risk_level: 'baixo' | 'medio' | 'alto' | 'critico';
}

export interface BlockedEmployee {
  employee_id: string;
  employee_name: string;
  pending_mandatory_count: number;
  template_names: string[];
}

export interface PositionAgreementCount {
  position_name: string;
  total: number;
  pending: number;
  signed: number;
}

export interface TenantComplianceRanking {
  companies: CompanyAgreementMetrics[];
  tenant_compliance_rate: number;
  tenant_risk_level: 'baixo' | 'medio' | 'alto' | 'critico';
  total_pending: number;
  total_expiring: number;
  total_blocked_employees: number;
}

// ── Helpers ──

function computeRisk(complianceRate: number): 'baixo' | 'medio' | 'alto' | 'critico' {
  if (complianceRate >= 90) return 'baixo';
  if (complianceRate >= 70) return 'medio';
  if (complianceRate >= 50) return 'alto';
  return 'critico';
}

// ── Service ──

export const agreementComplianceDashboardService = {

  async getTenantDashboard(tenantId: string): Promise<TenantComplianceRanking> {
    // Fetch all data in parallel
    const [
      { data: agreements },
      { data: templates },
      { data: employees },
      { data: companies },
    ] = await Promise.all([
      supabase
        .from('employee_agreements')
        .select('id, status, employee_id, template_id, company_id, expires_at, created_at')
        .eq('tenant_id', tenantId),
      supabase
        .from('agreement_templates')
        .select('id, name, is_mandatory, is_active, category')
        .eq('tenant_id', tenantId)
        .eq('is_active', true),
      supabase
        .from('employees')
        .select('id, nome, company_id, position_id, positions(name)')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null),
      supabase
        .from('companies')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null),
    ]);

    const allAgreements = (agreements || []) as any[];
    const allTemplates = (templates || []) as any[];
    const allEmployees = (employees || []) as any[];
    const allCompanies = (companies || []) as any[];

    const mandatoryTemplateIds = new Set(
      allTemplates.filter((t: any) => t.is_mandatory).map((t: any) => t.id)
    );
    const templateNameMap = new Map(allTemplates.map((t: any) => [t.id, t.name]));

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Group data by company
    const companyMetrics: CompanyAgreementMetrics[] = allCompanies.map((company: any) => {
      const companyAgreements = allAgreements.filter((a: any) => a.company_id === company.id);
      const companyEmployees = allEmployees.filter((e: any) => e.company_id === company.id);

      const pending = companyAgreements.filter((a: any) => a.status === 'pending' || a.status === 'sent');
      const signed = companyAgreements.filter((a: any) => a.status === 'signed');
      const expired = companyAgreements.filter((a: any) => a.status === 'expired');
      const expiringSoon = companyAgreements.filter((a: any) => {
        if (!a.expires_at || a.status !== 'signed') return false;
        const exp = new Date(a.expires_at);
        return exp > now && exp <= thirtyDays;
      });

      // Blocked employees: have mandatory templates without a signed agreement
      const blocked: BlockedEmployee[] = [];
      for (const emp of companyEmployees) {
        const empAgreements = allAgreements.filter((a: any) => a.employee_id === emp.id);
        const signedTemplateIds = new Set(
          empAgreements.filter((a: any) => a.status === 'signed').map((a: any) => a.template_id)
        );
        const missingMandatory = Array.from(mandatoryTemplateIds).filter(
          tid => !signedTemplateIds.has(tid)
        );
        if (missingMandatory.length > 0) {
          blocked.push({
            employee_id: emp.id,
            employee_name: emp.nome ?? 'Sem nome',
            pending_mandatory_count: missingMandatory.length,
            template_names: missingMandatory.map(tid => templateNameMap.get(tid) ?? 'Desconhecido'),
          });
        }
      }

      // By position
      const positionMap = new Map<string, { total: number; pending: number; signed: number }>();
      for (const emp of companyEmployees) {
        const posName = (emp as any).positions?.name ?? 'Sem cargo';
        if (!positionMap.has(posName)) positionMap.set(posName, { total: 0, pending: 0, signed: 0 });
        const empAgreements = allAgreements.filter((a: any) => a.employee_id === emp.id);
        const entry = positionMap.get(posName)!;
        entry.total += empAgreements.length;
        entry.pending += empAgreements.filter((a: any) => a.status === 'pending' || a.status === 'sent').length;
        entry.signed += empAgreements.filter((a: any) => a.status === 'signed').length;
      }

      const byPosition: PositionAgreementCount[] = Array.from(positionMap.entries()).map(
        ([position_name, counts]) => ({ position_name, ...counts })
      );

      // Compliance: signed mandatory / total mandatory expected
      const totalMandatoryExpected = companyEmployees.length * mandatoryTemplateIds.size;
      const totalMandatorySigned = companyEmployees.reduce((sum, emp) => {
        const empSigned = allAgreements.filter(
          (a: any) => a.employee_id === emp.id && a.status === 'signed' && mandatoryTemplateIds.has(a.template_id)
        ).length;
        return sum + empSigned;
      }, 0);

      const complianceRate = totalMandatoryExpected > 0
        ? Math.round((totalMandatorySigned / totalMandatoryExpected) * 1000) / 10
        : 100;

      return {
        company_id: company.id,
        company_name: company.name,
        total_agreements: companyAgreements.length,
        pending_count: pending.length,
        signed_count: signed.length,
        expired_count: expired.length,
        expiring_soon_count: expiringSoon.length,
        blocked_employees: blocked,
        by_position: byPosition,
        compliance_rate: complianceRate,
        risk_level: computeRisk(complianceRate),
      };
    });

    // Sort by compliance (worst first)
    companyMetrics.sort((a, b) => a.compliance_rate - b.compliance_rate);

    // Tenant-level aggregates
    const totalPending = companyMetrics.reduce((s, c) => s + c.pending_count, 0);
    const totalExpiring = companyMetrics.reduce((s, c) => s + c.expiring_soon_count, 0);
    const totalBlocked = companyMetrics.reduce((s, c) => s + c.blocked_employees.length, 0);
    const avgCompliance = companyMetrics.length > 0
      ? Math.round(companyMetrics.reduce((s, c) => s + c.compliance_rate, 0) / companyMetrics.length * 10) / 10
      : 100;

    return {
      companies: companyMetrics,
      tenant_compliance_rate: avgCompliance,
      tenant_risk_level: computeRisk(avgCompliance),
      total_pending: totalPending,
      total_expiring: totalExpiring,
      total_blocked_employees: totalBlocked,
    };
  },
};
