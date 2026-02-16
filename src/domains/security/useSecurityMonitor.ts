/**
 * useSecurityMonitor - React hook that listens to security events
 * and shows toast notifications for blocked actions.
 */

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { onSecurityEvent, type SecurityEventPayload } from './security-events';

const EVENT_LABELS: Record<string, { title: string; variant: 'destructive' | 'default' }> = {
  UnauthorizedAccessAttempt: { title: '⛔ Acesso Negado', variant: 'destructive' },
  ScopeViolationDetected:   { title: '🚫 Violação de Escopo', variant: 'destructive' },
  RateLimitTriggered:       { title: '⏳ Limite Atingido', variant: 'default' },
};

export function useSecurityMonitor() {
  const { toast } = useToast();

  useEffect(() => {
    const unsub = onSecurityEvent((event: SecurityEventPayload) => {
      const label = EVENT_LABELS[event.type] || { title: 'Evento de Segurança', variant: 'destructive' as const };
      toast({
        title: label.title,
        description: event.reason,
        variant: label.variant,
      });
    });
    return unsub;
  }, [toast]);
}
