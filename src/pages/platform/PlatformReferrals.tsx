/**
 * /platform/referrals — Referral dashboard with conversion funnel.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link2, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { ReferralLink, ReferralTracking } from '@/domains/revenue-intelligence';
import ReferralConversionFunnel from '@/components/platform/widgets/ReferralConversionFunnel';

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export default function PlatformReferrals() {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [tracking, setTracking] = useState<ReferralTracking[]>([]);

  const engine = getRevenueIntelligenceEngine();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [l, t] = await Promise.all([
        engine.referral.getLinks(),
        engine.referral.getTracking(),
      ]);
      setLinks(l);
      setTracking(t);
    } catch {
      toast.error('Erro ao carregar referrals');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const statusCounts = tracking.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-[360px]" /><Skeleton className="h-[360px]" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Referrals</h1>
          <p className="text-sm text-muted-foreground mt-1">Links, funil de conversão e tracking de indicações.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { fetchAll(); toast.success('Atualizado'); }}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Funnel Widget */}
      <ReferralConversionFunnel />

      {/* Status breakdown */}
      <div className="grid gap-4 md:grid-cols-5">
        {['pending', 'trial', 'converted', 'churned', 'expired'].map(status => (
          <Card key={status}>
            <CardContent className="pt-5 text-center">
              <p className="text-2xl font-bold text-foreground">{statusCounts[status] ?? 0}</p>
              <p className="text-xs text-muted-foreground capitalize">{status}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Links table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Links de Referral</CardTitle>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum link criado.</p>
          ) : (
            <ScrollArea className="h-[350px]">
              <div className="space-y-2">
                {links.map(link => (
                  <div key={link.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <code className="text-xs font-semibold text-foreground">{link.code}</code>
                        <p className="text-[10px] text-muted-foreground truncate">{link.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="flex gap-2 text-xs">
                          <span>{link.total_clicks} clicks</span>
                          <span>{link.total_signups} signups</span>
                          <span className="font-semibold">{link.total_conversions} conv.</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Reward: {formatBRL(link.total_reward_brl)}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { navigator.clipboard.writeText(link.url); toast.success('Copiado!'); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
