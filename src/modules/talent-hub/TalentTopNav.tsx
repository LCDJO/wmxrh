import { Brain, Briefcase, ListFilter, Network, Settings2, UserRoundSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TalentView } from './types';

const items: Array<{ key: TalentView; label: string; icon: typeof Brain }> = [
  { key: 'dashboard', label: 'Dashboard', icon: Brain },
  { key: 'candidates', label: 'Candidatos', icon: UserRoundSearch },
  { key: 'profile', label: 'Perfil', icon: ListFilter },
  { key: 'pipeline', label: 'Pipeline', icon: Network },
  { key: 'jobs', label: 'Vagas', icon: Briefcase },
  { key: 'settings', label: 'Configurações', icon: Settings2 },
];

interface TalentTopNavProps {
  active: TalentView;
  onChange: (view: TalentView) => void;
}

export function TalentTopNav({ active, onChange }: TalentTopNavProps) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-border bg-card p-2 shadow-card">
        {items.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant="ghost"
            onClick={() => onChange(key)}
            className={cn(
              'h-11 rounded-xl px-4 text-sm font-medium',
              active === key
                ? 'bg-accent text-accent-foreground shadow-sm hover:bg-accent'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
