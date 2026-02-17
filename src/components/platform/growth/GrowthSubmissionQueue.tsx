/**
 * GrowthSubmissionQueue — "Minhas Submissões" view for Marketing Team.
 * Shows content submitted by the current user with versioning info.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { growthSubmissionService, type GrowthSubmission } from '@/domains/platform-growth/growth-submission.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Clock, CheckCircle2, XCircle, Eye, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  pending: { label: 'Aguardando Aprovação', variant: 'secondary', icon: Clock },
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle2 },
  rejected: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
  published: { label: 'Publicado', variant: 'default', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', variant: 'outline', icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  landing_page: 'Landing Page',
  fab_content: 'Conteúdo FAB',
  website_page: 'Página do Site',
  campaign: 'Campanha',
  template: 'Template',
};

export function GrowthSubmissionQueue() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<GrowthSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ action: string; performed_by_email: string; notes: string | null; created_at: string }>>([]);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const data = await growthSubmissionService.list();
      setSubmissions(data);
    } finally {
      setLoading(false);
    }
  };

  const viewLogs = async (submissionId: string) => {
    setSelectedId(submissionId);
    const data = await growthSubmissionService.getLogs(submissionId);
    setLogs(data);
  };

  const handleCancel = async (id: string) => {
    if (!user) return;
    await growthSubmissionService.cancel(id, user.id, user.email || '');
    loadSubmissions();
  };

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
          <Send className="h-5 w-5" />
          Minhas Submissões
        </CardTitle>
        <CardDescription>
          Conteúdo enviado para aprovação do Diretor de Marketing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma submissão encontrada.</p>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {submissions.map(sub => {
                const config = STATUS_CONFIG[sub.status] || STATUS_CONFIG.pending;
                const Icon = config.icon;
                return (
                  <div key={sub.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{sub.content_title}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {TYPE_LABELS[sub.content_type] || sub.content_type}
                        </Badge>
                        <Badge variant="outline" className="text-xs shrink-0">
                          v{sub.version_number}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                        <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
                        <span>·</span>
                        <span>{format(new Date(sub.submitted_at), 'dd/MM/yyyy HH:mm')}</span>
                        {sub.change_summary && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[200px]">{sub.change_summary}</span>
                          </>
                        )}
                      </div>
                      {sub.review_notes && sub.status === 'rejected' && (
                        <p className="text-xs text-destructive mt-1">Motivo: {sub.review_notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => viewLogs(sub.id)}>
                            <History className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Histórico — {sub.content_title} v{sub.version_number}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {logs.map((log, i) => (
                              <div key={i} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                                <span className="font-medium">{log.action}</span>
                                <span className="text-muted-foreground"> por {log.performed_by_email}</span>
                                <div className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}</div>
                                {log.notes && <div className="text-xs mt-0.5">{log.notes}</div>}
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                      {sub.status === 'pending' && (
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleCancel(sub.id)}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
