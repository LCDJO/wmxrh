/**
 * GrowthSubmissions — Page for Marketing Team to view their submissions.
 */
import { GrowthSubmissionQueue } from '@/components/platform/growth/GrowthSubmissionQueue';
import { Send } from 'lucide-react';

export default function GrowthSubmissions() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Send className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Minhas Submissões</h1>
          <p className="text-sm text-muted-foreground">Conteúdo enviado para aprovação — acompanhe o status e o histórico de versões.</p>
        </div>
      </div>
      <GrowthSubmissionQueue />
    </div>
  );
}
