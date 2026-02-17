import { Users, DollarSign, Shield } from 'lucide-react';

const iconMap: Record<string, React.ElementType> = { Users, DollarSign, Shield };

interface Feature {
  icon?: string;
  title: string;
  description: string;
}

interface Props {
  content: Record<string, unknown>;
}

export function FeatureGridPreview({ content }: Props) {
  const features = (content.features as Feature[]) || [];
  const cols = (content.columns as number) || 3;

  return (
    <div className="space-y-4 p-6">
      <h3 className="text-lg font-bold font-display text-foreground text-center">
        {(content.title as string) || 'Funcionalidades'}
      </h3>
      <div className={`grid gap-4 ${cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
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
