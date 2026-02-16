/**
 * IAM Management — Users, Roles, Access Graph
 */
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { iamService } from '@/domains/iam/iam.service';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Network } from 'lucide-react';
import { UsersTab } from '@/components/iam/UsersTab';
import { RolesTab } from '@/components/iam/RolesTab';
import { AccessGraphTab } from '@/components/iam/AccessGraphTab';

export default function IAMManagement() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { isTenantAdmin } = useSecurityKernel();
  const qc = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data: roles = [] } = useQuery({
    queryKey: ['iam_roles', tenantId],
    queryFn: () => iamService.listRoles(tenantId!),
    enabled: !!tenantId,
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['iam_permissions'],
    queryFn: () => iamService.listPermissions(),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['iam_assignments', tenantId],
    queryFn: () => iamService.listUserAssignments(tenantId!),
    enabled: !!tenantId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['iam_members', tenantId],
    queryFn: () => iamService.listTenantMembers(tenantId!),
    enabled: !!tenantId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['iam_roles'] });
    qc.invalidateQueries({ queryKey: ['iam_assignments'] });
    qc.invalidateQueries({ queryKey: ['iam_members'] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Gestão de Acesso (IAM)</h1>
        <p className="text-muted-foreground mt-1">Gerencie usuários, cargos, permissões e escopos.</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" />Usuários</TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5"><Shield className="h-4 w-4" />Cargos</TabsTrigger>
          {isTenantAdmin && (
            <TabsTrigger value="graph" className="gap-1.5"><Network className="h-4 w-4" />Access Graph</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="users">
          <UsersTab
            members={members}
            assignments={assignments}
            roles={roles}
            tenantId={tenantId!}
            userId={user?.id}
            isTenantAdmin={isTenantAdmin}
            onInvalidate={invalidateAll}
          />
        </TabsContent>

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
