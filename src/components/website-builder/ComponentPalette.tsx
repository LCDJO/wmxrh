import {
  Layout, Grid3X3, Sparkles, CreditCard,
  MousePointerClick, MessageSquareQuote, HelpCircle,
} from 'lucide-react';
import { BLOCK_DEFINITIONS, type WebsiteBlockType } from '@/domains/website-builder/types';
import { ScrollArea } from '@/components/ui/scroll-area';

const iconMap: Record<string, React.ElementType> = {
  Layout,
  Grid3x3: Grid3X3,
  Sparkles,
  CreditCard,
  MousePointerClick,
  MessageSquareQuote,
  HelpCircle,
};

interface Props {
  onAddBlock: (type: WebsiteBlockType) => void;
}

export function ComponentPalette({ onAddBlock }: Props) {
  return (
    <div className="w-64 shrink-0 rounded-xl border border-border/60 bg-card/60">
      <div className="p-4 border-b border-border/60">
        <h3 className="text-sm font-bold font-display text-foreground">Componentes</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Clique para adicionar ao layout</p>
      </div>
      <ScrollArea className="h-[calc(100vh-22rem)]">
        <div className="p-3 space-y-2">
          {BLOCK_DEFINITIONS.map((def) => {
            const Icon = iconMap[def.icon] || Layout;
            return (
              <button
                key={def.type}
                onClick={() => onAddBlock(def.type)}
                className="flex w-full items-start gap-3 rounded-lg border border-border/40 bg-background p-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{def.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{def.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
