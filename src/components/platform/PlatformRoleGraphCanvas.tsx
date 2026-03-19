/**
 * PlatformRoleGraphCanvas — Visual graph showing Role → Permission → Scope relationships
 * with platform-specific purple design accents and "Modo Plataforma" indicator.
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Shield, Lock, Eye, Headphones, Wallet, Settings,
  Maximize2, Minimize2, RotateCcw, Network, Zap,
} from 'lucide-react';
import type { PlatformRole, PlatformPermissionDef, PlatformRolePermission } from '@/pages/platform/security/PlatformSecurity';

// ── Platform role styles ─────────────────────────────────────

const ROLE_STYLE: Record<string, { icon: typeof Shield; bg: string; text: string; border: string }> = {
  platform_super_admin: { icon: Lock, bg: 'hsl(0 72% 51% / 0.12)', text: 'hsl(0 72% 51%)', border: 'hsl(0 72% 51% / 0.4)' },
  platform_operations: { icon: Settings, bg: 'hsl(265 80% 55% / 0.12)', text: 'hsl(265 80% 55%)', border: 'hsl(265 80% 55% / 0.4)' },
  platform_support: { icon: Headphones, bg: 'hsl(210 100% 52% / 0.12)', text: 'hsl(210 100% 52%)', border: 'hsl(210 100% 52% / 0.4)' },
  platform_finance: { icon: Wallet, bg: 'hsl(38 92% 50% / 0.12)', text: 'hsl(38 92% 50%)', border: 'hsl(38 92% 50% / 0.4)' },
  platform_fiscal: { icon: Shield, bg: 'hsl(var(--accent) / 0.3)', text: 'hsl(var(--accent-foreground))', border: 'hsl(var(--accent-foreground) / 0.3)' },
  platform_read_only: { icon: Eye, bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))', border: 'hsl(var(--border))' },
  platform_delegated_support: { icon: Headphones, bg: 'hsl(210 100% 52% / 0.12)', text: 'hsl(210 100% 52%)', border: 'hsl(210 100% 52% / 0.4)' },
  platform_marketplace_admin: { icon: Zap, bg: 'hsl(265 80% 55% / 0.12)', text: 'hsl(265 80% 55%)', border: 'hsl(265 80% 55% / 0.4)' },
  platform_compliance: { icon: Shield, bg: 'hsl(38 92% 50% / 0.12)', text: 'hsl(38 92% 50%)', border: 'hsl(38 92% 50% / 0.4)' },
};

const DEFAULT_STYLE = { icon: Shield, bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))', border: 'hsl(var(--border))' };

interface Props {
  roles: PlatformRole[];
  permissions: PlatformPermissionDef[];
  rolePerms: PlatformRolePermission[];
}

export function PlatformRoleGraphCanvas({ roles, permissions, rolePerms }: Props) {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Build maps
  const rolePermMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rolePerms.forEach(rp => {
      if (!map.has(rp.role_id)) map.set(rp.role_id, new Set());
      map.get(rp.role_id)!.add(rp.permission_id);
    });
    return map;
  }, [rolePerms]);

  const permRoleMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rolePerms.forEach(rp => {
      if (!map.has(rp.permission_id)) map.set(rp.permission_id, new Set());
      map.get(rp.permission_id)!.add(rp.role_id);
    });
    return map;
  }, [rolePerms]);

  const permById = useMemo(() => new Map(permissions.map(p => [p.id, p])), [permissions]);

  // Inheritance edges (role → role via inherits_role_ids)
  const inheritEdges = useMemo(() => {
    const edges: Array<{ from: string; to: string }> = [];
    roles.forEach(role => {
      role.inherits_role_ids?.forEach(parentId => {
        edges.push({ from: role.id, to: parentId });
      });
    });
    return edges;
  }, [roles]);

  // Highlighted perms when a role is selected
  const highlightedPermIds = useMemo(() => {
    if (!selectedRoleId) return null;
    return rolePermMap.get(selectedRoleId) ?? new Set<string>();
  }, [selectedRoleId, rolePermMap]);

  // Layout constants
  const ROLE_COL_X = 60;
  const PERM_COL_X = 380;
  const ROW_H = 48;
  const ROLE_H = 44;
  const PERM_H = 32;
  const ROLE_W = 200;
  const PERM_W = 200;

  // Group perms by module
  const groupedPerms = useMemo(() => {
    const map = new Map<string, PlatformPermissionDef[]>();
    permissions.forEach(p => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return map;
  }, [permissions]);

  // Flatten permissions with positions
  const permPositions = useMemo(() => {
    const positions: Array<{ perm: PlatformPermissionDef; y: number; module: string }> = [];
    let y = 40;
    groupedPerms.forEach((perms, module) => {
      y += 24; // module header
      perms.forEach(perm => {
        positions.push({ perm, y, module });
        y += PERM_H + 4;
      });
      y += 8;
    });
    return positions;
  }, [groupedPerms]);

  const canvasHeight = Math.max(roles.length * ROW_H + 80, permPositions.length > 0 ? permPositions[permPositions.length - 1].y + 60 : 400);

  return (
    <Card className={cn(
      'shadow-platform border-platform overflow-hidden transition-all duration-300',
      isFullscreen && 'fixed inset-4 z-50',
    )}>
      {/* Header */}
      <CardHeader className="pb-2 gradient-platform-surface">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-platform-accent">
              <Network className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-display">Role Graph Canvas</CardTitle>
              <CardDescription>
                Clique em um cargo para destacar suas permissões. Linhas tracejadas = herança.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(265_60%_50%/0.08)] border border-[hsl(265_60%_50%/0.15)]">
              <div className="h-2 w-2 rounded-full bg-[hsl(265_80%_55%)] animate-pulse" />
              <span className="text-[10px] font-semibold text-[hsl(265_60%_45%)] uppercase tracking-wider">
                Plataforma
              </span>
            </div>
            <Badge variant="outline" className="text-[9px]">{roles.length} cargos</Badge>
            <Badge variant="outline" className="text-[9px]">{permissions.length} perms</Badge>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className={cn('overflow-auto', isFullscreen ? 'h-[calc(100vh-180px)]' : 'h-[560px]')}>
          <svg
            width={PERM_COL_X + PERM_W + 80}
            height={canvasHeight}
            className="min-w-full"
          >
            {/* Background pattern */}
            <defs>
              <pattern id="platform-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="12" cy="12" r="0.5" fill="hsl(265 60% 50% / 0.06)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#platform-grid)" />

            {/* ── Edges: role → permission ── */}
            {roles.map((role, ri) => {
              const ry = 50 + ri * ROW_H + ROLE_H / 2;
              const permIds = rolePermMap.get(role.id) ?? new Set();

              return Array.from(permIds).map(permId => {
                const pos = permPositions.find(p => p.perm.id === permId);
                if (!pos) return null;
                const py = pos.y + PERM_H / 2;

                const isHighlighted = !selectedRoleId || selectedRoleId === role.id;
                const sx = ROLE_COL_X + ROLE_W;
                const tx = PERM_COL_X;
                const dx = (tx - sx) * 0.4;

                return (
                  <path
                    key={`${role.id}-${permId}`}
                    d={`M ${sx} ${ry} C ${sx + dx} ${ry}, ${tx - dx} ${py}, ${tx} ${py}`}
                    fill="none"
                    stroke={isHighlighted ? 'hsl(265 80% 55% / 0.5)' : 'hsl(var(--border) / 0.15)'}
                    strokeWidth={isHighlighted ? 1.5 : 0.5}
                    className="transition-all duration-300"
                  />
                );
              });
            })}

            {/* ── Edges: inheritance (dashed) ── */}
            {inheritEdges.map(({ from, to }) => {
              const fi = roles.findIndex(r => r.id === from);
              const ti = roles.findIndex(r => r.id === to);
              if (fi < 0 || ti < 0) return null;
              const fy = 50 + fi * ROW_H + ROLE_H / 2;
              const ty = 50 + ti * ROW_H + ROLE_H / 2;

              return (
                <line
                  key={`inherit-${from}-${to}`}
                  x1={ROLE_COL_X + 10}
                  y1={fy}
                  x2={ROLE_COL_X + 10}
                  y2={ty}
                  stroke="hsl(0 72% 51% / 0.4)"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  className="transition-all duration-300"
                />
              );
            })}

            {/* ── Role Nodes ── */}
            {roles.map((role, i) => {
              const y = 50 + i * ROW_H;
              const style = ROLE_STYLE[role.slug] ?? DEFAULT_STYLE;
              const isSelected = selectedRoleId === role.id;
              const permCount = rolePermMap.get(role.id)?.size ?? 0;
              const opacity = !selectedRoleId || isSelected ? 1 : 0.35;

              return (
                <g
                  key={role.id}
                  transform={`translate(${ROLE_COL_X},${y})`}
                  onClick={() => setSelectedRoleId(isSelected ? null : role.id)}
                  className="cursor-pointer"
                  opacity={opacity}
                  style={{ transition: 'opacity 0.3s' }}
                >
                  <rect
                    width={ROLE_W} height={ROLE_H} rx={10}
                    fill={style.bg}
                    stroke={isSelected ? 'hsl(265 80% 55%)' : style.border}
                    strokeWidth={isSelected ? 2.5 : 1.2}
                  />
                  <circle cx={22} cy={ROLE_H / 2} r={11} fill={style.border} opacity={0.25} />
                  <text x={40} y={ROLE_H / 2 - 4} fontSize="11" fontWeight="700" fill={style.text} fontFamily="var(--font-display)">
                    {role.name}
                  </text>
                  <text x={40} y={ROLE_H / 2 + 10} fontSize="8" fill={style.text} opacity={0.6} fontFamily="monospace">
                    {permCount} permissões
                  </text>
                  {role.is_system_role && (
                    <rect x={ROLE_W - 42} y={6} width={36} height={14} rx={4} fill={style.border} opacity={0.2} />
                  )}
                </g>
              );
            })}

            {/* ── Permission Nodes ── */}
            {(() => {
              let lastModule = '';
              return permPositions.map(({ perm, y, module }) => {
                const isHighlighted = !highlightedPermIds || highlightedPermIds.has(perm.id);
                const showHeader = module !== lastModule;
                lastModule = module;
                const roleCount = permRoleMap.get(perm.id)?.size ?? 0;

                return (
                  <g key={perm.id}>
                    {showHeader && (
                    <text
                        x={PERM_COL_X} y={y - 8}
                        fontSize="9" fontWeight="700"
                        fill="hsl(265 60% 50% / 0.7)"
                        letterSpacing="0.1em"
                        fontFamily="var(--font-display)"
                        style={{ textTransform: 'uppercase' }}
                      >
                        {module.toUpperCase()}
                      </text>
                    )}
                    <g
                      transform={`translate(${PERM_COL_X},${y})`}
                      opacity={isHighlighted ? 1 : 0.2}
                      style={{ transition: 'opacity 0.3s' }}
                    >
                      <rect
                        width={PERM_W} height={PERM_H} rx={6}
                        fill={isHighlighted ? 'hsl(265 60% 50% / 0.06)' : 'hsl(var(--card))'}
                        stroke={isHighlighted ? 'hsl(265 60% 50% / 0.25)' : 'hsl(var(--border))'}
                        strokeWidth={1}
                      />
                      <text
                        x={10} y={PERM_H / 2 + 1}
                        fontSize="9" fontWeight="500"
                        fill="hsl(var(--foreground))"
                        fontFamily="monospace"
                        dominantBaseline="middle"
                      >
                        {perm.code}
                      </text>
                      <text
                        x={PERM_W - 20} y={PERM_H / 2 + 1}
                        fontSize="8"
                        fill="hsl(var(--muted-foreground))"
                        dominantBaseline="middle"
                        textAnchor="end"
                      >
                        {roleCount}
                      </text>
                    </g>
                  </g>
                );
              });
            })()}

            {/* Legend */}
            <g transform={`translate(${ROLE_COL_X}, ${canvasHeight - 30})`}>
              <line x1={0} y1={0} x2={20} y2={0} stroke="hsl(265 80% 55% / 0.5)" strokeWidth={1.5} />
              <text x={24} y={1} fontSize="8" fill="hsl(var(--muted-foreground))" dominantBaseline="middle">grants_permission</text>
              <line x1={130} y1={0} x2={150} y2={0} stroke="hsl(0 72% 51% / 0.4)" strokeWidth={1.5} strokeDasharray="6 3" />
              <text x={154} y={1} fontSize="8" fill="hsl(var(--muted-foreground))" dominantBaseline="middle">inherits_role</text>
            </g>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
