import { useScope } from '@/contexts/ScopeContext';
import { useTenant } from '@/contexts/TenantContext';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export function AppBreadcrumbs() {
  const { currentTenant } = useTenant();
  const { scope, resetToTenant, resetToGroup } = useScope();

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {scope.level === 'tenant' ? (
            <BreadcrumbPage>{currentTenant?.name || 'Tenant'}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink className="cursor-pointer" onClick={resetToTenant}>
              {currentTenant?.name || 'Tenant'}
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {scope.groupName && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {scope.level === 'group' ? (
                <BreadcrumbPage>{scope.groupName}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink className="cursor-pointer" onClick={resetToGroup}>
                  {scope.groupName}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </>
        )}

        {scope.companyName && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{scope.companyName}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
