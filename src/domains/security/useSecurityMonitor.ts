/**
 * useSecurityMonitor - React hook that listens to security events
 * AND IBL domain events, showing toast notifications for relevant actions.
 */

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  onSecurityEvent, type SecurityEventPayload,
  onIBLEvent, type IBLDomainEvent,
} from './kernel';

const SECURITY_LABELS: Record<string, { title: string; variant: 'destructive' | 'default' }> = {
  UnauthorizedAccessAttempt: { title: '⛔ Acesso Negado', variant: 'destructive' },
  ScopeViolationDetected:   { title: '🚫 Violação de Escopo', variant: 'destructive' },
  RateLimitTriggered:       { title: '⏳ Limite Atingido', variant: 'default' },
};

const IBL_LABELS: Partial<Record<IBLDomainEvent['type'], { title: string; variant: 'destructive' | 'default' }>> = {
  UnauthorizedContextSwitch: { title: '🚫 Troca de Contexto Negada', variant: 'destructive' },
};

export function useSecurityMonitor() {
  const { toast } = useToast();

  useEffect(() => {
    const unsubSecurity = onSecurityEvent((event: SecurityEventPayload) => {
      // Skip non-blocking events (successful context switches, identity established, etc.)
      if ('result' in event && (event as any).result === 'success') return;
      if ('result' in event && (event as any).result === 'allowed') return;

      const label = SECURITY_LABELS[event.type] || { title: 'Evento de Segurança', variant: 'destructive' as const };
      toast({ title: label.title, description: event.reason, variant: label.variant });
    });

    const unsubIBL = onIBLEvent((event: IBLDomainEvent) => {
      const label = IBL_LABELS[event.type];
      if (label) {
        const reason = 'reason' in event ? (event as any).reason : event.type;
        toast({ title: label.title, description: reason, variant: label.variant });
      }
    });

    return () => { unsubSecurity(); unsubIBL(); };
  }, [toast]);
}
