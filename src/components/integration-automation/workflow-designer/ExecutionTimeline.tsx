/**
 * ExecutionTimeline — Displays workflow run history with node-level execution details.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2, XCircle, Clock, RotateCcw, Play, ChevronDown, ChevronRight,
  Zap, GitBranch, AlertTriangle, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowRun, NodeExecution, RunStatus, NodeExecStatus } from './execution-engine';

interface Props {
  runs: WorkflowRun[];
  onRerun?: (run: WorkflowRun) => void;
  onCancel?: (runId: string) => void;
}

const RUN_STATUS_CONFIG: Record<RunStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pendente' },
  running: { icon: Loader2, color: 'text-blue-500', label: 'Executando' },
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Concluído' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Falhou' },
  cancelled: { icon: AlertTriangle, color: 'text-amber-500', label: 'Cancelado' },
  retrying: { icon: RotateCcw, color: 'text-orange-500', label: 'Retentando' },
};

const NODE_STATUS_CONFIG: Record<NodeExecStatus, { color: string; bg: string }> = {
  pending: { color: 'text-muted-foreground', bg: 'bg-muted' },
  running: { color: 'text-blue-500', bg: 'bg-blue-500/10' },
  succeeded: { color: 'text-green-500', bg: 'bg-green-500/10' },
  failed: { color: 'text-red-500', bg: 'bg-red-500/10' },
  skipped: { color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

function NodeExecutionRow({ exec }: { exec: NodeExecution }) {
  const cfg = NODE_STATUS_CONFIG[exec.status];
  return (
    <div className={cn('flex items-center gap-3 px-3 py-2 rounded-md', cfg.bg)}>
      <div className={cn('h-2 w-2 rounded-full', {
        'bg-muted-foreground': exec.status === 'pending' || exec.status === 'skipped',
        'bg-blue-500 animate-pulse': exec.status === 'running',
        'bg-green-500': exec.status === 'succeeded',
        'bg-red-500': exec.status === 'failed',
      })} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium truncate', cfg.color)}>{exec.nodeLabel}</span>
          <Badge variant="outline" className="text-[9px] h-4 px-1">
            {exec.nodeCategory}
          </Badge>
        </div>
        {exec.error && (
          <p className="text-[10px] text-red-400 mt-0.5 truncate">{exec.error}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {exec.retryCount > 0 && (
          <Badge variant="outline" className="text-[9px] h-4 px-1 text-orange-500">
            retry {exec.retryCount}
          </Badge>
        )}
        {exec.durationMs != null && (
          <span className="text-[10px] text-muted-foreground">{exec.durationMs}ms</span>
        )}
      </div>
    </div>
  );
}

function RunCard({ run, onRerun, onCancel }: { run: WorkflowRun; onRerun?: (r: WorkflowRun) => void; onCancel?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = RUN_STATUS_CONFIG[run.status];
  const StatusIcon = statusCfg.icon;

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(prev => !prev)}
      >
        <StatusIcon className={cn('h-4.5 w-4.5 shrink-0', statusCfg.color, run.status === 'running' && 'animate-spin')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{run.triggerEvent}</span>
            <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5', statusCfg.color)}>
              {statusCfg.label}
            </Badge>
            {run.metadata?.isSandbox === true && (
              <Badge className="text-[9px] h-4 px-1.5 bg-amber-500/20 text-amber-600">SANDBOX</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-muted-foreground">
              Run {run.id.slice(0, 8)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(run.startedAt).toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {run.nodeExecutions.filter(n => n.status === 'succeeded').length}/{run.nodeExecutions.length} nós
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {run.status === 'running' && onCancel && (
            <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={e => { e.stopPropagation(); onCancel(run.id); }}>
              Cancelar
            </Button>
          )}
          {(run.status === 'failed' || run.status === 'completed') && onRerun && (
            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={e => { e.stopPropagation(); onRerun(run); }}>
              <RotateCcw className="h-3 w-3" /> Re-run
            </Button>
          )}
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-border pt-2">
          {run.nodeExecutions.map(exec => (
            <NodeExecutionRow key={exec.nodeId} exec={exec} />
          ))}
          {run.error && (
            <div className="mt-2 p-2 rounded-md bg-red-500/10 border border-red-500/20">
              <p className="text-[11px] text-red-400 font-medium">Erro: {run.error}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function ExecutionTimeline({ runs, onRerun, onCancel }: Props) {
  if (runs.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-16">
        <Zap className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma execução registrada</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Execute um workflow para ver o histórico aqui</p>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      <div className="space-y-2">
        {runs.map(run => (
          <RunCard key={run.id} run={run} onRerun={onRerun} onCancel={onCancel} />
        ))}
      </div>
    </ScrollArea>
  );
}
