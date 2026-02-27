/**
 * PlatformScimRoleMappings — Cross-tenant view of SCIM group→role mapping rules.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

interface RoleMappingRule {
  scim_group: string;
  internal_role: string;
  platform_role?: string;
}

export function PlatformScimRoleMappings() {
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['platform-scim-role-mappings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('scim_configs')
        .select('tenant_id, role_mapping_rules, sync_groups_to_roles, tenants(name)')
        .eq('sync_groups_to_roles', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground mt-4">Carregando...</p>;

  // Flatten all rules across tenants
  const allRules = configs.flatMap((c: any) => {
    const rules: RoleMappingRule[] = Array.isArray(c.role_mapping_rules) ? c.role_mapping_rules : [];
    return rules.map(r => ({ ...r, tenantName: c.tenants?.name ?? c.tenant_id }));
  });

  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Grupo SCIM</TableHead>
              <TableHead></TableHead>
              <TableHead>Tenant Role</TableHead>
              <TableHead>Platform Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allRules.map((r: any, i: number) => (
              <TableRow key={`${r.tenantName}-${i}`}>
                <TableCell className="font-medium text-sm">{r.tenantName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">{r.scim_group}</Badge>
                </TableCell>
                <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                <TableCell><Badge>{r.internal_role}</Badge></TableCell>
                <TableCell>
                  {r.platform_role ? <Badge variant="secondary">{r.platform_role}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
              </TableRow>
            ))}
            {allRules.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum mapeamento de role configurado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
