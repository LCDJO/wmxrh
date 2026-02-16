/**
 * ImpersonationWatermark
 *
 * Semi-transparent watermark overlay for sensitive screens during impersonation.
 * Renders a diagonal repeated text pattern to make screenshots identifiable.
 */

import { dualIdentityEngine } from '@/domains/security/kernel/dual-identity-engine';

interface ImpersonationWatermarkProps {
  /** Label for the sensitive area (e.g. "Financeiro", "Salários") */
  label?: string;
}

export function ImpersonationWatermark({ label }: ImpersonationWatermarkProps) {
  const session = dualIdentityEngine.currentSession;
  if (!dualIdentityEngine.isImpersonating || !session) return null;

  const watermarkText = `IMPERSONAÇÃO — ${session.realIdentity.email ?? session.realIdentity.userId} — ${label ?? 'DADOS SENSÍVEIS'}`;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden select-none"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 80px,
            hsl(var(--impersonation) / 0.06) 80px,
            hsl(var(--impersonation) / 0.06) 82px
          )`,
        }}
      />
      {/* Repeated text watermark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="whitespace-nowrap text-center font-bold tracking-widest uppercase"
          style={{
            fontSize: '14px',
            color: `hsl(var(--impersonation) / 0.12)`,
            transform: 'rotate(-35deg) scale(2.5)',
            lineHeight: '4rem',
            width: '200%',
            height: '200%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3rem',
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i}>{watermarkText}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
