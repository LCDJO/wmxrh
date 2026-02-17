import { Check } from 'lucide-react';

interface Plan {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
}

interface Props {
  content: Record<string, unknown>;
}

export function PricingTablePreview({ content }: Props) {
  const plans = (content.plans as Plan[]) || [];

  return (
    <div className="space-y-4 p-6">
      <h3 className="text-lg font-bold font-display text-foreground text-center">
        {(content.title as string) || 'Planos'}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {plans.map((plan, i) => (
          <div
            key={i}
            className={`rounded-lg border p-4 space-y-3 ${
              plan.highlighted
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border/60 bg-card/60'
            }`}
          >
            <h4 className="text-sm font-bold text-foreground">{plan.name}</h4>
            <div>
              <span className="text-xl font-bold text-foreground">{plan.price}</span>
              <span className="text-xs text-muted-foreground">{plan.period}</span>
            </div>
            <ul className="space-y-1">
              {plan.features.map((f, j) => (
                <li key={j} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 text-primary" /> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
