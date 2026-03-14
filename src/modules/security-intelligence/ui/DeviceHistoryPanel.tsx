/**
 * DeviceHistoryPanel — Shows registered devices with trust management.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Monitor, Smartphone, Tablet, Shield, ShieldCheck, ShieldX, Search, Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { markDeviceTrusted, markDeviceUntrusted } from '../engine/security-intelligence-engine';
import { toast } from 'sonner';
import type { UserDeviceRecord } from '../hooks/useUserDevices';

interface Props {
  devices: UserDeviceRecord[];
  onRefresh: () => void;
}

const deviceIcons: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

export function DeviceHistoryPanel({ devices, onRefresh }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = devices.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.device_name?.toLowerCase().includes(q) ||
      d.browser?.toLowerCase().includes(q) ||
      d.os?.toLowerCase().includes(q) ||
      d.user_id.toLowerCase().includes(q) ||
      d.device_fingerprint.toLowerCase().includes(q);
  });

  const handleToggleTrust = async (device: UserDeviceRecord) => {
    if (!user) return;
    setLoadingId(device.id);
    try {
      if (device.trusted) {
        await markDeviceUntrusted(device.id);
        toast.success('Dispositivo removido da lista confiável');
      } else {
        await markDeviceTrusted(device.id, user.id);
        toast.success('Dispositivo marcado como confiável');
      }
      onRefresh();
    } catch {
      toast.error('Erro ao atualizar dispositivo');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Dispositivos Registrados
          <Badge variant="secondary" className="text-xs ml-auto">{filtered.length}</Badge>
        </CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar dispositivo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow className="text-[10px]">
                <TableHead>Dispositivo</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Navegador / OS</TableHead>
                <TableHead>Países</TableHead>
                <TableHead>Logins</TableHead>
                <TableHead>Primeira vez</TableHead>
                <TableHead>Última vez</TableHead>
                <TableHead>Confiável</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum dispositivo encontrado
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(d => {
                const DevIcon = deviceIcons[d.device_type ?? 'desktop'] ?? Monitor;
                return (
                  <TableRow key={d.id} className="text-[11px]">
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <DevIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{d.device_name ?? d.device_type ?? '—'}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-mono">{d.device_fingerprint.slice(0, 12)}</span>
                    </TableCell>
                    <TableCell className="font-mono text-[10px]">{d.user_id.slice(0, 8)}</TableCell>
                    <TableCell>{d.browser} / {d.os}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-0.5">
                        {(d.countries ?? []).slice(0, 3).map(c => (
                          <Badge key={c} variant="outline" className="text-[8px] h-4 px-1">{c}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{d.login_count}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      {new Date(d.first_seen).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(d.last_seen).toLocaleDateString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {d.trusted ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ShieldX className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={d.trusted ? 'outline' : 'secondary'}
                        className="h-5 text-[9px] px-2"
                        disabled={loadingId === d.id}
                        onClick={() => handleToggleTrust(d)}
                      >
                        {d.trusted ? 'Remover' : 'Confiar'}
                      </Button>
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
