/**
 * /platform/landing/published — Landing pages publicadas, aprovadas e arquivadas.
 *
 * Features:
 *  - Publish approved pages
 *  - Archive published pages
 *  - Create new version from published page (copies to new draft, preserves history)
 *  - View version history
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import LandingVersionHistoryPanel from '@/components/platform/landing/LandingVersionHistoryPanel';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { landingPageGovernance } from '@/domains/platform-growth/landing-page-governance';
import {
  getStatusLabel,
  getStatusVariant,
  getAvailableTransitions,
  canEditInPlace,
  type LandingPageStatus,
} from '@/domains/platform-growth/landing-page-status-machine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Globe, Rocket, Archive, ExternalLink, GitBranch,
  History, Clock, CheckCircle2, User,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LandingPage {
  id: string;
  name: string;
  slug: string;
  status: string;
  blocks: unknown[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export default function LandingPublished() {
  const { identity } = usePlatformIdentity();
  const { can } = usePlatformPermissions();
  const { toast } = useToast();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  // New version dialog
  const [newVersionTarget, setNewVersionTarget] = useState<LandingPage | null>(null);
  const [newVersionNotes, setNewVersionNotes] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);

  // Version history dialog
  const [historyTarget, setHistoryTarget] = useState<LandingPage | null>(null);

  const fetchPages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('landing_pages')
      .select('id, name, slug, status, blocks, published_at, created_at, updated_at, created_by')
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
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
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
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setActing(null);
    }
  };

  /**
   * Create a new version from a published/approved page.
   * 
   * Strategy: The ORIGINAL page stays untouched (preserving history).
   * A new landing_page row is created as "draft" with:
   *  - Same slug + "-v{N}" suffix
   *  - Same blocks (deep copy)
   *  - Reference to the original page in the name
   * 
   * After approval and publish of the new version, the old page
   * is archived automatically by the governance engine.
   */
  const handleCreateNewVersion = async () => {
    if (!newVersionTarget || !identity) return;
    setCreatingVersion(true);

    try {
      const original = newVersionTarget;

      // Count existing versions to determine version number
      const { count } = await supabase
        .from('landing_pages')
        .select('*', { count: 'exact', head: true })
        .ilike('slug', `${original.slug}%`);

      const versionNum = (count ?? 1) + 1;
      const newSlug = `${original.slug}-v${versionNum}`;

      // Create new draft with deep-copied blocks
      const { data: newPage, error } = await supabase
        .from('landing_pages')
        .insert({
          name: `${original.name} (v${versionNum})`,
          slug: newSlug,
          status: 'draft',
          blocks: original.blocks as any,
          created_by: identity.id,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      toast({
        title: 'Nova versão criada!',
        description: `"${original.name} (v${versionNum})" criada como rascunho. O original permanece publicado.`,
      });

      setNewVersionTarget(null);
      setNewVersionNotes('');
      fetchPages();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingVersion(false);
    }
  };

  /**
   * Load version history (approval requests) for a page.
   */
  const handleViewHistory = (page: LandingPage) => {
    setHistoryTarget(page);
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
            Landing pages aprovadas, publicadas e arquivadas. Edite via versionamento.
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
            const canPublishPage = status === 'approved' && transitions.some(t => t.to === 'published');
            const canArchivePage = status === 'published' && transitions.some(t => t.to === 'archived');
            const isEditable = canEditInPlace(status);
            const needsVersioning = !isEditable && status !== 'archived';

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
                    {canPublishPage && (
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
                    {canArchivePage && (
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
                    {needsVersioning && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setNewVersionTarget(page)}
                      >
                        <GitBranch className="h-3 w-3" />
                        Editar Nova Versão
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleViewHistory(page)}
                    >
                      <History className="h-3 w-3" />
                      Histórico
                    </Button>
                    {status === 'published' && (
                      <Button variant="ghost" size="sm" className="gap-1.5" asChild>
                        <a href={`/lp/${page.slug}`} target="_blank" rel="noopener noreferrer">
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

      {/* New Version Dialog */}
      <Dialog open={!!newVersionTarget} onOpenChange={(open) => !open && setNewVersionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              Criar Nova Versão
            </DialogTitle>
            <DialogDescription>
              Uma cópia da página será criada como rascunho. A versão atual permanece publicada e inalterada até que a nova versão seja aprovada e publicada.
            </DialogDescription>
          </DialogHeader>

          {newVersionTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/40 bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">{newVersionTarget.name}</p>
                <p className="text-xs text-muted-foreground">/{newVersionTarget.slug}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(newVersionTarget.status as LandingPageStatus)}>
                    {getStatusLabel(newVersionTarget.status as LandingPageStatus)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {Array.isArray(newVersionTarget.blocks) ? newVersionTarget.blocks.length : 0} blocos
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Motivo da nova versão</label>
                <Textarea
                  value={newVersionNotes}
                  onChange={(e) => setNewVersionNotes(e.target.value)}
                  placeholder="Descreva as alterações planejadas..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
                <p className="text-xs font-semibold text-foreground">🔒 Preservação de Histórico</p>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li>A página atual permanece publicada</li>
                  <li>Uma cópia é criada como novo rascunho</li>
                  <li>A nova versão passa pelo fluxo completo de governança</li>
                  <li>Ao publicar a nova versão, a anterior é arquivada automaticamente</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewVersionTarget(null)} disabled={creatingVersion}>
              Cancelar
            </Button>
            <Button onClick={handleCreateNewVersion} disabled={creatingVersion} className="gap-1.5">
              {creatingVersion ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
              Criar Nova Versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog — powered by LandingVersionHistoryPanel */}
      <Dialog open={!!historyTarget} onOpenChange={(open) => !open && setHistoryTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico de Versões
            </DialogTitle>
            <DialogDescription>
              Registro completo de versões, aprovações e publicações.
            </DialogDescription>
          </DialogHeader>

          {historyTarget && (
            <LandingVersionHistoryPanel
              landingPageId={historyTarget.id}
              pageName={historyTarget.name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
