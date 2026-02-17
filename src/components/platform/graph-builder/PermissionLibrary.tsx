/**
 * PermissionLibrary — Left panel: browsable permission catalog grouped by module.
 */
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Search, Shield, Zap, Eye, Wallet, Settings, Lock, Headphones, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { PlatformPermissionDef, PlatformRole, PlatformRolePermission } from '@/pages/platform/PlatformSecurity';

const MODULE_LABELS: Record<string, string> = {
  tenants: 'Tenants', modulos: 'Módulos', auditoria: 'Auditoria',
  financeiro: 'Financeiro', fiscal: 'Fiscal', suporte: 'Suporte',
  usuarios: 'Usuários', seguranca: 'Segurança',
};

const MODULE_ICONS: Record<string, typeof Shield> = {
  tenants: Shield, modulos: Zap, auditoria: Eye, financeiro: Wallet,
  fiscal: Shield, suporte: Headphones, usuarios: Settings, seguranca: Lock,
};

interface Props {
  permissions: PlatformPermissionDef[];
  roles: PlatformRole[];
  rolePerms: PlatformRolePermission[];
  selectedPermId: string | null;
  onSelectPerm: (permId: string) => void;
}

export function PermissionLibrary({ permissions, roles, rolePerms, selectedPermId, onSelectPerm }: Props) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search) return permissions;
    const q = search.toLowerCase();
    return permissions.filter(p =>
      p.code.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.module.toLowerCase().includes(q)
    );
  }, [permissions, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlatformPermissionDef[]>();
    filtered.forEach(p => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return map;
  }, [filtered]);

  // Count roles per permission
  const permRoleCounts = useMemo(() => {
    const map = new Map<string, number>();
    rolePerms.forEach(rp => {
      map.set(rp.permission_id, (map.get(rp.permission_id) ?? 0) + 1);
    });
    return map;
  }, [rolePerms]);

  const toggleModule = (mod: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod); else next.add(mod);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Permission Library
        </h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar permissão..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-3 pb-3">
          {Array.from(grouped.entries()).map(([module, perms]) => {
            const isCollapsed = collapsed.has(module);
            const Icon = MODULE_ICONS[module] ?? Shield;

            return (
              <div key={module}>
                <button
                  type="button"
                  onClick={() => toggleModule(module)}
                  className="flex items-center gap-1.5 w-full text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-1"
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <Icon className="h-3 w-3" />
                  {MODULE_LABELS[module] || module}
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">{perms.length}</Badge>
                </button>

                {!isCollapsed && (
                  <div className="space-y-0.5 ml-1">
                    {perms.map(perm => {
                      const isSelected = selectedPermId === perm.id;
                      const roleCount = permRoleCounts.get(perm.id) ?? 0;

                      return (
                        <button
                          key={perm.id}
                          type="button"
                          onClick={() => onSelectPerm(perm.id)}
                          className={cn(
                            'flex items-center gap-2 w-full px-2 py-1.5 rounded text-left transition-colors text-xs',
                            isSelected
                              ? 'bg-primary/10 text-primary border border-primary/30'
                              : 'hover:bg-muted/60 border border-transparent',
                          )}
                        >
                          <span className="font-mono font-medium truncate flex-1">{perm.code}</span>
                          <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">
                            {roleCount}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {grouped.size === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma permissão encontrada.</p>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border px-3 py-2">
        <p className="text-[10px] text-muted-foreground">
          {permissions.length} permissões · {roles.length} cargos
        </p>
      </div>
    </div>
  );
}
