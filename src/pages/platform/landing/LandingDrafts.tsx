/**
 * /platform/landing/drafts — Landing pages em rascunho e rejeitadas.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { landingPageGovernance } from '@/domains/platform-growth/landing-page-governance';
import { getStatusLabel, getStatusVariant, getAvailableTransitions, type LandingPageStatus } from '@/domains/platform-growth/landing-page-status-machine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileEdit, Send } from 'lucide-react';
import { useToast } from '@/hooks/core/use-toast';

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

  const fetchDrafts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('landing_pages')
      .select('id, name, slug, status, created_at, updated_at, created_by')
      .in('status', ['draft', 'rejected'])
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
    } catch (err: unknown) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
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
    } catch (err: unknown) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setSubmitting(null);
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
            Landing pages em rascunho — edite e submeta para aprovação.
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
            const transitions = getAvailableTransitions(page.status as LandingPageStatus, identity?.role);
            const canSubmit = transitions.some(t => t.to === 'submitted');
            return (
              <Card key={page.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate">{page.name}</CardTitle>
                    <Badge variant={getStatusVariant(page.status as LandingPageStatus)}>
                      {getStatusLabel(page.status as LandingPageStatus)}
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
                        onClick={() => handleSubmit(page.id)}
                      >
                        {submitting === page.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        Submeter para Aprovação
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
