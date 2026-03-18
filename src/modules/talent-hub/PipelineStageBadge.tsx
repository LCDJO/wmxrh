import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CandidateStage } from './types';

const stageConfig: Record<CandidateStage, { label: string; className: string }> = {
  novo: { label: 'Novo', className: 'bg-secondary text-secondary-foreground border-transparent' },
  triagem: { label: 'Triagem', className: 'bg-accent text-accent-foreground border-transparent' },
  entrevista: { label: 'Entrevista', className: 'bg-primary/10 text-primary border-transparent' },
  proposta: { label: 'Proposta', className: 'bg-warning/10 text-[hsl(var(--warning))] border-transparent' },
  contratado: { label: 'Contratado', className: 'bg-primary text-primary-foreground border-transparent' },
};

export function PipelineStageBadge({ stage }: { stage: CandidateStage }) {
  const item = stageConfig[stage];
  return <Badge className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', item.className)}>{item.label}</Badge>;
}
