/**
 * AccessRelationshipPanel — Detailed access relationship inspector.
 *
 * READ-ONLY: Consumes UGE query APIs, never mutates permissions.
 * All authorization decisions remain in the SecurityKernel.
 *
 * Three modes via `mode` prop:
 *   - "user"       → Shows a user's full access map (roles, permissions, scopes, tenants)
 *   - "tenant"     → Shows tenant-wide access overview (users, roles, modules)
 *   - "permission" → Shows permission usage (which roles grant it, which users have it)
 */
import { useMemo, useState } from 'react';
import { Users, Building2, ShieldCheck, KeyRound, ChevronDown, ChevronRight, Package, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { unifiedGraphEngine } from '@/domains/security/kernel/unified-graph-engine';
import type {
  UserAccessMap,
  TenantAccessOverview,
  PermissionUsage,
  GraphDomain,
} from '@/domains/security/kernel/unified-graph-engine';
import type { UnifiedNode } from '@/domains/security/kernel/unified-graph-engine';

// ════════════════════════════════════
// DOMAIN BADGE CONFIG
// ════════════════════════════════════

const DOMAIN_BADGE: Record<GraphDomain, string> = {
  platform_access: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  tenant_access: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  permission: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  module_access: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  identity: 'bg-red-500/15 text-red-400 border-red-500/30',
};

// ════════════════════════════════════
// PROPS
// ════════════════════════════════════

interface UserModeProps {
  mode: 'user';
  userId: string;
}

interface TenantModeProps {
  mode: 'tenant';
  tenantId: string;
}

interface PermissionModeProps {
  mode: 'permission';
  resource: string;
}

export type AccessRelationshipPanelProps = (UserModeProps | TenantModeProps | PermissionModeProps) & {
  className?: string;
  maxHeight?: number;
};

// ════════════════════════════════════
// COMPONENT
// ════════════════════════════════════

export function AccessRelationshipPanel(props: AccessRelationshipPanelProps) {
  const { mode, className, maxHeight = 480 } = props;

  const snapshot = useMemo(() => {
    try { return unifiedGraphEngine.compose(); } catch { return null; }
  }, []);

  if (!snapshot) {
    return (
      <Card className={`border-border/50 ${className ?? ''}`}>
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          Grafo unificado indisponível.
        </CardContent>
      </Card>
    );
  }

  if (mode === 'user') return <UserPanel userId={props.userId} snapshot={snapshot} maxHeight={maxHeight} className={className} />;
  if (mode === 'tenant') return <TenantPanel tenantId={props.tenantId} snapshot={snapshot} maxHeight={maxHeight} className={className} />;
  return <PermissionPanel resource={props.resource} snapshot={snapshot} maxHeight={maxHeight} className={className} />;
}

// ════════════════════════════════════
// USER PANEL
// ════════════════════════════════════

function UserPanel({ userId, snapshot, maxHeight, className }: { userId: string; snapshot: any; maxHeight: number; className?: string }) {
  const data: UserAccessMap = useMemo(
    () => unifiedGraphEngine.getUserAccessMap(snapshot, userId),
    [snapshot, userId],
  );

  return (
    <Card className={`border-border/50 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Mapa de Acesso
        </CardTitle>
        <CardDescription className="text-xs">
          {data.roles.length} cargo(s) · {data.totalPermissions} permissão(ões) · {data.tenants.length} tenant(s)
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea style={{ maxHeight }}>
          <div className="space-y-3">
            {/* Roles */}
            <CollapsibleSection title="Cargos" icon={<KeyRound className="h-3 w-3" />} count={data.roles.length} defaultOpen>
              {data.roles.map(({ role, domain, permissions }) => (
                <div key={role.uid} className="pl-4 py-1.5 border-l border-border/50">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">{role.label}</span>
                    <Badge variant="outline" className={`text-[8px] px-1 py-0 ${DOMAIN_BADGE[domain]}`}>
                      {domain.replace('_', ' ')}
                    </Badge>
                  </div>
                  {permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {permissions.slice(0, 8).map(p => (
                        <Badge key={p.uid} variant="outline" className="text-[9px] px-1 py-0 bg-muted/30 text-muted-foreground border-border/50">
                          {p.label}
                        </Badge>
                      ))}
                      {permissions.length > 8 && (
                        <span className="text-[9px] text-muted-foreground">+{permissions.length - 8}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CollapsibleSection>

            {/* Tenants */}
            <CollapsibleSection title="Tenants" icon={<Building2 className="h-3 w-3" />} count={data.tenants.length}>
              {data.tenants.map(t => (
                <NodeRow key={t.uid} node={t} />
              ))}
            </CollapsibleSection>

            {/* Scopes */}
            <CollapsibleSection title="Escopos" icon={<Target className="h-3 w-3" />} count={data.scopes.length}>
              {data.scopes.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 pl-4 py-0.5 text-[11px]">
                  <Badge variant="outline" className="text-[8px] px-1 py-0">{s.type}</Badge>
                  <span className="text-foreground">{s.node.label}</span>
                </div>
              ))}
            </CollapsibleSection>

            {/* Impersonation */}
            {data.impersonating.length > 0 && (
              <CollapsibleSection title="Impersonando" icon={<Users className="h-3 w-3" />} count={data.impersonating.length}>
                {data.impersonating.map(n => <NodeRow key={n.uid} node={n} />)}
              </CollapsibleSection>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════
// TENANT PANEL
// ════════════════════════════════════

function TenantPanel({ tenantId, snapshot, maxHeight, className }: { tenantId: string; snapshot: any; maxHeight: number; className?: string }) {
  const data: TenantAccessOverview = useMemo(
    () => unifiedGraphEngine.getTenantAccessOverview(snapshot, tenantId),
    [snapshot, tenantId],
  );

  return (
    <Card className={`border-border/50 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          Visão do Tenant
        </CardTitle>
        <CardDescription className="text-xs">
          {data.stats.totalUsers} usuário(s) · {data.stats.totalRoles} cargo(s) · {data.stats.totalPermissions} perm · {data.stats.totalModules} módulo(s)
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea style={{ maxHeight }}>
          <div className="space-y-3">
            {/* Users */}
            <CollapsibleSection title="Usuários" icon={<Users className="h-3 w-3" />} count={data.users.length} defaultOpen>
              {data.users.map(({ user, roles, permissionCount }) => (
                <div key={user.uid} className="pl-4 py-1.5 border-l border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{user.label}</span>
                    <span className="text-[10px] text-muted-foreground">{permissionCount} perms</span>
                  </div>
                  {roles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {roles.map(r => (
                        <Badge key={r.uid} variant="outline" className="text-[9px] px-1 py-0 bg-muted/30 text-muted-foreground border-border/50">
                          {r.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CollapsibleSection>

            {/* Modules */}
            {data.modules.length > 0 && (
              <CollapsibleSection title="Módulos" icon={<Package className="h-3 w-3" />} count={data.modules.length}>
                {data.modules.map(m => <NodeRow key={m.uid} node={m} />)}
              </CollapsibleSection>
            )}

            {/* Roles */}
            <CollapsibleSection title="Cargos" icon={<KeyRound className="h-3 w-3" />} count={data.roles.length}>
              {data.roles.map(r => <NodeRow key={r.uid} node={r} />)}
            </CollapsibleSection>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════
// PERMISSION PANEL
// ════════════════════════════════════

function PermissionPanel({ resource, snapshot, maxHeight, className }: { resource: string; snapshot: any; maxHeight: number; className?: string }) {
  const data: PermissionUsage = useMemo(
    () => unifiedGraphEngine.getPermissionUsage(snapshot, resource),
    [snapshot, resource],
  );

  return (
    <Card className={`border-border/50 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Uso da Permissão
        </CardTitle>
        <CardDescription className="text-xs">
          {data.permissionNode?.label ?? resource} — {data.stats.totalRolesGranting} cargo(s) · {data.stats.totalUsersWithAccess} usuário(s)
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea style={{ maxHeight }}>
          <div className="space-y-3">
            {/* Granting roles */}
            <CollapsibleSection title="Concedida por" icon={<KeyRound className="h-3 w-3" />} count={data.grantedBy.length} defaultOpen>
              {data.grantedBy.map(({ role, domain }) => (
                <div key={role.uid} className="flex items-center gap-1.5 pl-4 py-0.5 text-[11px]">
                  <span className="text-foreground font-medium">{role.label}</span>
                  <Badge variant="outline" className={`text-[8px] px-1 py-0 ${DOMAIN_BADGE[domain]}`}>
                    {domain.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </CollapsibleSection>

            {/* Users with access */}
            <CollapsibleSection title="Usuários com acesso" icon={<Users className="h-3 w-3" />} count={data.usersWithAccess.length}>
              {data.usersWithAccess.map(({ user, viaRole }) => (
                <div key={user.uid} className="flex items-center gap-1.5 pl-4 py-0.5 text-[11px]">
                  <span className="text-foreground">{user.label}</span>
                  <span className="text-muted-foreground">via</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-muted/30 text-muted-foreground border-border/50">
                    {viaRole.label}
                  </Badge>
                </div>
              ))}
            </CollapsibleSection>

            {!data.permissionNode && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Permissão "{resource}" não encontrada no grafo.
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════
// SHARED SUB-COMPONENTS
// ════════════════════════════════════

function CollapsibleSection({
  title, icon, count, defaultOpen = false, children,
}: {
  title: string; icon: React.ReactNode; count: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-[11px] font-semibold text-foreground hover:text-primary transition-colors py-0.5">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {icon}
        <span>{title}</span>
        <span className="text-muted-foreground font-normal ml-1">({count})</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-0.5">
        {count === 0 ? (
          <p className="text-[10px] text-muted-foreground pl-4">Nenhum item.</p>
        ) : children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function NodeRow({ node }: { node: UnifiedNode }) {
  return (
    <div className="flex items-center gap-1.5 pl-4 py-0.5 text-[11px]">
      <span className="text-foreground">{node.label}</span>
      <Badge variant="outline" className={`text-[8px] px-1 py-0 ${DOMAIN_BADGE[node.domain]}`}>
        {node.type.replace(/_/g, ' ')}
      </Badge>
    </div>
  );
}
