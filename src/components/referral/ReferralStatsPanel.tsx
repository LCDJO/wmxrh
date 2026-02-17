/**
 * ReferralStatsPanel — Estatísticas das indicações do usuário.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users, MousePointerClick, ArrowRightLeft, DollarSign } from 'lucide-react';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { ReferralLink } from '@/domains/revenue-intelligence';
import { useAuth } from '@/contexts/AuthContext';

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export default function ReferralStatsPanel() {
  const { user } = useAuth();
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const engine = getRevenueIntelligenceEngine();
    engine.referral.getLinks(user.id).then(l => { setLinks(l); setLoading(false); });
  }, [user?.id]);

  if (loading) return <Card><CardContent className="pt-5"><Skeleton className="h-28 w-full" /></CardContent></Card>;

  const totalClicks = links.reduce((s, l) => s + l.total_clicks, 0);
  const totalSignups = links.reduce((s, l) => s + l.total_signups, 0);
  const totalConversions = links.reduce((s, l) => s + l.total_conversions, 0);
  const totalReward = links.reduce((s, l) => s + l.total_reward_brl, 0);

  const stats = [
    { icon: MousePointerClick, label: 'Clicks', value: String(totalClicks), color: 'text-primary' },
    { icon: Users, label: 'Cadastros', value: String(totalSignups), color: 'text-blue-500' },
    { icon: ArrowRightLeft, label: 'Conversões', value: String(totalConversions), color: 'text-emerald-500' },
    { icon: DollarSign, label: 'Ganhos', value: formatBRL(totalReward), color: 'text-amber-500' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display">Suas Indicações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="text-center p-3 rounded-lg border border-border">
              <s.icon className={`h-5 w-5 mx-auto mb-1.5 ${s.color}`} />
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        {totalConversions > 0 && (
          <div className="mt-3 flex justify-center">
            <Badge variant="outline" className="text-xs">
              Taxa de conversão: {totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : 0}%
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
