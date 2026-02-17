/**
 * RollbackPanel — Interface for planning and reviewing rollbacks.
 */
import { useState } from 'react';
import { RotateCcw, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, SkipForward } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RollbackStepUI {
  order: number;
  action: string;
  target: string;
  from_version?: string;
  to_version?: string;
  reason?: string;
  status: 'pending' | 'done' | 'skipped' | 'failed';
}

const MOCK_STEPS: RollbackStepUI[] = [
  { order: 1, action: 'downgrade_module', target: 'growth_engine', from_version: 'v2.0.0', to_version: 'v1.5.0', status: 'pending' },
  { order: 2, action: 'downgrade_module', target: 'landing_engine', from_version: 'v1.3.0', to_version: 'v1.2.0', status: 'pending' },
  { order: 3, action: 'skip_protected', target: 'billing_core', from_version: 'v2.1.0', reason: 'Módulo financeiro protegido — dados imutáveis', status: 'skipped' },
  { order: 4, action: 'restore_platform_version', target: 'v4.1.0', status: 'pending' },
  { order: 5, action: 'notify', target: 'all_stakeholders', status: 'pending' },
];

const ACTION_LABELS: Record<string, string> = {
  downgrade_module: 'Downgrade',
  deactivate_module: 'Desativar',
  restore_platform_version: 'Restaurar Versão',
  skip_protected: 'Ignorado (Protegido)',
  notify: 'Notificar',
};

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  pending: AlertTriangle,
  done: CheckCircle2,
  skipped: SkipForward,
  failed: XCircle,
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'text-amber-400',
  done: 'text-emerald-400',
  skipped: 'text-muted-foreground',
  failed: 'text-destructive',
};

export function RollbackPanel() {
  const [scope, setScope] = useState<'module' | 'release'>('release');
  const [steps, setSteps] = useState(MOCK_STEPS);
  const [executing, setExecuting] = useState(false);

  const protectedCount = steps.filter(s => s.action === 'skip_protected').length;
  const pendingCount = steps.filter(s => s.status === 'pending').length;

  const handleExecute = () => {
    setExecuting(true);
    const updated = steps.map(s => s.status === 'pending' ? { ...s, status: 'done' as const } : s);
    setTimeout(() => {
      setSteps(updated);
      setExecuting(false);
      toast.success('Rollback executado com sucesso', { description: `${protectedCount} módulo(s) financeiro(s) preservados.` });
    }, 1500);
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            Rollback Orchestrator
          </CardTitle>
          <Select value={scope} onValueChange={(v) => setScope(v as 'module' | 'release')}>
            <SelectTrigger className="w-[140px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="release">Release Completa</SelectItem>
              <SelectItem value="module">Módulo Único</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {protectedCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 p-2.5 text-xs text-amber-300 mb-4">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              <strong>{protectedCount}</strong> módulo(s) financeiro(s) protegido(s) — dados imutáveis não serão afetados.
            </span>
          </div>
        )}

        <ScrollArea className="h-[300px] pr-2">
          <div className="space-y-2">
            {steps.map(step => {
              const Icon = STATUS_ICON[step.status] ?? AlertTriangle;
              return (
                <div
                  key={step.order}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 text-xs',
                    step.status === 'skipped' ? 'border-border/30 bg-muted/20 opacity-60' : 'border-border/40'
                  )}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                    {step.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{ACTION_LABELS[step.action] ?? step.action}</span>
                      <span className="font-mono text-muted-foreground">{step.target}</span>
                    </div>
                    {step.from_version && step.to_version && (
                      <p className="text-muted-foreground mt-0.5">{step.from_version} → {step.to_version}</p>
                    )}
                    {step.reason && (
                      <p className="text-amber-400/80 mt-0.5 italic">{step.reason}</p>
                    )}
                  </div>
                  <Icon className={cn('h-4 w-4 shrink-0', STATUS_CLASS[step.status])} />
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            {pendingCount} step(s) pendente(s)
          </p>
          <Button
            size="sm"
            variant="destructive"
            disabled={pendingCount === 0 || executing}
            onClick={handleExecute}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            {executing ? 'Executando...' : 'Executar Rollback'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
