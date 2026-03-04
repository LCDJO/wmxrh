/**
 * ModuleAccessService — Controle de módulos Traccar liberados por plano.
 *
 * Verifica se o tenant tem acesso ao módulo de integração Traccar
 * e aos sub-módulos de inteligência de frota baseado no plano contratado.
 */
import { supabase } from '@/integrations/supabase/client';

const TRACCAR_MODULE_KEYS = {
  /** Módulo raiz — integração com Traccar */
  INTEGRATION: 'traccar_integration',
  /** Sub-módulo — inteligência de frota (BTIE) */
  FLEET_INTELLIGENCE: 'fleet_intelligence',
  /** Sub-módulo — compliance de frota */
  FLEET_COMPLIANCE: 'fleet_compliance',
} as const;

export type TraccarModuleKey = typeof TRACCAR_MODULE_KEYS[keyof typeof TRACCAR_MODULE_KEYS];

export interface TraccarModuleAccessResult {
  hasIntegration: boolean;
  hasFleetIntelligence: boolean;
  hasFleetCompliance: boolean;
  planId: string | null;
  planName: string | null;
}

/**
 * Resolve quais módulos Traccar o tenant tem acesso baseado no plano.
 */
export async function resolveTraccarModuleAccess(
  tenantId: string
): Promise<TraccarModuleAccessResult> {
  const fallback: TraccarModuleAccessResult = {
    hasIntegration: false,
    hasFleetIntelligence: false,
    hasFleetCompliance: false,
    planId: null,
    planName: null,
  };

  // 1. Busca plano ativo do tenant
  const { data: tenantPlan } = await supabase
    .from('tenant_plans')
    .select('plan_id, status')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'trial'])
    .maybeSingle();

  if (!tenantPlan?.plan_id) return fallback;

  // 2. Busca módulos permitidos no plano
  const { data: plan } = await supabase
    .from('saas_plans')
    .select('id, name, allowed_modules')
    .eq('id', tenantPlan.plan_id)
    .maybeSingle();

  if (!plan) return fallback;

  const modules = (plan.allowed_modules as string[]) ?? [];

  return {
    hasIntegration: modules.includes(TRACCAR_MODULE_KEYS.INTEGRATION),
    hasFleetIntelligence: modules.includes(TRACCAR_MODULE_KEYS.FLEET_INTELLIGENCE),
    hasFleetCompliance: modules.includes(TRACCAR_MODULE_KEYS.FLEET_COMPLIANCE),
    planId: plan.id,
    planName: plan.name,
  };
}

/**
 * Retorna as chaves de módulo do Traccar.
 */
export function getTraccarModuleKeys() {
  return { ...TRACCAR_MODULE_KEYS };
}

/**
 * Atalho: verifica se o tenant tem o módulo de Fleet Intelligence habilitado.
 */
export async function isFleetIntelligenceEnabled(tenantId: string): Promise<boolean> {
  const access = await resolveTraccarModuleAccess(tenantId);
  return access.hasIntegration && access.hasFleetIntelligence;
}
