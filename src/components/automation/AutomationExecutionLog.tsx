/**
 * AutomationExecutionLog — Shows execution history for a rule.
 */
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { fetchRuleExecutions } from '@/domains/automation';

interface Props {
  ruleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutomationExecutionLog({ ruleId, open, onOpenChange }: Props) {
  const { data: executions = [], isLoading } = useQuery({
    queryKey: ['automation-executions', ruleId],
    queryFn: () => fetchRuleExecutions(ruleId, 50),
    enabled: open,
  });

  const resultIcon = (result: string) => {
    switch (result) {
      case 'success': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'failure': return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      default: return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Histórico de Execuções
          </DialogTitle>
          <DialogDescription>Últimas 50 execuções desta regra.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : executions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma execução registrada.</p>
          ) : (
            <div className="space-y-2">
              {executions.map((exec: Record<string, unknown>) => (
                <div key={exec.id as string} className="flex items-start gap-2 p-2 rounded border text-xs">
                  {resultIcon(exec.result as string)}
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{String(exec.trigger_event)}</span>
                      <Badge variant={exec.conditions_met ? 'default' : 'secondary'} className="text-[10px]">
                        {exec.conditions_met ? 'Match' : 'No Match'}
                      </Badge>
                    </div>
                    {typeof exec.error_message === 'string' && exec.error_message && (
                      <p className="text-destructive">{String(exec.error_message)}</p>
                    )}
                    <p className="text-muted-foreground">
                      {new Date(exec.executed_at as string).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
