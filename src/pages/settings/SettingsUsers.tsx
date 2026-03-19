/**
 * Settings > Usuários — User management page
 * Uses TenantUserListView read model for scope-aware queries.
 */
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useTenantUserListView, useRolePermissionsMatrixView, useIAMScopeInvalidation } from '@/domains/iam/read-models';
import { UsersTab } from '@/components/iam/UsersTab';
import { Users } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';

export default function SettingsUsers() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { isTenantAdmin } = useSecurityKernel();
  const tenantId = currentTenant?.id;

  const { filteredMembers, filteredAssignments } = useTenantUserListView();
  const { roles } = useRolePermissionsMatrixView();
  const invalidateAll = useIAMScopeInvalidation();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie membros, convites e atribuições de cargos.</p>
        </div>
      </div>

      <UsersTab
        members={filteredMembers}
        assignments={filteredAssignments}
        roles={roles}
        tenantId={tenantId!}
        userId={user?.id}
        isTenantAdmin={isTenantAdmin}
        onInvalidate={invalidateAll}
      />
    </div>
  );
}
