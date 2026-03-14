import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Monitor, Smartphone, Tablet, Globe, Shield, Search, Clock,
} from 'lucide-react';
import type { SessionRecord } from '../hooks/useActiveSessions';

const statusColors: Record<string, string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-500',
  offline: 'bg-muted-foreground/40',
  expired: 'bg-destructive/60',
};

const deviceIcons: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

interface Props { sessions: SessionRecord[] }

export function ActiveSessionsPanel({ sessions }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = sessions.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.ip_address?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.country?.toLowerCase().includes(q) ||
        s.browser?.toLowerCase().includes(q) ||
        s.tenant_name?.toLowerCase().includes(q) ||
        s.user_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" /> Sessões Ativas
          <Badge variant="secondary" className="ml-auto text-xs">{filtered.length}</Badge>
        </CardTitle>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar IP, cidade, tenant..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="idle">Idle</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[420px]">
          <div className="divide-y divide-border/30">
            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-12">Nenhuma sessão encontrada</div>
            )}
            {filtered.map(s => {
              const DevIcon = deviceIcons[s.device_type ?? 'desktop'] ?? Monitor;
              const elapsed = Math.round((Date.now() - new Date(s.last_activity).getTime()) / 60000);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                  {/* Status dot */}
                  <span className={`h-2 w-2 rounded-full shrink-0 ${statusColors[s.status] ?? statusColors.offline}`} />
                  {/* Device */}
                  <DevIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium text-foreground truncate">
                        {s.tenant_name ?? 'Sem Tenant'}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground font-mono text-[10px] truncate">{s.user_id.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>{s.browser} {s.browser_version?.split('.')[0]}</span>
                      <span>•</span>
                      <span>{s.os}</span>
                      <span>•</span>
                      <span>{s.ip_address ?? '—'}</span>
                    </div>
                  </div>
                  {/* Location */}
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-foreground">
                      {[s.city, s.state, s.country].filter(Boolean).join(', ') || '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="h-2.5 w-2.5" />
                      {elapsed < 1 ? 'agora' : `${elapsed}m atrás`}
                    </div>
                  </div>
                  {/* Flags */}
                  <div className="flex gap-1 shrink-0">
                    {s.is_vpn && <Badge variant="destructive" className="text-[8px] h-4 px-1">VPN</Badge>}
                    {s.is_proxy && <Badge variant="outline" className="text-[8px] h-4 px-1">Proxy</Badge>}
                    {s.sso_provider && <Badge variant="secondary" className="text-[8px] h-4 px-1">SSO</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
