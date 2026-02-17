/**
 * /platform/landing/review — Landing pages aguardando aprovação.
 */
import { useState, useEffect } from 'react';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { landingPageGovernance, type ApprovalRequest } from '@/domains/platform-growth/landing-page-governance';
import { getStatusLabel } from '@/domains/platform-growth/landing-page-status-machine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, XCircle, Clock, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LandingReview() {
  const { identity } = usePlatformIdentity();
  const { can } = usePlatformPermissions();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const canApprove = can('landing.approve');
  const canReject = can('landing.reject');

  const fetchPending = async () => {
    setLoading(true);
    const data = await landingPageGovernance.listByStatus('pending_review');
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (requestId: string) => {
    if (!identity) return;
    setActing(requestId);
    try {
      await landingPageGovernance.approve(requestId, {
        userId: identity.id,
        email: identity.email,
        role: identity.role,
      }, notes[requestId]);
      toast({ title: 'Aprovada!', description: 'Landing page aprovada com sucesso.' });
      fetchPending();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!identity) return;
    const reason = notes[requestId]?.trim();
    if (!reason) {
      toast({ title: 'Atenção', description: 'Informe o motivo da rejeição.', variant: 'destructive' });
      return;
    }
    setActing(requestId);
    try {
      await landingPageGovernance.reject(requestId, {
        userId: identity.id,
        email: identity.email,
        role: identity.role,
      }, reason);
      toast({ title: 'Rejeitada', description: 'Landing page devolvida para rascunho.' });
      fetchPending();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
          <ClipboardList className="h-5 w-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Revisão & Aprovação</h1>
          <p className="text-sm text-muted-foreground">
            Landing pages aguardando aprovação — revise, aprove ou rejeite.
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {requests.length} pendente{requests.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-3 opacity-40" />
            Nenhuma landing page aguardando revisão.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <Card key={req.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Solicitação v{req.version_number}
                    </CardTitle>
                    <CardDescription>
                      Submetida por <span className="font-medium text-foreground">{req.submitted_by}</span> em{' '}
                      {new Date(req.submitted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" /> Pendente
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {req.submission_notes && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notas do submissor:</p>
                    <p className="text-sm">{req.submission_notes}</p>
                  </div>
                )}

                <Textarea
                  placeholder={canReject ? 'Notas da revisão (obrigatório para rejeição)...' : 'Notas da revisão...'}
                  value={notes[req.id] ?? ''}
                  onChange={e => setNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                  rows={2}
                />

                {(canApprove || canReject) && (
                  <div className="flex gap-2 justify-end">
                    {canReject && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1.5"
                        disabled={acting === req.id}
                        onClick={() => handleReject(req.id)}
                      >
                        {acting === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                        Rejeitar
                      </Button>
                    )}
                    {canApprove && (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={acting === req.id}
                        onClick={() => handleApprove(req.id)}
                      >
                        {acting === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Aprovar
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
