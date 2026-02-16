/**
 * ImpersonationBanner
 *
 * Fixed top banner shown when a platform admin is impersonating a tenant.
 * Displays the target tenant name, remaining time, and an "End" button.
 */

import { useEffect, useState } from 'react';
import { Shield, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dualIdentityEngine } from '@/domains/security/kernel/dual-identity-engine';

export function ImpersonationBanner() {
  const [, forceUpdate] = useState(0);

  const session = dualIdentityEngine.currentSession;
  const isImpersonating = dualIdentityEngine.isImpersonating;

  // Tick every 10s to update remaining time
  useEffect(() => {
    if (!isImpersonating) return;
    const interval = setInterval(() => forceUpdate(v => v + 1), 10_000);
    return () => clearInterval(interval);
  }, [isImpersonating]);

  if (!isImpersonating || !session) return null;

  const remainingMs = dualIdentityEngine.getRemainingMs();
  const remainingMin = Math.ceil(remainingMs / 60_000);

  const handleEnd = () => {
    dualIdentityEngine.endImpersonation('manual');
    // Redirect back to platform tenants
    window.location.href = '/platform/tenants';
  };

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between px-4 py-2 text-sm font-medium"
      style={{
        background: `linear-gradient(90deg, hsl(var(--impersonation)), hsl(var(--impersonation) / 0.85))`,
        color: `hsl(var(--impersonation-foreground))`,
      }}
    >
      <div className="flex items-center gap-3">
        <Shield className="h-4 w-4" />
        <span>
          Você está operando como{' '}
          <strong className="font-bold">{session.targetTenantName}</strong>
          {' '}({session.simulatedRole})
        </span>
        <span className="flex items-center gap-1 opacity-80">
          <Clock className="h-3.5 w-3.5" />
          {remainingMin} min restantes
        </span>
        <span className="opacity-60">
          — {session.operationCount} operações
        </span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleEnd}
        className="border-white/30 text-white hover:bg-white/20 hover:text-white gap-1.5"
      >
        <X className="h-3.5 w-3.5" />
        Encerrar Impersonação
      </Button>
    </div>
  );
}
