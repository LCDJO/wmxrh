/**
 * AccessGraphView — Shows effective access paths: User → Role → Permissions.
 * Uses platform_roles table data instead of hardcoded role metadata.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  User, Shield, Lock, Eye, Headphones, Wallet, Settings,
  ChevronDown, ChevronRight, Search, Network, ArrowRight,
} from 'lucide-react';
import type { PlatformUser, PlatformRole, PlatformPermissionDef, PlatformRolePermission } from '@/pages/platform/PlatformSecurity';

// ── Role display metadata by slug ───────────────────────────────

const ROLE_META: Record<string, { icon: typeof Shield; color: string; bgColor: string }> = {
  platform_super_admin: { icon: Lock, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  platform_operations: { icon: Settings, color: 'text-primary', bgColor: 'bg-primary/10' },
  platform_support: { icon: Headphones, color: 'text-info', bgColor: 'bg-info/10' },
  platform_finance: { icon: Wallet, color: 'text-warning', bgColor: 'bg-warning/10' },
  platform_fiscal: { icon: Shield, color: 'text-accent-foreground', bgColor: 'bg-accent' },
  platform_read_only: { icon: Eye, color: 'text-muted-foreground', bgColor: 'bg-muted' },
};

const DEFAULT_META = { icon: Shield, color: 'text-muted-foreground', bgColor: 'bg-muted' };

const MODULE_LABELS: Record<string, string> = {
  tenants: 'Tenants', modulos: 'Módulos', auditoria: 'Auditoria',
  financeiro: 'Financeiro', fiscal: 'Fiscal', suporte: 'Suporte', usuarios: 'Usuários', seguranca: 'Segurança',
};

// ── Props ────────────────────────────────────────────────────────

interface AccessGraphViewProps {
  users: PlatformUser[];
  roles: PlatformRole[];
  permissions: PlatformPermissionDef[];
  rolePerms: PlatformRolePermission[];
}

export function AccessGraphView({ users, roles, permissions, rolePerms }: AccessGraphViewProps) {
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles]);

  // role_id → permission IDs
  const rolePermMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rolePerms.forEach(rp => {
      if (!map.has(rp.role_id)) map.set(rp.role_id, new Set());
      map.get(rp.role_id)!.add(rp.permission_id);
    });
    return map;
  }, [rolePerms]);

  const permById = useMemo(() => new Map(permissions.map(p => [p.id, p])), [permissions]);

  const getRoleForUser = (user: PlatformUser): PlatformRole | undefined => {
    return user.platform_roles ?? roleById.get(user.role_id);
  };

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => {
      const role = getRoleForUser(u);
      return u.email.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q) ||
        role?.name.toLowerCase().includes(q);
    });
  }, [users, search, roleById]);

  const stats = useMemo(() => {
    const roleCounts = new Map<string, { count: number; role: PlatformRole }>();
    users.forEach(u => {
      const role = getRoleForUser(u);
      if (!role) return;
      const entry = roleCounts.get(role.id) ?? { count: 0, role };
      entry.count++;
      roleCounts.set(role.id, entry);
    });
    return roleCounts;
  }, [users, roleById]);

  const getEffectivePermissions = (roleId: string): PlatformPermissionDef[] => {
    const permIds = rolePermMap.get(roleId) ?? new Set();
    return Array.from(permIds)
      .map(id => permById.get(id))
      .filter((p): p is PlatformPermissionDef => !!p)
      .sort((a, b) => a.module.localeCompare(b.module) || a.code.localeCompare(b.code));
  };

  const groupPermsByModule = (perms: PlatformPermissionDef[]) => {
    const map = new Map<string, PlatformPermissionDef[]>();
    perms.forEach(p => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return map;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-display">Access Graph</CardTitle>
        </div>
        <CardDescription>
          Visualize o caminho de acesso efetivo: Usuário → Cargo → Permissões.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar usuário..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 flex-wrap">
          {Array.from(stats.values()).map(({ count, role }) => {
            const meta = ROLE_META[role.slug] ?? DEFAULT_META;
            const Icon = meta.icon;
            return (
              <div key={role.id} className="flex items-center gap-1.5 text-xs">
                <div className={cn('flex h-5 w-5 items-center justify-center rounded', meta.bgColor)}>
                  <Icon className={cn('h-3 w-3', meta.color)} />
                </div>
                <span className="text-muted-foreground">{role.name}:</span>
                <span className="font-semibold text-foreground">{count}</span>
              </div>
            );
          })}
        </div>

        {/* User access cards */}
        <div className="space-y-2">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
          ) : (
            filteredUsers.map(user => {
              const isExpanded = expandedUser === user.id;
              const role = getRoleForUser(user);
              const meta = ROLE_META[role?.slug ?? ''] ?? DEFAULT_META;
              const Icon = meta.icon;
              const effectivePerms = getEffectivePermissions(user.role_id);
              const groupedPerms = groupPermsByModule(effectivePerms);

              return (
                <div
                  key={user.id}
                  className={cn(
                    'rounded-lg border transition-all duration-200',
                    isExpanded ? 'border-primary/30 shadow-sm' : 'border-border',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                    className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent/30 rounded-lg transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}

                    <div className="flex items-center gap-2 min-w-[180px]">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.display_name || user.email}</p>
                        {user.display_name && (
                          <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />

                    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md', meta.bgColor)}>
                      <Icon className={cn('h-3.5 w-3.5', meta.color)} />
                      <span className={cn('text-xs font-semibold', meta.color)}>{role?.name ?? '—'}</span>
                    </div>

                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />

                    <Badge variant="outline" className="text-xs shrink-0">
                      {effectivePerms.length} permissões
                    </Badge>

                    <Badge
                      variant={user.status === 'active' ? 'default' : user.status === 'suspended' ? 'destructive' : 'secondary'}
                      className="text-[10px] ml-auto shrink-0"
                    >
                      {user.status === 'active' ? 'Ativo' : user.status === 'suspended' ? 'Suspenso' : 'Inativo'}
                    </Badge>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border/50">
                      <div className="ml-12 space-y-3">
                        {Array.from(groupedPerms.entries()).map(([module, perms]) => (
                          <div key={module}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                              {MODULE_LABELS[module] || module}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {perms.map(perm => (
                                <Badge
                                  key={perm.id}
                                  variant="secondary"
                                  className="text-[10px] font-mono px-2 py-0.5"
                                  title={perm.description ?? undefined}
                                >
                                  {perm.code}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                        {effectivePerms.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">
                            Nenhuma permissão configurada para este cargo.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
