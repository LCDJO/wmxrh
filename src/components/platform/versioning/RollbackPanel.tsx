/**
 * RollbackPanel — DB-backed rollback planner and executor.
 */
import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, SkipForward, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getAdvancedVersioningEngine } from '@/domains/platform-versioning';
import { useAuth } from '@/contexts/AuthContext';
import type { Release, RollbackPlan, RollbackStep } from '@/domains/platform-versioning/types';

const ACTION_LABELS: Record<string, string> = {
  downgrade_module: 'Downgrade',
  deactivate_module: 'Desativar',
  restore_platform_version: 'Restaurar Versão',
  skip_protected: 'Ignorado (Protegido)',
  notify: 'Notificar',
  run_migration: 'Executar Migração',
};

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  pending: AlertTriangle,
  in_progress: Loader2,
  done: CheckCircle2,
  skipped: SkipForward,
  failed: XCircle,
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'text-amber-400',
  in_progress: 'text-blue-400 animate-spin',
  done: 'text-emerald-400',
  skipped: 'text-muted-foreground',
  failed: 'text-destructive',
};

function formatVersion(v: string | { major: number; minor: number; patch: number } | null | undefined): string {
  if (!v) return '?';
  if (typeof v === 'string') return v;
  return `v${v.major}.${v.minor}.${v.patch}`;
}

export function RollbackPanel({ canRollback = true }: { canRollback?: boolean }) {
  const { user } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRelease, setSelectedRelease] = useState<string>('');
  const [targetRelease, setTargetRelease] = useState<string>('');
  const [plan, setPlan] = useState<RollbackPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [executing, setExecuting] = useState(false);

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    try {
      const engine = getAdvancedVersioningEngine();
      const data = await engine.releases.list();
      setReleases(data);
      
      // Auto-select current (latest final) and previous
      const finals = data.filter(r => r.status === 'final');
      if (finals.length >= 2) {
        setSelectedRelease(finals[0].id);
        setTargetRelease(finals[1].id);
      } else if (finals.length === 1) {
        setSelectedRelease(finals[0].id);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReleases(); }, [fetchReleases]);

  const handlePlan = async () => {
    if (!selectedRelease || !targetRelease) return;
    setPlanning(true);
    try {
      const engine = getAdvancedVersioningEngine();
      const result = await engine.rollback.plan(selectedRelease, targetRelease, user?.id ?? 'system');
      setPlan(result);
      if (!result) toast.error('Não foi possível gerar o plano de rollback.');
    } catch {
      toast.error('Erro ao planejar rollback.');
    } finally {
      setPlanning(false);
    }
  };

  const handleExecute = async () => {
    if (!plan) return;
    setExecuting(true);
    try {
      const engine = getAdvancedVersioningEngine();
      const result = await engine.rollback.executeFull(plan);
      setPlan(result);
      toast.success('Rollback executado com sucesso', {
        description: `${result.modules_skipped.length} módulo(s) protegido(s) preservados.`,
      });
      await fetchReleases();
    } catch {
      toast.error('Erro ao executar rollback.');
    } finally {
      setExecuting(false);
    }
  };

  const protectedCount = plan?.steps.filter(s => s.action === 'skip_protected').length ?? 0;
  const pendingCount = plan?.steps.filter(s => s.status === 'pending').length ?? 0;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-primary" />
          Rollback Orchestrator
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : releases.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Nenhuma release disponível para rollback.</p>
          </div>
        ) : (
          <>
            {/* Release selectors */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Release Atual</label>
                <Select value={selectedRelease} onValueChange={v => { setSelectedRelease(v); setPlan(null); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {releases.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name} ({r.status})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Rollback Para</label>
                <Select value={targetRelease} onValueChange={v => { setTargetRelease(v); setPlan(null); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {releases.filter(r => r.id !== selectedRelease).map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name} ({r.status})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!plan && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mb-4 text-xs"
                disabled={!selectedRelease || !targetRelease || planning}
                onClick={handlePlan}
              >
                {planning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                {planning ? 'Planejando...' : 'Gerar Plano de Rollback'}
              </Button>
            )}

            {plan && (
              <>
                {protectedCount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 p-2.5 text-xs text-amber-300 mb-4">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>
                      <strong>{protectedCount}</strong> módulo(s) financeiro(s) protegido(s) — dados imutáveis não serão afetados.
                    </span>
                  </div>
                )}

                <ScrollArea className="h-[250px] pr-2">
                  <div className="space-y-2">
                    {plan.steps.map(step => {
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
                              <p className="text-muted-foreground mt-0.5">{formatVersion(step.from_version)} → {formatVersion(step.to_version)}</p>
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
                    disabled={pendingCount === 0 || executing || !canRollback}
                    onClick={handleExecute}
                    title={!canRollback ? 'Permissão necessária: versioning.rollback' : undefined}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {executing ? 'Executando...' : 'Executar Rollback'}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
