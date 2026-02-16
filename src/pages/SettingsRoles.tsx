/**
 * Settings > Cargos & Permissões — Roles and permission matrix page
 */
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { identityGateway } from '@/domains/iam/identity.gateway';
import { RolesTab } from '@/components/iam/RolesTab';
import { AccessGraphTab } from '@/components/iam/AccessGraphTab';
import { Shield, Network } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsRoles() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { isTenantAdmin } = useSecurityKernel();
  const qc = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data: roles = [] } = useQuery({
    queryKey: ['iam_roles', tenantId],
    queryFn: () => identityGateway.getRoles({ tenant_id: tenantId! }),
    enabled: !!tenantId,
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['iam_permissions'],
    queryFn: () => identityGateway.getAllPermissions(),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['iam_assignments', tenantId],
    queryFn: () => identityGateway.getUserAssignments({ tenant_id: tenantId! }),
    enabled: !!tenantId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['iam_members', tenantId],
    queryFn: () => identityGateway.getTenantUsers({ tenant_id: tenantId! }),
    enabled: !!tenantId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['iam_roles'] });
    qc.invalidateQueries({ queryKey: ['iam_assignments'] });
    qc.invalidateQueries({ queryKey: ['iam_members'] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Cargos & Permissões</h1>
          <p className="text-sm text-muted-foreground">Crie cargos, defina permissões e visualize o grafo de acesso.</p>
        </div>
      </div>

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles" className="gap-1.5"><Shield className="h-4 w-4" />Cargos</TabsTrigger>
          {isTenantAdmin && (
            <TabsTrigger value="graph" className="gap-1.5"><Network className="h-4 w-4" />Access Graph</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="roles">
          <RolesTab
            roles={roles}
            permissions={permissions}
            tenantId={tenantId!}
            userId={user?.id}
            isTenantAdmin={isTenantAdmin}
            onInvalidate={invalidateAll}
          />
        </TabsContent>

        {isTenantAdmin && (
          <TabsContent value="graph">
            <AccessGraphTab
              members={members}
              assignments={assignments}
              roles={roles}
              permissions={permissions}
              tenantId={tenantId!}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
