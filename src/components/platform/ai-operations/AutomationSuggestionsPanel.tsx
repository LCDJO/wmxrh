import { useState } from 'react';
import { Zap, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AutomationSuggestion } from '@/domains/autonomous-operations/types';

const priorityStyles: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  high: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  medium: 'bg-primary/10 text-primary border-primary/30',
  low: 'bg-muted text-muted-foreground border-border',
};

interface Props {
  suggestions: AutomationSuggestion[];
}

export function AutomationSuggestionsPanel({ suggestions }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pending = suggestions.filter(s => s.status === 'pending');
  const top = pending.slice(0, 6);

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Sugestões de Automação
          <Badge variant="secondary" className="ml-auto text-xs">{pending.length} pendentes</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
        {top.map(s => {
          const open = expandedId === s.id;
          return (
            <div key={s.id} className="rounded-lg border border-border p-3 space-y-2">
              <button
                className="w-full flex items-start justify-between gap-2 text-left"
                onClick={() => setExpandedId(open ? null : s.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground leading-tight">{s.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', priorityStyles[s.priority])}>
                      {s.priority}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{s.estimated_impact}</span>
                  </div>
                </div>
                {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
              </button>
              {open && (
                <div className="text-xs text-muted-foreground space-y-1.5 pt-1 border-t border-border">
                  <p>{s.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {s.actions.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-accent text-accent-foreground px-1.5 py-0.5 rounded text-[10px]">
                        <CheckCircle2 className="h-3 w-3" />{a.type} → {a.target}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {top.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sugestão pendente.</p>
        )}
      </CardContent>
    </Card>
  );
}
