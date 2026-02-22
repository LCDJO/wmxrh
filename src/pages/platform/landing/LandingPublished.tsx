/**
 * /platform/landing/published — Landing pages publicadas e aprovadas prontas para publicação.
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
import { Loader2, Globe, Rocket, Archive, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LandingPage {
  id: string;
  name: string;
  slug: string;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function LandingPublished() {
  const { identity } = usePlatformIdentity();
  const { can } = usePlatformPermissions();
  const { toast } = useToast();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchPages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('landing_pages')
      .select('id, name, slug, status, published_at, created_at, updated_at')
      .in('status', ['approved', 'published', 'archived'])
      .order('updated_at', { ascending: false });
    setPages((data as LandingPage[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchPages(); }, []);

  const handlePublish = async (pageId: string) => {
    if (!identity) return;
    setActing(pageId);
    try {
      // Find the latest approved request for this page
      const requests = await landingPageGovernance.listByPage(pageId);
      const approvedReq = requests.find(r => r.status === 'approved');
      if (!approvedReq) {
        toast({ title: 'Erro', description: 'Nenhuma aprovação encontrada para esta página.', variant: 'destructive' });
        return;
      }
      await landingPageGovernance.publish(approvedReq.id, {
        userId: identity.id,
        email: identity.email,
        role: identity.role,
      });
      toast({ title: 'Publicada!', description: 'Landing page publicada com sucesso.' });
      fetchPages();
    } catch (err: unknown) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setActing(null);
    }
  };

  const handleArchive = async (pageId: string) => {
    if (!identity || !can('landing.publish')) return;
    setActing(pageId);
    try {
      await supabase
        .from('landing_pages')
        .update({ status: 'archived' })
        .eq('id', pageId);
      toast({ title: 'Arquivada', description: 'Landing page movida para arquivo.' });
      fetchPages();
    } catch (err: unknown) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Publicadas</h1>
          <p className="text-sm text-muted-foreground">
            Landing pages aprovadas, publicadas e arquivadas.
          </p>
        </div>
      </div>

      {pages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma landing page publicada ou aprovada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pages.map(page => {
            const status = page.status as LandingPageStatus;
            const transitions = getAvailableTransitions(status, identity?.role);
            const canPublish = status === 'approved' && transitions.some(t => t.to === 'published');
            const canArchive = status === 'published' && transitions.some(t => t.to === 'archived');

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
                  {page.published_at && (
                    <p className="text-xs text-muted-foreground">
                      Publicada em: {new Date(page.published_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {canPublish && (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={acting === page.id}
                        onClick={() => handlePublish(page.id)}
                      >
                        {acting === page.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                        Publicar
                      </Button>
                    )}
                    {canArchive && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={acting === page.id}
                        onClick={() => handleArchive(page.id)}
                      >
                        {acting === page.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                        Arquivar
                      </Button>
                    )}
                    {status === 'published' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        asChild
                      >
                        <a
                          href={`https://${page.slug}.${window.location.hostname.replace(/^[^.]+\./, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" /> Abrir
                        </a>
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
