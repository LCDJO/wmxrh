/**
 * useBillingCore — React hook for PlatformBillingCore
 *
 * Wires BillingCore aggregate to the PXE singleton,
 * exposes all billing services (calculator, invoices, ledger, revenue, lifecycle).
 */

import { useMemo } from 'react';
import { usePXE } from './use-pxe';
import { createPlatformBillingCore } from '@/domains/billing-core';
import type { PlatformBillingCoreAPI } from '@/domains/billing-core';

// ── Singleton ────────────────────────────────────────────────────
let billingInstance: PlatformBillingCoreAPI | null = null;

export function useBillingCore(): PlatformBillingCoreAPI {
  const { engine } = usePXE();

  const billing = useMemo(() => {
    if (!billingInstance) {
      billingInstance = createPlatformBillingCore(engine);
    }
    return billingInstance;
  }, [engine]);

  return billing;
}

/** Reset singleton (for testing) */
export function resetBillingCore(): void {
  billingInstance = null;
}
