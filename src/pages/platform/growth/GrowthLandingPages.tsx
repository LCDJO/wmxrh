/**
 * GrowthLandingPages — LP management + analytics.
 * Publishing restricted to: PlatformSuperAdmin, PlatformOperations, PlatformMarketing.
 */
import { useState, useEffect } from 'react';
import {
  Globe, Eye, Users, Target, Percent, BarChart3, ArrowUpRight,
  Layout, ExternalLink, Plus, Upload, Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { landingPageBuilder } from '@/domains/platform-growth';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import type { LandingPage } from '@/domains/platform-growth/types';

export default function GrowthLandingPages() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const { can } = usePlatformPermissions();
  const canPublish = can('landing_page.publish');

  useEffect(() => {
    landingPageBuilder.getAll().then(setPages);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Landing Pages</h1>
            <p className="text-sm text-muted-foreground">{pages.length} páginas configuradas</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />Nova LP
        </Button>
      </div>

      {pages.map(page => (
        <Card key={page.id} className="border-border/60 bg-card/60">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[hsl(30_90%_55%/0.12)] flex items-center justify-center">
                  <Globe className="h-5 w-5 text-[hsl(30_90%_55%)]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{page.name}</h3>
                  <p className="text-xs text-muted-foreground">/{page.slug} • {page.blocks.length} blocos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="gap-1 text-xs" asChild>
                  <a href={`/lp/${page.slug}`} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-3 w-3" />Preview
                  </a>
                </Button>
                {page.status === 'draft' && (
                  <Button size="sm" variant="outline" className="gap-1 text-xs">
                    <Send className="h-3 w-3" />Submeter
                  </Button>
                )}
                {canPublish && page.status === 'approved' && (
                  <Button size="sm" variant="outline" className="gap-1 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                    <Upload className="h-3 w-3" />Publicar
                  </Button>
                )}
                <Badge variant="outline" className={cn('text-[10px]',
                  page.status === 'published' ? 'border-emerald-500/30 text-emerald-400' :
                  page.status === 'approved' ? 'border-blue-500/30 text-blue-400' :
                  'border-amber-500/30 text-amber-400'
                )}>
                  {page.status === 'approved' ? 'aprovado' : page.status}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: 'Views', value: page.analytics.views.toLocaleString(), icon: Eye },
                { label: 'Únicos', value: page.analytics.uniqueVisitors.toLocaleString(), icon: Users },
                { label: 'Conversões', value: page.analytics.conversions, icon: Target },
                { label: 'Conv. Rate', value: `${page.analytics.conversionRate}%`, icon: Percent },
                { label: 'Tempo médio', value: `${Math.round(page.analytics.avgTimeOnPage / 60)}min`, icon: BarChart3 },
                { label: 'Bounce', value: `${page.analytics.bounceRate}%`, icon: ArrowUpRight },
              ].map(stat => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="text-center p-2 rounded-md bg-muted/20 border border-border/40">
                    <Icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-bold text-foreground">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {page.blocks.map(block => (
                <Badge key={block.id} variant="secondary" className="text-[10px] gap-1">
                  <Layout className="h-2.5 w-2.5" />{block.type}
                </Badge>
              ))}
            </div>

            <div className="flex gap-3">
              {page.analytics.topSources.map(s => (
                <div key={s.source} className="flex items-center gap-1.5 text-xs">
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  <span className="text-foreground font-medium">{s.source}</span>
                  <span className="text-muted-foreground">({s.visits})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
