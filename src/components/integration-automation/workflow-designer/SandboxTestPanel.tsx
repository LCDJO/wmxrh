/**
 * SandboxTestPanel — UI for running workflow sandbox tests.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Shield, Clock, CheckCircle2, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SandboxRunResult } from './sandbox-runner';

interface Props {
  tenantId: string;
  sandboxRuns: SandboxRunResult[];
  onRunSandbox?: (payload: string) => void;
  onTeardown?: () => void;
}

export function SandboxTestPanel({ tenantId, sandboxRuns, onRunSandbox, onTeardown }: Props) {
  const [payload, setPayload] = useState('{\n  "tenantId": "test-tenant",\n  "event": "test"\n}');

  return (
    <div className="space-y-4">
      {/* Sandbox Config */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4.5 w-4.5 text-amber-500" />
              <CardTitle className="text-base font-display">Sandbox Environment</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-600 text-[10px]">
                SANDBOX MODE
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Billing Bloqueado
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Dados Isolados
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Payload de Teste</label>
              <Textarea
                value={payload}
                onChange={e => setPayload(e.target.value)}
                className="font-mono text-xs h-32"
                placeholder='{"key": "value"}'
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tenant ID</label>
                <Input value={tenantId} readOnly className="h-8 text-xs bg-muted" />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-1 text-xs flex-1"
                  onClick={() => {
                    onRunSandbox?.(payload);
                    toast.success('Teste sandbox iniciado');
                  }}
                >
                  <Play className="h-3.5 w-3.5" /> Executar Teste
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs text-red-500"
                  onClick={() => {
                    onTeardown?.();
                    toast.info('Sandbox destruído');
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Destruir
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground space-y-1">
                <p>• Rate limits relaxados para testes</p>
                <p>• Dados isolados com prefix sandbox_</p>
                <p>• Billing nunca é acionado</p>
                <p>• Sandbox expira em 24h</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sandbox Runs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Execuções Sandbox</CardTitle>
            <Badge variant="outline" className="text-[10px]">{sandboxRuns.length} runs</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {sandboxRuns.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhum teste sandbox executado</p>
            </div>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {sandboxRuns.map(sr => {
                  const run = sr.run;
                  const isOk = run.status === 'completed';
                  const isFail = run.status === 'failed';
                  return (
                    <div key={run.id} className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md border',
                      isOk && 'border-green-500/20 bg-green-500/5',
                      isFail && 'border-red-500/20 bg-red-500/5',
                      !isOk && !isFail && 'border-border',
                    )}>
                      {isOk && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {isFail && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      {!isOk && !isFail && <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium">{run.triggerEvent}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">{run.id.slice(0, 8)}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {sr.warnings.length > 0 && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(run.startedAt).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
