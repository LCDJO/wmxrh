/**
 * ModuleHealthGrid — Visual grid of all platform modules with health status.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Cpu, RefreshCw, Play, AlertTriangle, CheckCircle2, XCircle, PauseCircle,
} from 'lucide-react';
import type { ModuleControlInfo, ControlAction } from '@/domains/control-plane/types';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  active: { color: 'border-emerald-500/40 bg-emerald-500/5', icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, label: 'Ativo' },
  error: { color: 'border-destructive/40 bg-destructive/5', icon: <XCircle className="h-3.5 w-3.5 text-destructive" />, label: 'Erro' },
  suspended: { color: 'border-amber-500/40 bg-amber-500/5', icon: <PauseCircle className="h-3.5 w-3.5 text-amber-500" />, label: 'Suspenso' },
  idle: { color: 'border-border bg-muted/20', icon: <PauseCircle className="h-3.5 w-3.5 text-muted-foreground" />, label: 'Inativo' },
};

interface ModuleHealthGridProps {
  modules: ModuleControlInfo[];
  onAction: (action: ControlAction) => void;
}

export function ModuleHealthGrid({ modules, onAction }: ModuleHealthGridProps) {
  const activeCount = modules.filter(m => m.status === 'active').length;
  const errorCount = modules.filter(m => m.status === 'error').length;

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" /> Módulos da Plataforma
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{activeCount} ativos</Badge>
          {errorCount > 0 && <Badge variant="destructive" className="text-[10px]">{errorCount} com erro</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[350px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {modules.map(mod => {
              const cfg = statusConfig[mod.status] ?? statusConfig.idle;
              return (
                <div key={mod.key} className={`rounded-lg border p-3 ${cfg.color} transition-colors`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {cfg.icon}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate text-foreground">{mod.label}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          <span>v{mod.version}</span>
                          {mod.is_core && <Badge variant="outline" className="text-[8px] h-3.5 px-1">CORE</Badge>}
                          {mod.circuit_breaker_state === 'open' && (
                            <Badge variant="destructive" className="text-[8px] h-3.5 px-1">CB OPEN</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {mod.status === 'active' && !mod.is_core && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onAction({ type: 'restart_module', module_key: mod.key })}>
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                      {mod.status === 'error' && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onAction({ type: 'clear_circuit_breaker', module_key: mod.key })}>
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      {mod.status !== 'active' && mod.status !== 'error' && !mod.is_core && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onAction({ type: 'activate_module', module_key: mod.key })}>
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {mod.error_count_last_hour > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-destructive">
                      <AlertTriangle className="h-2.5 w-2.5" /> {mod.error_count_last_hour} erros (1h)
                    </div>
                  )}
                  {mod.dependencies.length > 0 && (
                    <div className="text-[9px] text-muted-foreground mt-1 truncate">
                      deps: {mod.dependencies.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
