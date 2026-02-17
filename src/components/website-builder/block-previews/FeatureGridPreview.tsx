import { Users, DollarSign, Shield } from 'lucide-react';
import type { Viewport, BreakpointOverrides } from '@/domains/website-builder/types';
import { getGridCols } from '@/domains/website-builder/responsive-layout-engine';

const iconMap: Record<string, React.ElementType> = { Users, DollarSign, Shield };

interface Feature {
  icon?: string;
  title: string;
  description: string;
}

interface Props {
  content: Record<string, unknown>;
  viewport: Viewport;
  breakpoint: BreakpointOverrides;
}

export function FeatureGridPreview({ content, breakpoint }: Props) {
  const features = (content.features as Feature[]) || [];
  const cols = breakpoint.columns ?? 3;

  return (
    <div className={`space-y-4 ${breakpoint.padding ?? 'p-6'}`}>
      <h3 className="text-lg font-bold font-display text-foreground text-center">
        {(content.title as string) || 'Funcionalidades'}
      </h3>
      <div className={`grid gap-4 ${getGridCols(cols)}`}>
        {features.map((f, i) => {
          const Icon = iconMap[f.icon || ''] || Users;
          return (
            <div key={i} className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-2 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">{f.title}</h4>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
