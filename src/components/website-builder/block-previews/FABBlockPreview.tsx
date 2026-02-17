import { Sparkles } from 'lucide-react';

interface Props {
  content: Record<string, unknown>;
}

export function FABBlockPreview({ content }: Props) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Feature → Advantage → Benefit</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Feature</span>
          <p className="text-sm font-medium text-foreground">{(content.feature as string) || ''}</p>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Advantage</span>
          <p className="text-sm font-medium text-foreground">{(content.advantage as string) || ''}</p>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Benefit</span>
          <p className="text-sm font-medium text-primary">{(content.benefit as string) || ''}</p>
        </div>
      </div>
    </div>
  );
}
