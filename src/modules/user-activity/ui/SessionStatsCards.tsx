import { Card, CardContent } from '@/components/ui/card';
import { Users, Globe, Smartphone, Monitor, Shield, Clock, Activity, MapPin } from 'lucide-react';
import type { SessionStats } from '../hooks/useActiveSessions';

interface Props { stats: SessionStats }

const cards = [
  { key: 'online', label: 'Online Agora', icon: Activity, color: 'text-emerald-500', getValue: (s: SessionStats) => s.online },
  { key: 'idle', label: 'Idle', icon: Clock, color: 'text-amber-500', getValue: (s: SessionStats) => s.idle },
  { key: 'total', label: 'Sessões (24h)', icon: Users, color: 'text-primary', getValue: (s: SessionStats) => s.total_today },
  { key: 'users', label: 'Usuários Únicos', icon: Users, color: 'text-primary', getValue: (s: SessionStats) => s.unique_users },
  { key: 'tenants', label: 'Tenants Ativos', icon: Globe, color: 'text-primary', getValue: (s: SessionStats) => s.unique_tenants },
  { key: 'countries', label: 'Países', icon: MapPin, color: 'text-primary', getValue: (s: SessionStats) => s.countries },
  { key: 'mobile', label: 'Mobile', icon: Smartphone, color: 'text-primary', getValue: (s: SessionStats) => s.mobile_sessions },
  { key: 'desktop', label: 'Desktop', icon: Monitor, color: 'text-primary', getValue: (s: SessionStats) => s.desktop_sessions },
  { key: 'vpn', label: 'VPN/Proxy', icon: Shield, color: 'text-destructive', getValue: (s: SessionStats) => s.vpn_sessions },
  { key: 'avg', label: 'Duração Média (min)', icon: Clock, color: 'text-primary', getValue: (s: SessionStats) => s.avg_duration_min },
] as const;

export function SessionStatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <Card key={c.key} className="border-border/40">
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${c.color} shrink-0`} />
              <div>
                <div className="text-xl font-bold text-foreground">{c.getValue(stats)}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
