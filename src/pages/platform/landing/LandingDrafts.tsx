/**
 * /platform/landing/drafts — Landing pages em rascunho e rejeitadas.
 * 
 * Features:
 *  - Save draft
 *  - Submit for approval
 *  - Safe delete (only draft — governed by status machine)
 *    - PlatformMarketing: own drafts only
 *    - Director/SuperAdmin: any draft
 *    - Soft delete: sets deleted_at + deleted_by, preserves ID
 *    - Audit log entry on deletion
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { landingPageGovernance } from '@/domains/platform-growth/landing-page-governance';
import {
  getStatusLabel,
  getStatusVariant,
  getAvailableTransitions,
  canDeletePage,
  hasRunningExperiments,
  type LandingPageStatus,
} from '@/domains/platform-growth/landing-page-status-machine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, FileEdit, Send, Trash2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LandingPreSubmitAlert } from '@/components/platform/landing/LandingPreSubmitAlert';
import type { LandingPage as LandingPageType } from '@/domains/platform-growth/types';

interface LandingPage {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export default function LandingDrafts() {
  const { identity } = usePlatformIdentity();
  const { can } = usePlatformPermissions();
  const { toast } = useToast();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LandingPage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preSubmitPage, setPreSubmitPage] = useState<LandingPage | null>(null);

  const fetchDrafts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('landing_pages')
      .select('id, name, slug, status, created_at, updated_at, created_by')
      .in('status', ['draft', 'rejected'])
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    setPages((data as LandingPage[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchDrafts(); }, []);

  const handleSaveDraft = async (pageId: string) => {
    setSubmitting(pageId);
    try {
      await supabase
        .from('landing_pages')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', pageId);
      toast({ title: 'Salvo!', description: 'Rascunho salvo com sucesso.' });
      fetchDrafts();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(null);
    }
  };

  const handleSubmit = async (pageId: string) => {
    if (!identity) return;
    setSubmitting(pageId);
    try {
      await landingPageGovernance.submit(pageId, {
        userId: identity.id,
        email: identity.email,
        role: identity.role,
      });
      toast({ title: 'Submetida!', description: 'Landing page enviada para revisão.' });
      fetchDrafts();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !identity) return;
    const status = deleteTarget.status as LandingPageStatus;

    // Double-check governance rules (ownership + role)
    if (!canDeletePage(status, identity.role, deleteTarget.created_by, identity.id)) {
      toast({
        title: 'Exclusão bloqueada',
        description: status !== 'draft'
          ? `Landing pages com status "${getStatusLabel(status)}" não podem ser excluídas. Somente rascunhos.`
          : 'Você não tem permissão para excluir este rascunho.',
        variant: 'destructive',
      });
      setDeleteTarget(null);
      return;
    }

    // Block deletion if there are running A/B experiments
    if (hasRunningExperiments(deleteTarget.id)) {
      toast({
        title: 'Exclusão bloqueada',
        description: 'Landing page com experimentos A/B em execução não pode ser excluída. Finalize ou cancele os experimentos.',
        variant: 'destructive',
      });
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    try {
      // Soft delete: preserve ID, set deleted_at + deleted_by, clear content
      const { error } = await supabase
        .from('landing_pages')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: identity.id,
          blocks: [],
          analytics: {},
          status: 'draft', // keep status for audit trail
        })
        .eq('id', deleteTarget.id);

      if (error) throw new Error(error.message);

      // Write audit log
      await supabase.from('audit_logs').insert({
        tenant_id: '00000000-0000-0000-0000-000000000000', // platform-level
        entity_type: 'landing_page',
        entity_id: deleteTarget.id,
        action: 'LandingDraftDeleted',
        user_id: identity.id,
        metadata: {
          page_name: deleteTarget.name,
          page_slug: deleteTarget.slug,
          deleted_by_role: identity.role,
          deleted_by_email: identity.email,
        },
        old_value: { status: deleteTarget.status, name: deleteTarget.name },
        new_value: { deleted_at: new Date().toISOString() },
      });

      toast({
        title: 'Excluída',
        description: `"${deleteTarget.name}" foi removida. O ID permanece reservado no histórico.`,
      });
      fetchDrafts();
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <FileEdit className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Rascunhos</h1>
          <p className="text-sm text-muted-foreground">
            Landing pages em rascunho — edite, submeta para aprovação ou exclua com segurança.
          </p>
        </div>
      </div>

      {pages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma landing page em rascunho.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pages.map(page => {
            const status = page.status as LandingPageStatus;
            const transitions = getAvailableTransitions(status, identity?.role);
            const canSubmit = transitions.some(t => t.to === 'submitted');
            const isDeletable = canDeletePage(status, identity?.role, page.created_by, identity?.id ?? null);

            return (
              <Card key={page.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate">{page.name}</CardTitle>
                    <Badge variant={getStatusVariant(status)}>
                      {getStatusLabel(status)}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">/{page.slug}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end gap-3">
                  <p className="text-xs text-muted-foreground">
                    Atualizado: {new Date(page.updated_at).toLocaleDateString('pt-BR')}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={submitting === page.id}
                      onClick={() => handleSaveDraft(page.id)}
                    >
                      {submitting === page.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileEdit className="h-3 w-3" />
                      )}
                      Salvar Rascunho
                    </Button>
                    {canSubmit && (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={submitting === page.id}
                        onClick={() => setPreSubmitPage(page)}
                      >
                        {submitting === page.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        Submeter para Aprovação
                      </Button>
                    )}
                    {isDeletable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(page)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Excluir Rascunho
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pre-Submit Governance AI Alert */}
      <AlertDialog open={!!preSubmitPage} onOpenChange={(open) => !open && setPreSubmitPage(null)}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Submeter "{preSubmitPage?.name}" para Aprovação
            </AlertDialogTitle>
            <AlertDialogDescription>
              A Governance AI analisou esta página antes da submissão.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {preSubmitPage && (
            <LandingPreSubmitAlert
              page={preSubmitPage as unknown as LandingPageType}
              onDismiss={() => setPreSubmitPage(null)}
              onProceed={() => {
                const pageId = preSubmitPage.id;
                setPreSubmitPage(null);
                handleSubmit(pageId);
              }}
            />
          )}

          {/* If no alerts are found, show a simple proceed button */}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (preSubmitPage) {
                const pageId = preSubmitPage.id;
                setPreSubmitPage(null);
                handleSubmit(pageId);
              }
            }}>
              Submeter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Safe Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Excluir Landing Page
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Tem certeza que deseja excluir <strong>"{deleteTarget?.name}"</strong>?
              </span>
              <span className="block text-xs">
                O conteúdo será removido permanentemente, mas o ID será preservado no histórico de governança (soft delete).
              </span>
              <span className="block text-[11px] text-muted-foreground border-t border-border/40 pt-2 mt-2">
                Nota: Somente rascunhos podem ser excluídos. Após submissão, a exclusão é bloqueada para preservar a trilha de auditoria.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
