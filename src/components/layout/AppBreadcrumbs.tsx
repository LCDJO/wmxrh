/**
 * App Breadcrumbs
 * 
 * Renders scope hierarchy from SecurityKernel's ScopeResolver.
 * Shows: Tenant > Group > Company based on current SecurityContext scope.
 */

import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Building2, Layers, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppBreadcrumbs() {
  const { currentTenant } = useTenant();
  const { scope, resetToTenant, resetToGroup } = useScope();
  const { securityContext } = useSecurityKernel();

  // Use ScopeResolution from SecurityContext when available
  const scopeResolution = securityContext?.meta?.scopeResolution;
  const effectiveLevel = scopeResolution?.effectiveLevel || 'tenant';
  const hasTenantScope = scopeResolution?.hasTenantScope ?? true;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Tenant level */}
        <BreadcrumbItem>
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            {scope.level === 'tenant' ? (
              <BreadcrumbPage>{currentTenant?.name || 'Tenant'}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink className="cursor-pointer" onClick={resetToTenant}>
                {currentTenant?.name || 'Tenant'}
              </BreadcrumbLink>
            )}
          </div>
        </BreadcrumbItem>

        {/* Group level */}
        {scope.groupName && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                {scope.level === 'group' ? (
                  <BreadcrumbPage>{scope.groupName}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink className="cursor-pointer" onClick={resetToGroup}>
                    {scope.groupName}
                  </BreadcrumbLink>
                )}
              </div>
            </BreadcrumbItem>
          </>
        )}

        {/* Company level */}
        {scope.companyName && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <BreadcrumbPage>{scope.companyName}</BreadcrumbPage>
              </div>
            </BreadcrumbItem>
          </>
        )}

        {/* Scope indicator badge */}
        {!hasTenantScope && (
          <BreadcrumbItem>
            <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground uppercase">
              escopo limitado
            </span>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
