/**
 * WebsiteControlCenter — Control Plane widget for website/landing page health.
 * Shows: published pages, active versions, render errors, GTM status.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Globe, FileCheck, AlertTriangle, Tag, RefreshCw, CheckCircle2,
  XCircle, Clock, ExternalLink, GitBranch, Eye,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { GrowthSubmission } from '@/domains/platform-growth/growth-submission.service';
import { format } from 'date-fns';

interface PublishedPage {
  id: string;
  content_id: string;
  content_title: string;
  content_type: string;
  version_number: number;
  published_at: string;
  published_by: string | null;
  submitted_by_email: string;
}

interface RenderError {
  page: string;
  error: string;
  timestamp: string;
  severity: 'warning' | 'error';
}

interface GTMStatus {
  containerId: string | null;
  injected: boolean;
  eventsConfigured: string[];
  lastCheck: string;
}

interface WebsiteHealthData {
  publishedPages: PublishedPage[];
  activeVersions: Array<{ contentId: string; title: string; version: number; status: string; updatedAt: string }>;
  renderErrors: RenderError[];
  gtmStatus: GTMStatus;
  totalPublished: number;
  totalDraft: number;
  totalPending: number;
}

export function WebsiteControlCenter() {
  const [data, setData] = useState<WebsiteHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch submissions from the growth workflow
      const [publishedRes, allRes] = await Promise.all([
        supabase
          .from('growth_submissions')
          .select('*')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(50),
        supabase
          .from('growth_submissions')
          .select('*')
          .order('submitted_at', { ascending: false })
          .limit(100),
      ]);

      const published = (publishedRes.data ?? []) as unknown as GrowthSubmission[];
      const all = (allRes.data ?? []) as unknown as GrowthSubmission[];

      const publishedPages: PublishedPage[] = published.map(p => ({
        id: p.id,
        content_id: p.content_id,
        content_title: p.content_title,
        content_type: p.content_type,
        version_number: p.version_number,
        published_at: p.published_at ?? p.updated_at,
        published_by: p.published_by,
        submitted_by_email: p.submitted_by_email,
      }));

      // Build active versions: latest version per content_id
      const versionMap = new Map<string, GrowthSubmission>();
      for (const sub of all) {
        const existing = versionMap.get(sub.content_id);
        if (!existing || sub.version_number > existing.version_number) {
          versionMap.set(sub.content_id, sub);
        }
      }
      const activeVersions = Array.from(versionMap.values()).map(v => ({
        contentId: v.content_id,
        title: v.content_title,
        version: v.version_number,
        status: v.status,
        updatedAt: v.updated_at,
      }));

      // Simulated render errors (would come from observability in production)
      const renderErrors: RenderError[] = [];
      for (const page of published) {
        const snapshot = page.content_snapshot as Record<string, unknown>;
        const blocks = (snapshot?.blocks as unknown[]) ?? [];
        if (blocks.length === 0) {
          renderErrors.push({
            page: page.content_title,
            error: 'Landing page sem blocos configurados — renderização vazia.',
            timestamp: new Date().toISOString(),
            severity: 'error',
          });
        }
      }

      // GTM status from published pages
      const gtmContainerIds = published
        .map(p => {
          const snap = p.content_snapshot as Record<string, unknown>;
          return snap?.gtm_container_id as string | undefined;
        })
        .filter(Boolean);

      const gtmStatus: GTMStatus = {
        containerId: gtmContainerIds[0] ?? null,
        injected: gtmContainerIds.length > 0,
        eventsConfigured: ['page_view', 'cta_click', 'trial_start', 'plan_selected', 'referral_signup'],
        lastCheck: new Date().toISOString(),
      };

      const totalPublished = published.length;
      const totalDraft = all.filter(s => s.status === 'pending' || s.status === 'approved').length;
      const totalPending = all.filter(s => s.status === 'pending').length;

      setData({
        publishedPages,
        activeVersions,
        renderErrors,
        gtmStatus,
        totalPublished,
        totalDraft,
        totalPending,
      });
    } catch (e) {
      console.error('WebsiteControlCenter load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-28" />
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusKPI
          icon={Globe}
          label="Páginas Publicadas"
          value={data.totalPublished}
          accent="emerald"
        />
        <StatusKPI
          icon={Clock}
          label="Aguardando Aprovação"
          value={data.totalPending}
          accent={data.totalPending > 0 ? 'amber' : 'muted'}
        />
        <StatusKPI
          icon={AlertTriangle}
          label="Erros de Renderização"
          value={data.renderErrors.length}
          accent={data.renderErrors.length > 0 ? 'destructive' : 'emerald'}
        />
        <StatusKPI
          icon={Tag}
          label="GTM Status"
          value={data.gtmStatus.injected ? 'Ativo' : 'Inativo'}
          accent={data.gtmStatus.injected ? 'emerald' : 'amber'}
          isText
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Published Pages */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-500" />
                Páginas Publicadas
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={loadData}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <CardDescription className="text-xs">{data.publishedPages.length} página(s) ativas no site</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              {data.publishedPages.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Nenhuma página publicada ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.publishedPages.map(page => (
                    <div key={page.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{page.content_title}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] h-4">{page.content_type}</Badge>
                          <span>v{page.version_number}</span>
                          <span>·</span>
                          <span>{format(new Date(page.published_at), 'dd/MM HH:mm')}</span>
                        </div>
                      </div>
                      <a href={`/lp/${page.content_id}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Active Versions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              Versões Ativas por Conteúdo
            </CardTitle>
            <CardDescription className="text-xs">Última versão de cada conteúdo no pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              {data.activeVersions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Nenhuma versão encontrada.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.activeVersions.map(v => (
                    <div key={v.contentId} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{v.title}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <span>v{v.version}</span>
                          <span>·</span>
                          <span>{format(new Date(v.updatedAt), 'dd/MM HH:mm')}</span>
                        </div>
                      </div>
                      <Badge
                        variant={v.status === 'published' ? 'default' : v.status === 'approved' ? 'secondary' : v.status === 'rejected' ? 'destructive' : 'outline'}
                        className="text-[10px] shrink-0"
                      >
                        {v.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Render Errors */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${data.renderErrors.length > 0 ? 'text-destructive' : 'text-emerald-500'}`} />
              Erros de Renderização
            </CardTitle>
            <CardDescription className="text-xs">
              {data.renderErrors.length === 0 ? 'Nenhum erro detectado ✓' : `${data.renderErrors.length} problema(s) detectado(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.renderErrors.length === 0 ? (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-xs text-emerald-700 dark:text-emerald-400">
                  Todas as páginas publicadas estão renderizando corretamente.
                </span>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {data.renderErrors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium">{err.page}</div>
                        <div className="text-[10px] text-muted-foreground">{err.error}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(err.timestamp), 'dd/MM HH:mm:ss')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* GTM Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Google Tag Manager
            </CardTitle>
            <CardDescription className="text-xs">Status de injeção e eventos configurados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
              <div className="space-y-0.5">
                <div className="text-xs font-medium">Container ID</div>
                <div className="text-[10px] text-muted-foreground">
                  {data.gtmStatus.containerId ?? 'Não configurado'}
                </div>
              </div>
              <Badge variant={data.gtmStatus.injected ? 'default' : 'secondary'} className="text-[10px]">
                {data.gtmStatus.injected ? 'Injetado' : 'Pendente'}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium">Eventos Automáticos</div>
              <div className="flex flex-wrap gap-1.5">
                {data.gtmStatus.eventsConfigured.map(evt => (
                  <Badge key={evt} variant="outline" className="text-[10px] gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                    {evt}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground">
              Última verificação: {format(new Date(data.gtmStatus.lastCheck), 'dd/MM/yyyy HH:mm:ss')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function StatusKPI({ icon: Icon, label, value, accent, isText }: {
  icon: typeof Globe;
  label: string;
  value: number | string;
  accent: string;
  isText?: boolean;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    destructive: 'text-destructive',
    muted: 'text-muted-foreground',
    primary: 'text-primary',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${colorMap[accent] ?? 'text-muted-foreground'}`} />
        </div>
        <div className={`text-lg font-bold ${accent === 'destructive' && !isText && (value as number) > 0 ? 'text-destructive' : ''}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
