/**
 * EmployeeLimitBanner — Reusable banner that warns about employee plan limits.
 * Shows destructive alert when limit is reached, amber warning when close.
 */

import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { useEmployeeLimit } from '@/hooks/billing/use-employee-limit';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Props {
  /** Show the upgrade button (default true) */
  showUpgradeButton?: boolean;
  /** Compact mode for inline use in dialogs */
  compact?: boolean;
}

export function EmployeeLimitBanner({ showUpgradeButton = true, compact = false }: Props) {
  const { canAddMore, remaining, maxAllowed, currentCount, loading } = useEmployeeLimit();
  const navigate = useNavigate();

  if (loading || maxAllowed === null) return null;

  // Limit reached
  if (!canAddMore) {
    return (
      <div className={`rounded-lg border border-destructive/30 bg-destructive/5 ${compact ? 'p-3' : 'p-4'} flex items-start gap-3`}>
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-destructive ${compact ? 'text-sm' : 'text-base'}`}>
            Limite de colaboradores atingido
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Seu plano permite até <strong>{maxAllowed}</strong> colaboradores ativos ({currentCount}/{maxAllowed}).
            Não é possível adicionar novos colaboradores. Apenas desativação é permitida.
          </p>
          {showUpgradeButton && (
            <Button
              variant="destructive"
              size="sm"
              className="mt-2 gap-1.5"
              onClick={() => navigate('/tenant/plans')}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Fazer Upgrade
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Near limit (3 or fewer remaining)
  if (remaining !== null && remaining <= 3) {
    return (
      <div className={`rounded-lg border border-amber-500/30 bg-amber-500/5 ${compact ? 'p-3' : 'p-4'} flex items-start gap-3`}>
        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-amber-700 dark:text-amber-400 ${compact ? 'text-sm' : 'text-base'}`}>
            Limite próximo
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Restam apenas <strong>{remaining}</strong> vaga(s) no seu plano ({currentCount}/{maxAllowed}).
          </p>
        </div>
      </div>
    );
  }

  return null;
}
