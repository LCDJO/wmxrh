/**
 * PlatformAccessPreview — Access preview panel for platform mode.
 * Shows effective permissions and inheritance path for a selected role or user.
 * Styled with platform-specific purple accents.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Shield, Lock, Eye, Headphones, Wallet, Settings,
  Search, User, ArrowRight, ChevronDown, ChevronRight,
  CheckCircle, Network, Zap, GitBranch,
} from 'lucide-react';
import type { PlatformUser, PlatformRole, PlatformPermissionDef, PlatformRolePermission } from '@/pages/platform/PlatformSecurity';

const ROLE_META: Record<string, { icon: typeof Shield; color: string; bg: string }> = {
  platform_super_admin: { icon: Lock, color: 'text-destructive', bg: 'bg-destructive/10' },
  platform_operations: { icon: Settings, color: 'text-[hsl(265_80%_55%)]', bg: 'bg-[hsl(265_60%_50%/0.08)]' },
  platform_support: { icon: Headphones, color: 'text-info', bg: 'bg-info/10' },
  platform_finance: { icon: Wallet, color: 'text-warning', bg: 'bg-warning/10' },
  platform_fiscal: { icon: Shield, color: 'text-accent-foreground', bg: 'bg-accent' },
  platform_read_only: { icon: Eye, color: 'text-muted-foreground', bg: 'bg-muted' },
};

const DEFAULT_META = { icon: Shield, color: 'text-muted-foreground', bg: 'bg-muted' };

const MODULE_LABELS: Record<string, string> = {
  tenants: 'Tenants', modulos: 'Módulos', auditoria: 'Auditoria',
  financeiro: 'Financeiro', fiscal: 'Fiscal', suporte: 'Suporte',
  usuarios: 'Usuários', seguranca: 'Segurança',
};

interface Props {
  users: PlatformUser[];
  roles: PlatformRole[];
  permissions: PlatformPermissionDef[];
  rolePerms: PlatformRolePermission[];
}

export function PlatformAccessPreview({ users, roles, permissions, rolePerms }: Props) {
  const [search, setSearch] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | null>(null);

  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles]);
  const permById = useMemo(() => new Map(permissions.map(p => [p.id, p])), [permissions]);

  const rolePermMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rolePerms.forEach(rp => {
      if (!map.has(rp.role_id)) map.set(rp.role_id, new Set());
      map.get(rp.role_id)!.add(rp.permission_id);
    });
    return map;
  }, [rolePerms]);

  // Resolve effective permissions considering inheritance
  const getEffectivePerms = (roleId: string, visited = new Set<string>()): PlatformPermissionDef[] => {
    if (visited.has(roleId)) return [];
    visited.add(roleId);

    const direct = rolePermMap.get(roleId) ?? new Set();
    const role = roleById.get(roleId);
    const inherited = new Set<string>();

    // BFS role inheritance
    role?.inherits_role_ids?.forEach(parentId => {
      const parentPerms = getEffectivePerms(parentId, visited);
      parentPerms.forEach(p => inherited.add(p.id));
    });

    const allPermIds = new Set([...direct, ...inherited]);
    return Array.from(allPermIds)
      .map(id => permById.get(id))
      .filter((p): p is PlatformPermissionDef => !!p)
      .sort((a, b) => a.module.localeCompare(b.module) || a.code.localeCompare(b.code));
  };

  const groupByModule = (perms: PlatformPermissionDef[]) => {
    const map = new Map<string, PlatformPermissionDef[]>();
    perms.forEach(p => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return map;
  };

  const getRoleForUser = (user: PlatformUser) =>
    user.platform_roles ?? roleById.get(user.role_id);

  const getInheritanceChain = (roleId: string, visited = new Set<string>()): PlatformRole[] => {
    if (visited.has(roleId)) return [];
    visited.add(roleId);
    const role = roleById.get(roleId);
    if (!role) return [];
    const chain = [role];
    role.inherits_role_ids?.forEach(parentId => {
      chain.push(...getInheritanceChain(parentId, visited));
    });
    return chain;
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => {
      const role = getRoleForUser(u);
      const matchesSearch = u.email.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q) ||
        role?.name.toLowerCase().includes(q);
      const matchesRole = !selectedRoleFilter || u.role_id === selectedRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, selectedRoleFilter, roleById]);

  // Role distribution stats
  const roleStats = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach(u => {
      map.set(u.role_id, (map.get(u.role_id) ?? 0) + 1);
    });
    return map;
  }, [users]);

  return (
    <Card className="shadow-platform border-platform overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3 gradient-platform-surface">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-platform-accent">
              <GitBranch className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-display">Access Preview</CardTitle>
              <CardDescription>
                Visualize o acesso efetivo: Usuário → Cargo → Herança → Permissões.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(265_60%_50%/0.08)] border border-[hsl(265_60%_50%/0.15)]">
            <div className="h-2 w-2 rounded-full bg-[hsl(265_80%_55%)] animate-pulse" />
            <span className="text-[10px] font-semibold text-[hsl(265_60%_45%)] uppercase tracking-wider">
              Modo Plataforma
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>

          {/* Role filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedRoleFilter(null)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all',
                !selectedRoleFilter
                  ? 'bg-[hsl(265_60%_50%/0.15)] text-[hsl(265_80%_55%)] ring-1 ring-[hsl(265_60%_50%/0.3)]'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              Todos ({users.length})
            </button>
            {roles.map(role => {
              const meta = ROLE_META[role.slug] ?? DEFAULT_META;
              const count = roleStats.get(role.id) ?? 0;
              const isActive = selectedRoleFilter === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleFilter(isActive ? null : role.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all',
                    isActive
                      ? 'bg-[hsl(265_60%_50%/0.15)] text-[hsl(265_80%_55%)] ring-1 ring-[hsl(265_60%_50%/0.3)]'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {role.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* User access cards */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum usuário encontrado.
            </div>
          ) : (
            filteredUsers.map(user => {
              const role = getRoleForUser(user);
              const meta = ROLE_META[role?.slug ?? ''] ?? DEFAULT_META;
              const Icon = meta.icon;
              const isExpanded = expandedUserId === user.id;
              const effectivePerms = getEffectivePerms(user.role_id);
              const grouped = groupByModule(effectivePerms);
              const chain = getInheritanceChain(user.role_id);

              return (
                <div
                  key={user.id}
                  className={cn(
                    'rounded-lg border transition-all duration-200',
                    isExpanded
                      ? 'border-[hsl(265_60%_50%/0.3)] shadow-platform'
                      : 'border-border hover:border-[hsl(265_60%_50%/0.15)]',
                  )}
                >
                  {/* User row */}
                  <button
                    type="button"
                    onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                    className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-muted/20 rounded-lg"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[hsl(265_80%_55%)] shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}

                    <div className="flex items-center gap-2 min-w-[160px]">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(265_60%_50%/0.06)]">
                        <User className="h-4 w-4 text-[hsl(265_80%_55%)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.display_name || user.email}</p>
                        {user.display_name && (
                          <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-3.5 w-3.5 text-[hsl(265_60%_50%/0.3)] shrink-0" />

                    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md', meta.bg)}>
                      <Icon className={cn('h-3.5 w-3.5', meta.color)} />
                      <span className={cn('text-xs font-semibold', meta.color)}>{role?.name ?? '—'}</span>
                    </div>

                    <ArrowRight className="h-3.5 w-3.5 text-[hsl(265_60%_50%/0.3)] shrink-0" />

                    <Badge variant="outline" className="text-[10px] gap-1 shrink-0 border-[hsl(265_60%_50%/0.2)]">
                      <CheckCircle className="h-3 w-3 text-[hsl(265_80%_55%)]" />
                      {effectivePerms.length} permissões
                    </Badge>

                    {chain.length > 1 && (
                      <Badge variant="secondary" className="text-[9px] shrink-0 gap-1">
                        <GitBranch className="h-3 w-3" />
                        {chain.length - 1} herança
                      </Badge>
                    )}

                    <Badge
                      variant={user.status === 'active' ? 'default' : 'destructive'}
                      className="text-[9px] ml-auto shrink-0"
                    >
                      {user.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-[hsl(265_60%_50%/0.1)]">
                      <div className="ml-12 space-y-4">
                        {/* Inheritance chain */}
                        {chain.length > 1 && (
                          <div className="p-3 rounded-lg bg-[hsl(265_60%_50%/0.03)] border border-[hsl(265_60%_50%/0.1)]">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(265_60%_45%)] mb-2">
                              Cadeia de Herança
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {chain.map((r, i) => {
                                const rmeta = ROLE_META[r.slug] ?? DEFAULT_META;
                                const RIcon = rmeta.icon;
                                return (
                                  <div key={r.id} className="flex items-center gap-2">
                                    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold', rmeta.bg, rmeta.color)}>
                                      <RIcon className="h-3 w-3" />
                                      {r.name}
                                    </div>
                                    {i < chain.length - 1 && (
                                      <ArrowRight className="h-3 w-3 text-[hsl(265_60%_50%/0.3)]" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Permissions grouped by module */}
                        {Array.from(grouped.entries()).map(([module, perms]) => (
                          <div key={module}>
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(265_60%_45%)] mb-1.5">
                              {MODULE_LABELS[module] || module}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {perms.map(perm => (
                                <Badge
                                  key={perm.id}
                                  variant="secondary"
                                  className="text-[10px] font-mono px-2 py-0.5 bg-[hsl(265_60%_50%/0.06)] border-[hsl(265_60%_50%/0.12)] text-foreground"
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
