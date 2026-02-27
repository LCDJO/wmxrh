/**
 * IncidentListPanel — Displays all incidents with severity, SLA status, escalation level.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

const sevColors: Record<string, string> = {
  sev1: 'bg-destructive/10 text-destructive border-destructive/20',
  sev2: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  sev3: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  sev4: 'bg-muted text-muted-foreground border-border',
};

const statusLabels: Record<string, string> = {
  open: 'Aberto',
  investigating: 'Investigando',
  mitigated: 'Mitigado',
  resolved: 'Resolvido',
};

export function IncidentListPanel() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [sevFilter, setSevFilter] = useState('all');

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['platform-incidents', statusFilter, sevFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (sevFilter !== 'all') query = query.eq('severity', sevFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="open">Aberto</SelectItem>
            <SelectItem value="investigating">Investigando</SelectItem>
            <SelectItem value="mitigated">Mitigado</SelectItem>
            <SelectItem value="resolved">Resolvido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sevFilter} onValueChange={setSevFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Sev</SelectItem>
            <SelectItem value="sev1">SEV1</SelectItem>
            <SelectItem value="sev2">SEV2</SelectItem>
            <SelectItem value="sev3">SEV3</SelectItem>
            <SelectItem value="sev4">SEV4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severidade</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Escalação</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((inc: any) => (
                <TableRow key={inc.id}>
                  <TableCell>
                    <Badge variant="outline" className={sevColors[inc.severity] ?? ''}>
                      {inc.severity?.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm max-w-[250px] truncate">{inc.title}</TableCell>
                  <TableCell>
                    <Badge variant={inc.status === 'resolved' ? 'default' : 'secondary'}>
                      {statusLabels[inc.status] ?? inc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{inc.escalation_level?.toUpperCase()}</TableCell>
                  <TableCell>
                    {inc.sla_breached ? (
                      <Badge variant="destructive" className="text-[10px]">VIOLADO</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/20">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(inc.affected_modules ?? []).slice(0, 3).map((m: string) => (
                        <Badge key={m} variant="outline" className="text-[9px]">{m}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(inc.created_at).toLocaleString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && incidents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum incidente encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
