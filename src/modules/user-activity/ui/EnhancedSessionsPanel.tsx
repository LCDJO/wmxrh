/**
 * Enhanced ActiveSessionsPanel — Full session table with advanced filters,
 * remote logout, session blocking, and risk score display.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Monitor, Smartphone, Tablet, Globe, Shield, Search, Clock, Ban, LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { blockSession, remoteLogout } from '../engine/session-events';
import { toast } from 'sonner';
import type { SessionRecord } from '../hooks/useActiveSessions';

const statusColors: Record<string, string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-500',
  offline: 'bg-muted-foreground/40',
  expired: 'bg-destructive/60',
};

const riskBadge = (score: number) => {
  if (score >= 60) return <Badge variant="destructive" className="text-[8px] h-4">Risco Alto ({score})</Badge>;
  if (score >= 30) return <Badge variant="secondary" className="text-[8px] h-4">Atenção ({score})</Badge>;
  return <Badge variant="outline" className="text-[8px] h-4">Normal ({score})</Badge>;
};

const deviceIcons: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

interface Props {
  sessions: SessionRecord[];
  onRefresh?: () => void;
}

export function EnhancedSessionsPanel({ sessions, onRefresh }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [browserFilter, setBrowserFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState('all');

  // Unique filter values
  const countries = [...new Set(sessions.filter(s => s.country).map(s => s.country!))].sort();
  const browsers = [...new Set(sessions.filter(s => s.browser).map(s => s.browser!))].sort();
  const tenants = [...new Set(sessions.filter(s => s.tenant_name).map(s => s.tenant_name!))].sort();

  const filtered = sessions.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (countryFilter !== 'all' && s.country !== countryFilter) return false;
    if (browserFilter !== 'all' && s.browser !== browserFilter) return false;
    if (tenantFilter !== 'all' && s.tenant_name !== tenantFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.ip_address?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.user_id.toLowerCase().includes(q) ||
        s.tenant_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleBlock = async (session: SessionRecord) => {
    if (!user) return;
    const ok = await blockSession(session.id, user.id, 'Blocked by platform admin');
    if (ok) { toast.success('Sessão bloqueada'); onRefresh?.(); }
    else toast.error('Falha ao bloquear');
  };

  const handleLogout = async (session: SessionRecord) => {
    if (!user) return;
    const ok = await remoteLogout(session.id, user.id);
    if (ok) { toast.success('Logout remoto executado'); onRefresh?.(); }
    else toast.error('Falha no logout');
  };

  const formatDuration = (s: SessionRecord) => {
    const elapsed = Math.round((Date.now() - new Date(s.login_at).getTime()) / 60000);
    if (elapsed < 60) return `${elapsed}m`;
    return `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" /> Sessões
          <Badge variant="secondary" className="text-xs ml-auto">{filtered.length}</Badge>
        </CardTitle>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="IP, cidade, user..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="idle">Idle</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Tenant" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tenant</SelectItem>
              {tenants.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="País" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">País</SelectItem>
              {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={browserFilter} onValueChange={setBrowserFilter}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Browser" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Browser</SelectItem>
              {browsers.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow className="text-[10px]">
                <TableHead className="w-8"></TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Cidade / País</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Navegador</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma sessão encontrada
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(s => {
                const DevIcon = deviceIcons[s.device_type ?? 'desktop'] ?? Monitor;
                const risk = (s as any).risk_score ?? 0;
                return (
                  <TableRow key={s.id} className="text-[11px]">
                    <TableCell><span className={`h-2 w-2 rounded-full inline-block ${statusColors[s.status]}`} /></TableCell>
                    <TableCell className="font-medium truncate max-w-[120px]">{s.tenant_name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{s.user_id.slice(0, 8)}</TableCell>
                    <TableCell>{[s.city, s.country].filter(Boolean).join(', ') || '—'}</TableCell>
                    <TableCell className="font-mono text-[10px]">{s.ip_address ?? '—'}</TableCell>
                    <TableCell>{s.browser} {s.browser_version?.split('.')[0]}</TableCell>
                    <TableCell><DevIcon className="h-3.5 w-3.5 text-muted-foreground inline" /> {s.device_type}</TableCell>
                    <TableCell className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5 text-muted-foreground" /> {formatDuration(s)}</TableCell>
                    <TableCell>{riskBadge(risk)}</TableCell>
                    <TableCell>
                      {(s.status === 'online' || s.status === 'idle') && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleLogout(s)} title="Logout Remoto">
                            <LogOut className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => handleBlock(s)} title="Bloquear">
                            <Ban className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
