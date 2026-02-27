/**
 * /platform/security/federation/identity-providers — IdP management
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Users, Plus, Search, Shield, Globe, RefreshCw } from 'lucide-react';

interface IdPRow {
  id: string;
  name: string;
  protocol: string;
  status: string;
  tenant_id: string;
  is_primary: boolean;
  allowed_domains: string[];
  created_at: string;
}

export default function FederationIdentityProviders() {
  const [idps, setIdps] = useState<IdPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadIdPs();
  }, []);

  async function loadIdPs() {
    setLoading(true);
    const { data } = await supabase
      .from('federation_identity_providers' as any)
      .select('id, name, protocol, status, tenant_id, is_primary, allowed_domains, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    setIdps((data as any[]) || []);
    setLoading(false);
  }

  const filtered = idps.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.protocol.toLowerCase().includes(search.toLowerCase())
  );

  const protocolIcon = (p: string) => {
    if (p === 'saml') return <Shield className="h-3.5 w-3.5" />;
    return <Globe className="h-3.5 w-3.5" />;
  };

  const statusColor = (s: string) => {
    if (s === 'active') return 'default';
    if (s === 'draft') return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Identity Providers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Provedores de identidade SAML 2.0 e OIDC federados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadIdPs}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo IdP
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou protocolo..."
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
                <TableHead>Nome</TableHead>
                <TableHead>Protocolo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Domínios</TableHead>
                <TableHead>Primário</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum provedor encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((idp) => (
                  <TableRow key={idp.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{idp.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 text-xs">
                        {protocolIcon(idp.protocol)}
                        {idp.protocol.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor(idp.status) as any} className="text-xs">
                        {idp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {idp.allowed_domains?.join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      {idp.is_primary && <Badge variant="default" className="text-xs">Primário</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(idp.created_at).toLocaleDateString('pt-BR')}
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
