/**
 * PermissionGraphView — Interactive visual graph showing Role → Permission relationships.
 *
 * Layout:
 *   - Left column: Role nodes (colored by role type)
 *   - Center: Connection lines (SVG)
 *   - Right column: Permission nodes grouped by module
 *
 * Features:
 *   - Click a role to highlight its permissions
 *   - Click a permission to highlight which roles have it
 *   - Hover for tooltips
 *   - Module grouping with collapsible sections
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Shield, Lock, Eye, Headphones, Wallet, Settings,
  ChevronDown, ChevronRight, Zap, Network,
} from 'lucide-react';
import type { PlatformPermissionDef, PlatformRolePermission } from '@/pages/platform/PlatformSecurity';

// ── Role metadata ───────────────────────────────────────────────

const ROLES = [
  { key: 'platform_super_admin', label: 'Super Admin', icon: Lock, color: 'bg-destructive/15 text-destructive border-destructive/30' },
  { key: 'platform_operations', label: 'Operações', icon: Settings, color: 'bg-primary/15 text-primary border-primary/30' },
  { key: 'platform_support', label: 'Suporte', icon: Headphones, color: 'bg-info/15 text-info border-info/30' },
  { key: 'platform_finance', label: 'Financeiro', icon: Wallet, color: 'bg-warning/15 text-warning border-warning/30' },
  { key: 'platform_read_only', label: 'Somente Leitura', icon: Eye, color: 'bg-muted text-muted-foreground border-border' },
] as const;

const MODULE_ICONS: Record<string, typeof Shield> = {
  tenants: Shield,
  modulos: Zap,
  auditoria: Eye,
  financeiro: Wallet,
  usuarios: Settings,
  seguranca: Lock,
};

const MODULE_LABELS: Record<string, string> = {
  tenants: 'Tenants',
  modulos: 'Módulos',
  auditoria: 'Auditoria',
  financeiro: 'Financeiro',
  usuarios: 'Usuários',
  seguranca: 'Segurança',
};

// ── Props ────────────────────────────────────────────────────────

interface PermissionGraphViewProps {
  permissions: PlatformPermissionDef[];
  rolePerms: PlatformRolePermission[];
}

export function PermissionGraphView({ permissions, rolePerms }: PermissionGraphViewProps) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedPerm, setSelectedPerm] = useState<string | null>(null);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; roleKey: string; permId: string }[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const roleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const permRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Group permissions by module
  const groupedPerms = useMemo(() => {
    const map = new Map<string, PlatformPermissionDef[]>();
    permissions.forEach(p => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return map;
  }, [permissions]);

  // Role → permission IDs mapping
  const rolePermMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rolePerms.forEach(rp => {
      if (!map.has(rp.role)) map.set(rp.role, new Set());
      map.get(rp.role)!.add(rp.permission_id);
    });
    return map;
  }, [rolePerms]);

  // Permission → roles mapping (reverse)
  const permRoleMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rolePerms.forEach(rp => {
      if (!map.has(rp.permission_id)) map.set(rp.permission_id, new Set());
      map.get(rp.permission_id)!.add(rp.role);
    });
    return map;
  }, [rolePerms]);

  const toggleModule = (mod: string) => {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  };

  // Compute SVG lines
  const computeLines = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: typeof lines = [];

    for (const [role, permIds] of rolePermMap) {
      const roleEl = roleRefs.current.get(role);
      if (!roleEl) continue;
      const roleRect = roleEl.getBoundingClientRect();

      for (const permId of permIds) {
        const permEl = permRefs.current.get(permId);
        if (!permEl) continue;
        const permRect = permEl.getBoundingClientRect();

        newLines.push({
          x1: roleRect.right - containerRect.left,
          y1: roleRect.top + roleRect.height / 2 - containerRect.top,
          x2: permRect.left - containerRect.left,
          y2: permRect.top + permRect.height / 2 - containerRect.top,
          roleKey: role,
          permId,
        });
      }
    }
    setLines(newLines);
  }, [rolePermMap]);

  useEffect(() => {
    // Compute after layout
    const timer = setTimeout(computeLines, 100);
    window.addEventListener('resize', computeLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', computeLines);
    };
  }, [computeLines, collapsedModules, permissions, rolePerms]);

  // Determine if a line should be highlighted
  const isLineHighlighted = (roleKey: string, permId: string) => {
    if (!selectedRole && !selectedPerm) return true;
    if (selectedRole && roleKey === selectedRole) return true;
    if (selectedPerm && permId === selectedPerm) return true;
    return false;
  };

  const isRoleHighlighted = (roleKey: string) => {
    if (!selectedRole && !selectedPerm) return true;
    if (selectedRole === roleKey) return true;
    if (selectedPerm && permRoleMap.get(selectedPerm)?.has(roleKey)) return true;
    return false;
  };

  const isPermHighlighted = (permId: string) => {
    if (!selectedRole && !selectedPerm) return true;
    if (selectedPerm === permId) return true;
    if (selectedRole && rolePermMap.get(selectedRole)?.has(permId)) return true;
    return false;
  };

  const clearSelection = () => {
    setSelectedRole(null);
    setSelectedPerm(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-display">Permission Graph</CardTitle>
        </div>
        <CardDescription>
          Clique em um cargo ou permissão para destacar as conexões. Clique fora para limpar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="relative min-h-[400px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) clearSelection();
          }}
        >
          {/* SVG overlay for lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: 'visible' }}>
            {lines.map((line, i) => {
              const highlighted = isLineHighlighted(line.roleKey, line.permId);
              const roleMeta = ROLES.find(r => r.key === line.roleKey);
              return (
                <path
                  key={i}
                  d={`M ${line.x1} ${line.y1} C ${line.x1 + 60} ${line.y1}, ${line.x2 - 60} ${line.y2}, ${line.x2} ${line.y2}`}
                  fill="none"
                  stroke={highlighted ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                  strokeWidth={highlighted ? 1.5 : 0.5}
                  opacity={highlighted ? 0.7 : 0.15}
                  className="transition-all duration-300"
                />
              );
            })}
          </svg>

          <div className="grid grid-cols-[200px_1fr_1fr] gap-8 relative z-10">
            {/* ── Left: Roles ── */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Cargos ({ROLES.length})
              </h3>
              {ROLES.map(role => {
                const Icon = role.icon;
                const permCount = rolePermMap.get(role.key)?.size ?? 0;
                const highlighted = isRoleHighlighted(role.key);
                const isSelected = selectedRole === role.key;

                return (
                  <div
                    key={role.key}
                    ref={el => { if (el) roleRefs.current.set(role.key, el); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPerm(null);
                      setSelectedRole(isSelected ? null : role.key);
                    }}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-200',
                      role.color,
                      !highlighted && 'opacity-30',
                      isSelected && 'ring-2 ring-primary shadow-md scale-[1.02]',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{role.label}</p>
                      <p className="text-[10px] opacity-70">{permCount} perms</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Right: Permissions by module (spanning 2 cols) ── */}
            <div className="col-span-2 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Permissões ({permissions.length})
              </h3>
              {Array.from(groupedPerms.entries()).map(([module, perms]) => {
                const isCollapsed = collapsedModules.has(module);
                const ModIcon = MODULE_ICONS[module] ?? Shield;

                return (
                  <div key={module}>
                    <button
                      type="button"
                      onClick={() => toggleModule(module)}
                      className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      <ModIcon className="h-3.5 w-3.5" />
                      {MODULE_LABELS[module] || module}
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1">{perms.length}</Badge>
                    </button>

                    {!isCollapsed && (
                      <div className="grid grid-cols-2 xl:grid-cols-3 gap-1.5 ml-5">
                        {perms.map(perm => {
                          const highlighted = isPermHighlighted(perm.id);
                          const isSelected = selectedPerm === perm.id;
                          const roleCount = permRoleMap.get(perm.id)?.size ?? 0;

                          return (
                            <div
                              key={perm.id}
                              ref={el => { if (el) permRefs.current.set(perm.id, el); }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRole(null);
                                setSelectedPerm(isSelected ? null : perm.id);
                              }}
                              className={cn(
                                'flex items-center gap-2 px-2.5 py-2 rounded-md border text-xs cursor-pointer transition-all duration-200',
                                'border-border bg-card hover:bg-accent/50',
                                !highlighted && 'opacity-25',
                                isSelected && 'ring-2 ring-primary border-primary/30 bg-primary/5 shadow-sm',
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-mono font-medium truncate">{perm.code}</p>
                                {perm.description && (
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{perm.description}</p>
                                )}
                              </div>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                                {roleCount}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
