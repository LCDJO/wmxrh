/**
 * GrowthApprovals — Page for Director/SuperAdmin to approve/reject/publish.
 */
import { GrowthApprovalQueue } from '@/components/platform/growth/GrowthApprovalQueue';
import { ShieldCheck } from 'lucide-react';

export default function GrowthApprovals() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Fila de Aprovação</h1>
          <p className="text-sm text-muted-foreground">Aprove, rejeite ou publique conteúdo submetido pela equipe. Publicação requer duplo aceite.</p>
        </div>
      </div>
      <GrowthApprovalQueue />
    </div>
  );
}
