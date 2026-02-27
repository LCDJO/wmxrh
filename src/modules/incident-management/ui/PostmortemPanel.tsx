/**
 * PostmortemPanel — Lists postmortems and their status.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const statusLabel: Record<string, string> = {
  draft: 'Rascunho',
  review: 'Em Revisão',
  published: 'Publicado',
};

export function PostmortemPanel() {
  const { data: postmortems = [], isLoading } = useQuery({
    queryKey: ['incident-postmortems'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('incident_postmortems')
        .select('*, incidents(title, severity)')
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Incidente</TableHead>
              <TableHead>Resumo</TableHead>
              <TableHead>Duração Impacto</TableHead>
              <TableHead>Usuários Afetados</TableHead>
              <TableHead>Ações</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {postmortems.map((pm: any) => (
              <TableRow key={pm.id}>
                <TableCell className="text-sm font-medium max-w-[200px] truncate">
                  {pm.incidents?.title ?? '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {pm.summary}
                </TableCell>
                <TableCell className="text-xs">
                  {pm.impact_duration_minutes ? `${pm.impact_duration_minutes}m` : '—'}
                </TableCell>
                <TableCell className="text-xs">{pm.affected_users_count ?? '—'}</TableCell>
                <TableCell className="text-xs">
                  {Array.isArray(pm.action_items) ? pm.action_items.length : 0}
                </TableCell>
                <TableCell>
                  <Badge variant={pm.status === 'published' ? 'default' : 'secondary'}>
                    {statusLabel[pm.status] ?? pm.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && postmortems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum postmortem registrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
