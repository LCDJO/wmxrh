/**
 * GrowthApprovalQueue — Approval panel for Director/SuperAdmin.
 * Shows pending submissions, allows approve/reject/publish with notes.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { growthSubmissionService, type GrowthSubmission } from '@/domains/platform-growth/growth-submission.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldCheck, CheckCircle2, XCircle, Rocket, Eye, History, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TYPE_LABELS: Record<string, string> = {
  landing_page: 'Landing Page',
  fab_content: 'Conteúdo FAB',
  website_page: 'Página do Site',
  campaign: 'Campanha',
  template: 'Template',
};

export function GrowthApprovalQueue() {
  const { user } = useAuth();
  const [pending, setPending] = useState<GrowthSubmission[]>([]);
  const [approved, setApproved] = useState<GrowthSubmission[]>([]);
  const [all, setAll] = useState<GrowthSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ action: string; performed_by_email: string; notes: string | null; created_at: string }>>([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, a, allSubs] = await Promise.all([
        growthSubmissionService.list({ status: 'pending' }),
        growthSubmissionService.list({ status: 'approved' }),
        growthSubmissionService.list(),
      ]);
      setPending(p);
      setApproved(a);
      setAll(allSubs);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    try {
      await growthSubmissionService.approve(id, user.id, user.email || '');
      toast.success('Submissão aprovada com sucesso.');
      loadAll();
    } catch {
      toast.error('Erro ao aprovar.');
    }
  };

  const handleReject = async () => {
    if (!user || !rejectingId || !rejectNotes.trim()) return;
    try {
      await growthSubmissionService.reject(rejectingId, user.id, user.email || '', rejectNotes);
      toast.success('Submissão rejeitada.');
      setRejectingId(null);
      setRejectNotes('');
      loadAll();
    } catch {
      toast.error('Erro ao rejeitar.');
    }
  };

  const handlePublish = async (id: string) => {
    if (!user) return;
    try {
      await growthSubmissionService.publish(id, user.id, user.email || '');
      toast.success('Conteúdo publicado com sucesso!');
      loadAll();
    } catch {
      toast.error('Erro ao publicar.');
    }
  };

  const viewLogs = async (submissionId: string) => {
    setExpandedId(expandedId === submissionId ? null : submissionId);
    if (expandedId !== submissionId) {
      const data = await growthSubmissionService.getLogs(submissionId);
      setLogs(data);
    }
  };

  const renderSubmission = (sub: GrowthSubmission, showActions: 'approve' | 'publish' | 'none') => (
    <div key={sub.id} className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium">{sub.content_title}</span>
            <Badge variant="outline" className="text-xs">{TYPE_LABELS[sub.content_type] || sub.content_type}</Badge>
            <Badge variant="outline" className="text-xs">v{sub.version_number}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Enviado por <span className="font-medium">{sub.submitted_by_email}</span> em {format(new Date(sub.submitted_at), 'dd/MM/yyyy HH:mm')}
            {sub.change_summary && <> · {sub.change_summary}</>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => viewLogs(sub.id)}>
            {expandedId === sub.id ? <ChevronUp className="h-4 w-4" /> : <History className="h-4 w-4" />}
          </Button>
          {showActions === 'approve' && (
            <>
              <Button size="sm" variant="default" className="gap-1" onClick={() => handleApprove(sub.id)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
              </Button>
              <Dialog open={rejectingId === sub.id} onOpenChange={(o) => { if (!o) setRejectingId(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => setRejectingId(sub.id)}>
                    <XCircle className="h-3.5 w-3.5" /> Rejeitar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rejeitar submissão</DialogTitle>
                  </DialogHeader>
                  <Textarea
                    placeholder="Motivo da rejeição (obrigatório)..."
                    value={rejectNotes}
                    onChange={e => setRejectNotes(e.target.value)}
                    rows={3}
                  />
                  <DialogFooter>
                    <Button variant="destructive" disabled={!rejectNotes.trim()} onClick={handleReject}>
                      Confirmar Rejeição
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          {showActions === 'publish' && (
            <Button size="sm" variant="default" className="gap-1" onClick={() => handlePublish(sub.id)}>
              <Rocket className="h-3.5 w-3.5" /> Publicar
            </Button>
          )}
        </div>
      </div>

      {/* Inline logs */}
      {expandedId === sub.id && (
        <div className="border-t pt-2 space-y-1">
          {logs.map((log, i) => (
            <div key={i} className="text-xs border-l-2 border-primary/30 pl-2 py-0.5">
              <span className="font-semibold">{log.action}</span>
              <span className="text-muted-foreground"> por {log.performed_by_email}</span>
              <span className="text-muted-foreground"> · {format(new Date(log.created_at), 'dd/MM HH:mm')}</span>
              {log.notes && <div className="text-muted-foreground">{log.notes}</div>}
            </div>
          ))}
          {logs.length === 0 && <p className="text-xs text-muted-foreground">Sem registros.</p>}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Fila de Aprovação
        </CardTitle>
        <CardDescription>
          Revise, aprove ou rejeite submissões da equipe. Publicação requer duplo aceite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending" className="space-y-3">
          <TabsList>
            <TabsTrigger value="pending" className="gap-1">
              Pendentes
              {pending.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{pending.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1">
              Aprovados
              {approved.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{approved.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <ScrollArea className="h-[450px]">
              <div className="space-y-3">
                {pending.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma submissão pendente.</p>
                ) : (
                  pending.map(sub => renderSubmission(sub, 'approve'))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="approved">
            <ScrollArea className="h-[450px]">
              <div className="space-y-3">
                {approved.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma submissão aprovada aguardando publicação.</p>
                ) : (
                  approved.map(sub => renderSubmission(sub, 'publish'))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="all">
            <ScrollArea className="h-[450px]">
              <div className="space-y-3">
                {all.map(sub => {
                  const action = sub.status === 'pending' ? 'approve' : sub.status === 'approved' ? 'publish' : 'none';
                  return renderSubmission(sub, action);
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
