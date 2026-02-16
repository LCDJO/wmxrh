/**
 * Settings > Usuários — User management page
 */
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { identityGateway } from '@/domains/iam/identity.gateway';
import { UsersTab } from '@/components/iam/UsersTab';
import { Users, Settings } from 'lucide-react';

export default function SettingsUsers() {
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
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie membros, convites e atribuições de cargos.</p>
        </div>
      </div>

      <UsersTab
        members={members}
        assignments={assignments}
        roles={roles}
        tenantId={tenantId!}
        userId={user?.id}
        isTenantAdmin={isTenantAdmin}
        onInvalidate={invalidateAll}
      />
    </div>
  );
}
