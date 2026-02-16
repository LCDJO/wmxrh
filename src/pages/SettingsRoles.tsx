/**
 * Settings > Cargos & Permissões — Roles and permission matrix page
 * Uses RolePermissionsMatrixView and AccessGraphSummaryView read models.
 */
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useRolePermissionsMatrixView, useAccessGraphSummaryView, useIAMScopeInvalidation } from '@/domains/iam/read-models';
import { RolesTab } from '@/components/iam/RolesTab';
import { AccessGraphTab } from '@/components/iam/AccessGraphTab';
import { VisualPermissionBuilder } from '@/components/iam/VisualPermissionBuilder';
import { PermissionGraphBuilder } from '@/components/iam/PermissionGraphBuilder';
import { Shield, Network, Layers, GitBranch } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsRoles() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const kernel = useSecurityKernel();
  const { isTenantAdmin, securityContext } = kernel;
  const tenantId = currentTenant?.id;

  const { roles, permissions } = useRolePermissionsMatrixView();
  const graphView = useAccessGraphSummaryView();
  const invalidateAll = useIAMScopeInvalidation();

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

      <Tabs defaultValue="builder" className="space-y-4">
        <TabsList>
          <TabsTrigger value="builder" className="gap-1.5"><Layers className="h-4 w-4" />Permission Builder</TabsTrigger>
          <TabsTrigger value="graph" className="gap-1.5"><GitBranch className="h-4 w-4" />Permission Graph</TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5"><Shield className="h-4 w-4" />Cargos</TabsTrigger>
          {isTenantAdmin && (
            <TabsTrigger value="access" className="gap-1.5"><Network className="h-4 w-4" />Access Graph</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="builder">
          <VisualPermissionBuilder
            roles={roles}
            permissions={permissions}
            tenantId={tenantId!}
            userId={user?.id}
            canEdit={isTenantAdmin}
            onInvalidate={invalidateAll}
            securityContext={securityContext}
          />
        </TabsContent>

        <TabsContent value="graph">
          <PermissionGraphBuilder
            members={graphView.members}
            assignments={graphView.assignments}
            roles={roles}
            permissions={permissions}
            tenantId={tenantId!}
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
            securityContext={securityContext}
          />
        </TabsContent>

        {isTenantAdmin && (
          <TabsContent value="access">
            <AccessGraphTab
              members={graphView.members}
              assignments={graphView.assignments}
              roles={graphView.roles}
              permissions={graphView.permissions}
              tenantId={tenantId!}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
