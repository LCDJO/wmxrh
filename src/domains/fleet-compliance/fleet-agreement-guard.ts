/**
 * Fleet → Agreement Guard
 *
 * Enforces that employees cannot be assigned fleet devices or vehicles
 * unless all mandatory fleet agreements are signed:
 *   1. Termo de Responsabilidade — Uso de Veículo (vehicle_usage)
 *   2. Termo de Responsabilidade — Multas de Trânsito (fine_responsibility)
 *   3. Termo de Ciência — Monitoramento GPS (gps_monitoring)
 *
 * If ANY blocking agreement is missing/unsigned, device assignment is blocked.
 *
 * Integrations:
 *   - Employee Agreement Engine (signature status)
 *   - Fleet Compliance Engine (device registry)
 *   - Hiring Workflow (admission fleet gate)
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  FleetAgreementType,
  FleetRequiredAgreement,
  FleetEmployeeAgreementStatus,
} from './types';
import { isFleetBlocked } from './types';

// ── Types ──

export interface FleetAgreementGuardResult {
  employee_id: string;
  blocked: boolean;
  missing_agreements: FleetAgreementType[];
  signed_agreements: FleetAgreementType[];
  total_required: number;
  total_signed: number;
  can_assign_device: boolean;
  blocking_reasons: string[];
  evaluated_at: string;
}

/** Maps fleet agreement types to employee_agreements DB categories */
const FLEET_TYPE_TO_DB_CATEGORY: Record<FleetAgreementType, string> = {
  vehicle_usage: 'veiculo',
  fine_responsibility: 'multas',
  gps_monitoring: 'gps',
};

const FLEET_TYPE_LABELS: Record<FleetAgreementType, string> = {
  vehicle_usage: 'Termo de Responsabilidade — Uso de Veículo',
  fine_responsibility: 'Termo de Responsabilidade — Multas de Trânsito',
  gps_monitoring: 'Termo de Ciência — Monitoramento GPS',
};

// All three are mandatory and blocking by default
const DEFAULT_REQUIRED_TYPES: FleetAgreementType[] = [
  'vehicle_usage',
  'fine_responsibility',
  'gps_monitoring',
];

// ── Guard Service ──

export const fleetAgreementGuard = {

  /**
   * Check whether an employee can be assigned a fleet device.
   * Queries employee_agreements for fleet-related categories.
   */
  async canAssignDevice(
    employeeId: string,
    tenantId: string,
  ): Promise<FleetAgreementGuardResult> {
    const now = new Date().toISOString();

    // 1. Check if tenant has custom fleet required agreements configured
    const { data: customRequired } = await supabase
      .from('agreement_templates')
      .select('id, category, is_mandatory')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .in('category', ['veiculo', 'multas', 'gps']);

    // 2. Get employee's current agreement statuses for fleet categories
    const { data: employeeAgreements } = await supabase
      .from('employee_agreements')
      .select('id, template_id, status, signed_at')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId);

    const signedTemplateIds = new Set(
      (employeeAgreements || [])
        .filter((a: any) => a.status === 'signed')
        .map((a: any) => a.template_id),
    );

    // 3. Build required/signed sets
    const missing: FleetAgreementType[] = [];
    const signed: FleetAgreementType[] = [];
    const blockingReasons: string[] = [];

    if (customRequired && customRequired.length > 0) {
      // Use DB-configured templates
      for (const tpl of customRequired) {
        const fleetType = Object.entries(FLEET_TYPE_TO_DB_CATEGORY)
          .find(([, cat]) => cat === tpl.category)?.[0] as FleetAgreementType | undefined;

        if (!fleetType) continue;

        if (signedTemplateIds.has(tpl.id)) {
          signed.push(fleetType);
        } else {
          missing.push(fleetType);
          blockingReasons.push(
            `${FLEET_TYPE_LABELS[fleetType]} — pendente de assinatura`,
          );
        }
      }
    } else {
      // Fallback: require all 3 default types, check by category
      const templatesByCategory = new Map<string, string>();
      const { data: allTemplates } = await supabase
        .from('agreement_templates')
        .select('id, category')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .in('category', ['veiculo', 'multas', 'gps']);

      for (const t of allTemplates || []) {
        templatesByCategory.set(t.category, t.id);
      }

      for (const fleetType of DEFAULT_REQUIRED_TYPES) {
        const dbCat = FLEET_TYPE_TO_DB_CATEGORY[fleetType];
        const templateId = templatesByCategory.get(dbCat);

        if (templateId && signedTemplateIds.has(templateId)) {
          signed.push(fleetType);
        } else {
          missing.push(fleetType);
          blockingReasons.push(
            `${FLEET_TYPE_LABELS[fleetType]} — pendente de assinatura`,
          );
        }
      }
    }

    const totalRequired = signed.length + missing.length;

    return {
      employee_id: employeeId,
      blocked: missing.length > 0,
      missing_agreements: missing,
      signed_agreements: signed,
      total_required: totalRequired,
      total_signed: signed.length,
      can_assign_device: missing.length === 0,
      blocking_reasons: blockingReasons,
      evaluated_at: now,
    };
  },

  /**
   * Enforce guard — throws if blocked.
   * Use before any FleetDevice binding or vehicle assignment operation.
   */
  async enforceOrThrow(
    employeeId: string,
    tenantId: string,
  ): Promise<void> {
    const result = await this.canAssignDevice(employeeId, tenantId);
    if (result.blocked) {
      const reasons = result.blocking_reasons.join('; ');
      throw new Error(
        `Bloqueio de atribuição de frota: ${reasons}. ` +
        `Todos os termos obrigatórios devem ser assinados antes da vinculação de dispositivo.`,
      );
    }
  },

  /**
   * Dispatch all required fleet agreements for an employee.
   * Creates pending EmployeeAgreement records for missing fleet terms.
   */
  async dispatchFleetAgreements(
    employeeId: string,
    tenantId: string,
    companyId: string,
  ): Promise<{ dispatched: number; already_existing: number; errors: string[] }> {
    const errors: string[] = [];
    let dispatched = 0;
    let alreadyExisting = 0;

    // Find fleet templates with their current version
    const { data: templates } = await supabase
      .from('agreement_templates')
      .select(`
        id, name, category,
        versions:agreement_template_versions!agreement_template_versions_template_id_fkey(id)
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .in('category', ['veiculo', 'multas', 'gps']);

    if (!templates || templates.length === 0) {
      errors.push('Nenhum template de termos de frota configurado.');
      return { dispatched, already_existing: alreadyExisting, errors };
    }

    // Check existing
    const { data: existing } = await supabase
      .from('employee_agreements')
      .select('template_id, status')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'sent', 'signed']);

    const existingIds = new Set((existing || []).map((e: any) => e.template_id));

    for (const tpl of templates) {
      if (existingIds.has(tpl.id)) {
        alreadyExisting++;
        continue;
      }

      const versions = (tpl as any).versions as Array<{ id: string }> | null;
      const versionId = versions?.[0]?.id ?? tpl.id;

      const { error } = await supabase
        .from('employee_agreements')
        .insert([{
          employee_id: employeeId,
          template_id: tpl.id,
          template_version_id: versionId,
          tenant_id: tenantId,
          company_id: companyId,
          status: 'pending',
          versao: 1,
        }]);

      if (error) {
        errors.push(`${tpl.name}: ${error.message}`);
      } else {
        dispatched++;
      }
    }

    return { dispatched, already_existing: alreadyExisting, errors };
  },
};
