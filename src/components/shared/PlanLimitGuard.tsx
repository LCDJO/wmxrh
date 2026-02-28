/**
 * PlanLimitGuard — Wraps any action button with plan limit enforcement.
 * Shows upgrade prompt when limit is reached.
 */

import { type ReactNode } from 'react';
import { usePlanLimit, type PlanLimitKey } from '@/hooks/use-plan-limit';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Props {
  limitKey: PlanLimitKey;
  children: (props: { disabled: boolean; current: number; max: number | null; remaining: number | null }) => ReactNode;
  /** Show inline banner instead of tooltip (default: false) */
  showBanner?: boolean;
}

const LIMIT_LABELS: Record<PlanLimitKey, string> = {
  employees: 'colaboradores',
  active_users: 'usuários ativos',
  api_calls: 'chamadas de API',
  workflows: 'workflows',
  storage_mb: 'MB de armazenamento',
};

export function PlanLimitGuard({ limitKey, children, showBanner = false }: Props) {
  const { allowed, current, max, remaining, loading } = usePlanLimit(limitKey);
  const navigate = useNavigate();

  if (loading) {
    return <>{children({ disabled: false, current: 0, max: null, remaining: null })}</>;
  }

  const label = LIMIT_LABELS[limitKey];

  if (!allowed && max !== null) {
    if (showBanner) {
      return (
        <div className="space-y-3">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Limite de {label} atingido
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Seu plano permite até {max} {label} ({current}/{max}).
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-2 gap-1.5"
                onClick={() => navigate('/tenant/plans')}
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                Fazer Upgrade
              </Button>
            </div>
          </div>
          {children({ disabled: true, current, max, remaining })}
        </div>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              {children({ disabled: true, current, max, remaining })}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm font-medium">Limite de {label} atingido ({current}/{max})</p>
            <p className="text-xs text-muted-foreground mt-1">Faça upgrade do plano para continuar.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <>{children({ disabled: false, current, max, remaining })}</>;
}
