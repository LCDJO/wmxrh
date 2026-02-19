/**
 * MarketplaceHealthWidget — Control Plane widget for Marketplace & Developer ecosystem health.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Store, Users, Download, ShieldCheck, AlertTriangle,
  CheckCircle2, Clock, XCircle, TrendingUp,
} from 'lucide-react';

export function MarketplaceHealthWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['control-plane-marketplace-health'],
    queryFn: async () => {
      const [appsRes, devsRes, installsRes, reviewsRes, subsRes] = await Promise.all([
        supabase.from('developer_apps').select('id, app_status'),
        supabase.from('developer_accounts').select('id, status'),
        supabase.from('developer_app_installations').select('id, status'),
        supabase.from('developer_app_reviews').select('id, status'),
        supabase.from('developer_api_subscriptions').select('id, status'),
      ]);

      const apps = appsRes.data ?? [];
      const devs = devsRes.data ?? [];
      const installs = installsRes.data ?? [];
      const reviews = reviewsRes.data ?? [];
      const subs = subsRes.data ?? [];

      return {
        apps: {
          total: apps.length,
          published: apps.filter(a => a.app_status === 'published').length,
          in_review: apps.filter(a => a.app_status === 'in_review').length,
          suspended: apps.filter(a => a.app_status === 'suspended').length,
        },
        developers: {
          total: devs.length,
          active: devs.filter(d => d.status === 'active').length,
          pending: devs.filter(d => d.status === 'pending').length,
        },
        installs: {
          total: installs.length,
          active: installs.filter(i => i.status === 'active').length,
        },
        reviews: {
          pending: reviews.filter(r => r.status === 'pending' || r.status === 'in_progress').length,
          passed: reviews.filter(r => r.status === 'passed').length,
          failed: reviews.filter(r => r.status === 'failed').length,
        },
        subscriptions: {
          active: subs.filter(s => s.status === 'active').length,
        },
      };
    },
    refetchInterval: 60_000,
  });

  const healthScore = data
    ? Math.min(100, Math.round(
        (data.apps.published > 0 ? 25 : 0) +
        (data.developers.active > 0 ? 25 : 0) +
        (data.apps.suspended === 0 ? 25 : Math.max(0, 25 - data.apps.suspended * 5)) +
        (data.reviews.failed === 0 ? 25 : Math.max(0, 25 - data.reviews.failed * 5))
      ))
    : 0;

  const healthColor = healthScore >= 80
    ? 'text-emerald-500'
    : healthScore >= 50
      ? 'text-amber-500'
      : 'text-destructive';

  const healthBg = healthScore >= 80
    ? 'bg-emerald-500/10 border-emerald-500/20'
    : healthScore >= 50
      ? 'bg-amber-500/10 border-amber-500/20'
      : 'bg-destructive/10 border-destructive/20';

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Store className="h-4 w-4" /> Marketplace Health</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground">Carregando...</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            Marketplace Health
          </span>
          <Badge variant="outline" className={`${healthBg} ${healthColor} font-mono text-xs`}>
            {healthScore}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Apps Publicados', value: data?.apps.published ?? 0, icon: CheckCircle2, color: 'text-emerald-500' },
            { label: 'Developers Ativos', value: data?.developers.active ?? 0, icon: Users, color: 'text-primary' },
            { label: 'Instalações Ativas', value: data?.installs.active ?? 0, icon: Download, color: 'text-blue-500' },
            { label: 'API Subs Ativas', value: data?.subscriptions.active ?? 0, icon: ShieldCheck, color: 'text-violet-500' },
          ].map(kpi => (
            <div key={kpi.label} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
              <kpi.icon className={`h-4 w-4 ${kpi.color} shrink-0`} />
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Status indicators */}
        <div className="flex flex-wrap gap-2">
          {data && data.reviews.pending > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
              <Clock className="h-3 w-3 mr-1" />{data.reviews.pending} reviews pendentes
            </Badge>
          )}
          {data && data.apps.in_review > 0 && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px]">
              <TrendingUp className="h-3 w-3 mr-1" />{data.apps.in_review} apps em revisão
            </Badge>
          )}
          {data && data.apps.suspended > 0 && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">
              <XCircle className="h-3 w-3 mr-1" />{data.apps.suspended} apps suspensos
            </Badge>
          )}
          {data && data.developers.pending > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
              <AlertTriangle className="h-3 w-3 mr-1" />{data.developers.pending} devs pendentes
            </Badge>
          )}
          {data && data.reviews.failed > 0 && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">
              <XCircle className="h-3 w-3 mr-1" />{data.reviews.failed} reviews reprovados
            </Badge>
          )}
          {data && data.reviews.pending === 0 && data.apps.suspended === 0 && data.developers.pending === 0 && (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
              <CheckCircle2 className="h-3 w-3 mr-1" />Ecossistema saudável
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
