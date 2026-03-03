/**
 * inferPlanTier — Single source of truth for deriving a PlanBadge-compatible
 * tier string from a saas_plans row.
 *
 * Uses `name` first (convention-based), then falls back to price thresholds.
 * Returns values compatible with PlanBadge: 'free' | 'starter' | 'pro' | 'enterprise' | 'custom'
 */

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise' | 'custom';

const NAME_MAP: Record<string, PlanTier> = {
  free: 'free',
  gratuito: 'free',
  starter: 'starter',
  básico: 'starter',
  basico: 'starter',
  basic: 'starter',
  pro: 'pro',
  professional: 'pro',
  profissional: 'pro',
  enterprise: 'enterprise',
  empresarial: 'enterprise',
  custom: 'custom',
  personalizado: 'custom',
};

export function inferPlanTier(planName: string, price: number): PlanTier {
  // 1. Try matching by plan name (case-insensitive, trimmed)
  const normalized = planName.trim().toLowerCase();
  const byName = NAME_MAP[normalized];
  if (byName) return byName;

  // Also check if the name starts with a known tier word
  for (const [key, tier] of Object.entries(NAME_MAP)) {
    if (normalized.startsWith(key)) return tier;
  }

  // 2. Fall back to price-based thresholds (BRL)
  if (price === 0) return 'free';
  if (price <= 199) return 'starter';
  if (price <= 499) return 'pro';
  return 'enterprise';
}
