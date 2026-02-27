/**
 * /platform/security/federation/oauth-clients — OAuth2 Client Management
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { KeyRound, Plus, Search, RefreshCw, RotateCcw, Ban } from 'lucide-react';

interface OAuthClientRow {
  id: string;
  app_id: string;
  client_id_hash: string;
  grant_types: string[];
  scopes: string[];
  status: string;
  token_lifetime_seconds: number;
  last_used_at: string | null;
  created_at: string;
}

export default function FederationOAuthClients() {
  const [clients, setClients] = useState<OAuthClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    const { data } = await supabase
      .from('oauth_clients' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setClients((data as any[]) || []);
    setLoading(false);
  }

  const filtered = clients.filter(
    (c) =>
      c.client_id_hash.includes(search.toLowerCase()) ||
      c.status.includes(search.toLowerCase())
  );

  const statusColor = (s: string) => {
    if (s === 'active') return 'default';
    if (s === 'rotated') return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" />
            OAuth Clients
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Clientes OAuth2 registrados para apps do Developer Portal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadClients}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por hash ou status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm h-8"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client ID (hash)</TableHead>
                <TableHead>Grant Types</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Token TTL</TableHead>
                <TableHead>Último Uso</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum cliente OAuth encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.client_id_hash.slice(0, 16)}…</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.grant_types?.map((g) => (
                          <Badge key={g} variant="outline" className="text-[10px]">{g}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {c.scopes?.join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor(c.status) as any} className="text-xs">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{c.token_lifetime_seconds}s</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.last_used_at ? new Date(c.last_used_at).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Rotacionar">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Revogar">
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
