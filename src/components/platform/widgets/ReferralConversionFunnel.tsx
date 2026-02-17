/**
 * ReferralConversionFunnel — Funil de conversão de referrals.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Filter } from 'lucide-react';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { ReferralLink } from '@/domains/revenue-intelligence';

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export default function ReferralConversionFunnel() {
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const engine = getRevenueIntelligenceEngine();
    engine.referral.getLinks().then(d => { setLinks(d); setLoading(false); });
  }, []);

  if (loading) return <Card><CardContent className="pt-5"><Skeleton className="h-[360px] w-full" /></CardContent></Card>;

  const totalClicks = links.reduce((s, l) => s + l.total_clicks, 0);
  const totalSignups = links.reduce((s, l) => s + l.total_signups, 0);
  const totalConversions = links.reduce((s, l) => s + l.total_conversions, 0);
  const totalReward = links.reduce((s, l) => s + l.total_reward_brl, 0);

  const funnelData = [
    { stage: 'Clicks', value: totalClicks, fill: 'hsl(var(--primary))' },
    { stage: 'Signups', value: totalSignups, fill: 'hsl(var(--accent-foreground))' },
    { stage: 'Conversões', value: totalConversions, fill: 'hsl(142 76% 36%)' },
  ];

  const clickToSignup = totalClicks > 0 ? ((totalSignups / totalClicks) * 100).toFixed(1) : '0';
  const signupToConversion = totalSignups > 0 ? ((totalConversions / totalSignups) * 100).toFixed(1) : '0';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" /> Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg border border-border">
            <p className="text-lg font-bold text-foreground">{totalClicks}</p>
            <p className="text-[10px] text-muted-foreground">Clicks</p>
          </div>
          <div className="text-center p-3 rounded-lg border border-border">
            <p className="text-lg font-bold text-foreground">{totalSignups}</p>
            <p className="text-[10px] text-muted-foreground">Signups</p>
          </div>
          <div className="text-center p-3 rounded-lg border border-border">
            <p className="text-lg font-bold text-foreground">{totalConversions}</p>
            <p className="text-[10px] text-muted-foreground">Conversões</p>
          </div>
          <div className="text-center p-3 rounded-lg border border-border">
            <p className="text-lg font-bold text-foreground">{formatBRL(totalReward)}</p>
            <p className="text-[10px] text-muted-foreground">Rewards</p>
          </div>
        </div>

        {/* Conversion rates */}
        <div className="flex gap-4 justify-center">
          <Badge variant="outline" className="text-xs">Click → Signup: {clickToSignup}%</Badge>
          <Badge variant="outline" className="text-xs">Signup → Conv: {signupToConversion}%</Badge>
        </div>

        {/* Funnel chart */}
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={funnelData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis dataKey="stage" type="category" tick={{ fontSize: 12, fontWeight: 500 }} className="fill-muted-foreground" width={90} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Total">
              {funnelData.map((entry, i) => (
                <rect key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
