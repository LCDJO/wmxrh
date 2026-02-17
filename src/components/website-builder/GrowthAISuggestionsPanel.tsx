/**
 * GrowthAISuggestionsPanel — Displays Growth AI suggestions for a website page.
 * READ-ONLY display; user must click "Aplicar" to trigger changes.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, TrendingUp, Sparkles, ArrowUpDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { WebsiteBlock } from '@/domains/website-builder/types';
import {
  analyzePageForGrowth,
  type GrowthSuggestion,
  type SuggestionCategory,
} from '@/domains/website-builder/growth-ai-integration';

const CATEGORY_META: Record<SuggestionCategory, { label: string; icon: React.ElementType; cls: string }> = {
  headline: { label: 'Headline', icon: Sparkles, cls: 'bg-primary/10 text-primary border-primary/20' },
  'fab-reorder': { label: 'FAB Order', icon: ArrowUpDown, cls: 'bg-accent/50 text-accent-foreground border-accent/30' },
  conversion: { label: 'Conversão', icon: TrendingUp, cls: 'bg-warning/10 text-warning border-warning/20' },
};

const PRIORITY_CLS: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-muted text-muted-foreground border-border',
};

interface Props {
  blocks: WebsiteBlock[];
  onApply?: (suggestion: GrowthSuggestion) => void;
  className?: string;
}

export function GrowthAISuggestionsPanel({ blocks, onApply, className }: Props) {
  const suggestions = useMemo(() => analyzePageForGrowth(blocks), [blocks]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = suggestions.filter(s => !dismissed.has(s.id));
  const avgUplift = visible.length > 0
    ? (visible.reduce((s, v) => s + v.predictedUplift, 0) / visible.length).toFixed(0)
    : '0';

  if (visible.length === 0) {
    return (
      <Card className={cn('border-border/60', className)}>
        <CardContent className="p-6 text-center">
          <Brain className="h-8 w-8 text-primary mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">Nenhuma sugestão de Growth AI no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-border/60', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Growth AI Suggestions</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
            +{avgUplift}% uplift médio
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {visible.map(s => {
          const cat = CATEGORY_META[s.category];
          const CatIcon = cat.icon;

          return (
            <div
              key={s.id}
              className="p-3 rounded-lg border border-border/40 hover:border-primary/30 transition-colors space-y-2"
            >
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
                  <CatIcon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </div>
                <Badge variant="outline" className={cn('text-[9px] shrink-0', PRIORITY_CLS[s.priority])}>
                  {s.priority === 'high' ? 'Alta' : s.priority === 'medium' ? 'Média' : 'Baixa'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[9px]', cat.cls)}>
                    {cat.label}
                  </Badge>
                  <span className="text-[10px] text-primary font-bold">+{s.predictedUplift}% uplift</span>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-muted-foreground"
                    onClick={() => {
                      setDismissed(prev => new Set(prev).add(s.id));
                      toast.info('Sugestão descartada');
                    }}
                  >
                    Descartar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1 text-primary"
                    onClick={() => {
                      onApply?.(s);
                      toast.success(`Aplicando: ${s.title}`);
                    }}
                  >
                    Aplicar <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
