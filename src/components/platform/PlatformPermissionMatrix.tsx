/**
 * PlatformPermissionMatrix — Visually distinct permission matrix for Platform mode.
 * Purple-accented design system with "Modo Plataforma" badge.
 */
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PlatformRole, PlatformPermissionDef, PlatformRolePermission } from '@/pages/platform/PlatformSecurity';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Shield, Lock, Eye, Headphones, Wallet, Settings,
  Search, Loader2, Zap, CheckCircle, XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ROLE_META: Record<string, { icon: typeof Shield; accent: string }> = {
  platform_super_admin: { icon: Lock, accent: 'text-destructive' },
  platform_operations: { icon: Settings, accent: 'text-[hsl(265_80%_55%)]' },
  platform_support: { icon: Headphones, accent: 'text-info' },
  platform_finance: { icon: Wallet, accent: 'text-warning' },
  platform_fiscal: { icon: Shield, accent: 'text-accent-foreground' },
  platform_read_only: { icon: Eye, accent: 'text-muted-foreground' },
};

const MODULE_LABELS: Record<string, string> = {
  tenants: 'Tenants', modulos: 'Módulos', auditoria: 'Auditoria',
  financeiro: 'Financeiro', fiscal: 'Fiscal', suporte: 'Suporte',
  usuarios: 'Usuários', seguranca: 'Segurança',
};

interface Props {
  roles: PlatformRole[];
  permissions: PlatformPermissionDef[];
  rolePerms: PlatformRolePermission[];
  isSuperAdmin: boolean;
  onRefresh: () => void;
}

export function PlatformPermissionMatrix({ roles, permissions, rolePerms, isSuperAdmin, onRefresh }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  // Build lookup: roleId → Set<permId>
  const rolePermMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rolePerms.forEach(rp => {
      if (!map.has(rp.role_id)) map.set(rp.role_id, new Set());
      map.get(rp.role_id)!.add(rp.permission_id);
    });
    return map;
  }, [rolePerms]);

  // Group permissions by module, filtered by search
  const groupedPerms = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = permissions.filter(
      p => p.code.toLowerCase().includes(q) || p.module.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
    );
    const map = new Map<string, PlatformPermissionDef[]>();
    filtered.forEach(p => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return map;
  }, [permissions, search]);

  const handleToggle = async (roleId: string, permId: string, currently: boolean, roleSlug: string) => {
    if (!isSuperAdmin || roleSlug === 'platform_super_admin') return;
    setToggling(`${roleId}-${permId}`);

    if (currently) {
      const { error } = await supabase
        .from('platform_role_permissions')
        .delete()
        .eq('role_id', roleId)
        .eq('permission_id', permId);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const { error } = await supabase
        .from('platform_role_permissions')
        .insert({ role_id: roleId, permission_id: permId, role: roleSlug } as any);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }

    setToggling(null);
    onRefresh();
  };

  // Stats
  const totalGrants = rolePerms.length;
  const maxGrants = roles.length * permissions.length;
  const coverage = maxGrants > 0 ? Math.round((totalGrants / maxGrants) * 100) : 0;

  return (
    <Card className="shadow-platform border-platform overflow-hidden">
      {/* Platform Header */}
      <CardHeader className="pb-3 gradient-platform-surface">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-platform-accent">
              <Shield className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-display">Permission Matrix</CardTitle>
              <CardDescription>
                {isSuperAdmin ? 'Clique nas células para ativar/desativar permissões.' : 'Visualização — somente Super Admins podem editar.'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(265_60%_50%/0.08)] border border-[hsl(265_60%_50%/0.15)]">
              <div className="h-2 w-2 rounded-full bg-[hsl(265_80%_55%)] animate-pulse" />
              <span className="text-[10px] font-semibold text-[hsl(265_60%_45%)] uppercase tracking-wider">
                Modo Plataforma
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] gap-1">
              {coverage}% coverage
            </Badge>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-xs mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filtrar permissões..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider sticky left-0 bg-muted/30 z-10 min-w-[200px]">
                  Permissão
                </th>
                {roles.map(role => {
                  const meta = ROLE_META[role.slug] ?? { icon: Shield, accent: 'text-muted-foreground' };
                  const Icon = meta.icon;
                  const permCount = rolePermMap.get(role.id)?.size ?? 0;
                  return (
                    <th key={role.id} className="text-center px-3 py-3 min-w-[100px]">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', 
                          role.slug === 'platform_super_admin' ? 'bg-destructive/10' : 'bg-[hsl(265_60%_50%/0.08)]'
                        )}>
                          <Icon className={cn('h-3.5 w-3.5', meta.accent)} />
                        </div>
                        <span className="font-semibold text-foreground text-[10px] leading-tight">{role.name}</span>
                        <span className="text-[9px] text-muted-foreground">{permCount} perms</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from(groupedPerms.entries()).map(([module, perms]) => (
                <ModuleGroup
                  key={module}
                  module={module}
                  perms={perms}
                  roles={roles}
                  rolePermMap={rolePermMap}
                  isSuperAdmin={isSuperAdmin}
                  toggling={toggling}
                  onToggle={handleToggle}
                />
              ))}
            </tbody>
          </table>

          {groupedPerms.size === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma permissão encontrada.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Module Group sub-component ──────────────────────────────────

function ModuleGroup({
  module, perms, roles, rolePermMap, isSuperAdmin, toggling, onToggle,
}: {
  module: string;
  perms: PlatformPermissionDef[];
  roles: PlatformRole[];
  rolePermMap: Map<string, Set<string>>;
  isSuperAdmin: boolean;
  toggling: string | null;
  onToggle: (roleId: string, permId: string, has: boolean, slug: string) => void;
}) {
  return (
    <>
      {/* Module header row */}
      <tr className="bg-[hsl(265_60%_50%/0.03)]">
        <td colSpan={roles.length + 1} className="px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-[hsl(265_80%_55%)]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(265_60%_45%)]">
              {MODULE_LABELS[module] || module}
            </span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{perms.length}</Badge>
          </div>
        </td>
      </tr>

      {/* Permission rows */}
      {perms.map((perm, i) => (
        <tr
          key={perm.id}
          className={cn(
            'border-b border-border/40 transition-colors hover:bg-muted/20',
            i % 2 === 0 && 'bg-card/50',
          )}
        >
          <td className="px-4 py-2.5 sticky left-0 bg-inherit z-10">
            <div className="min-w-0">
              <p className="font-mono font-medium text-foreground truncate">{perm.code}</p>
              {perm.description && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">{perm.description}</p>
              )}
            </div>
          </td>
          {roles.map(role => {
            const has = rolePermMap.get(role.id)?.has(perm.id) ?? false;
            const isLocked = role.slug === 'platform_super_admin';
            const isToggling = toggling === `${role.id}-${perm.id}`;

            return (
              <td key={role.id} className="text-center px-3 py-2.5">
                {isToggling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mx-auto" />
                ) : (
                  <button
                    type="button"
                    disabled={isLocked || !isSuperAdmin}
                    onClick={() => onToggle(role.id, perm.id, has, role.slug)}
                    className={cn(
                      'flex items-center justify-center mx-auto h-7 w-7 rounded-md transition-all duration-200',
                      has
                        ? 'bg-[hsl(265_60%_50%/0.12)] text-[hsl(265_80%_55%)]'
                        : 'bg-muted/30 text-muted-foreground/30',
                      !isLocked && isSuperAdmin && 'hover:scale-110 cursor-pointer',
                      (isLocked || !isSuperAdmin) && 'cursor-default',
                    )}
                  >
                    {has ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
