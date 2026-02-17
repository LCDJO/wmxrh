import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Star, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { EvaluationService } from '@/domains/support/evaluation-service';

interface ChatEvaluationCardProps {
  ticketId: string;
  tenantId: string;
  agentId: string | null;
}

export default function ChatEvaluationCard({ ticketId, tenantId, agentId }: ChatEvaluationCardProps) {
  const [agentRating, setAgentRating] = useState(0);
  const [systemRating, setSystemRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyEvaluated, setAlreadyEvaluated] = useState<boolean | null>(null);

  // Check on mount
  useEffect(() => {
    EvaluationService.getByTicket(ticketId).then(ev => {
      setAlreadyEvaluated(!!ev);
    }).catch(() => setAlreadyEvaluated(false));
  }, [ticketId]);

  if (alreadyEvaluated === null) return null;

  if (alreadyEvaluated || submitted) {
    return (
      <Card className="mx-3 mb-3 border-green-500/20 bg-green-500/[0.03]">
        <CardContent className="py-3 px-4 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-xs text-foreground">Avaliação registrada. Obrigado!</p>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async () => {
    if (agentRating === 0 && systemRating === 0) return;
    try {
      setSubmitting(true);
      await EvaluationService.createTicketEvaluation({
        ticket_id: ticketId,
        tenant_id: tenantId,
        agent_id: agentId,
        agent_score: agentRating > 0 ? agentRating : null,
        system_score: systemRating > 0 ? systemRating : null,
        comment: comment || undefined,
      });
      toast.success('Avaliação enviada! Obrigado.');
      setSubmitted(true);
    } catch {
      toast.error('Erro ao enviar avaliação');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mx-3 mb-3 border-primary/20 bg-primary/[0.02]">
      <CardContent className="py-4 px-4 space-y-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Avalie este atendimento</h3>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium text-foreground">⭐ Avaliar Atendente</p>
          <StarRow value={agentRating} onChange={setAgentRating} />
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium text-foreground">⭐ Avaliar Sistema</p>
          <StarRow value={systemRating} onChange={setSystemRating} />
        </div>

        <Textarea
          placeholder="Comentário opcional..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={2}
          className="text-xs"
        />

        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || (agentRating === 0 && systemRating === 0)}
          className="w-full gap-2 text-xs"
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Enviar Avaliação
        </Button>
      </CardContent>
    </Card>
  );
}

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const labels = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className="h-5 w-5 transition-colors"
              fill={(hover || value) >= n ? 'hsl(45 93% 47%)' : 'transparent'}
              stroke={(hover || value) >= n ? 'hsl(45 93% 47%)' : 'hsl(var(--muted-foreground))'}
            />
          </button>
        ))}
      </div>
      {(hover || value) > 0 && (
        <span className="text-[10px] text-muted-foreground">{labels[hover || value]}</span>
      )}
    </div>
  );
}
