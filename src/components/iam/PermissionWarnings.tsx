/**
 * PermissionWarnings — Detects and displays warnings about:
 * - Roles with excessive permissions (e.g. elevated financial access)
 * - Rarely-used permissions (selected but uncommon across roles)
 */
import { useMemo } from 'react';
import type { PermissionDefinition } from '@/domains/iam/iam.service';
import { AlertTriangle, ShieldAlert, TrendingDown, DollarSign, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Sensitive permission patterns ──────────────────────────────────
const SENSITIVE_PATTERNS: {
  pattern: RegExp;
  label: string;
  icon: typeof DollarSign;
  severity: 'high' | 'medium';
}[] = [
  { pattern: /salary\.(update|delete|manage|adjust)/i, label: 'Acesso financeiro elevado (salários)', icon: DollarSign, severity: 'high' },
  { pattern: /payroll\.(manage|delete|simulate)/i, label: 'Acesso financeiro elevado (folha)', icon: DollarSign, severity: 'high' },
  { pattern: /benefits?\.(delete|manage)/i, label: 'Gestão de benefícios com exclusão', icon: DollarSign, severity: 'medium' },
  { pattern: /iam\.(delete|manage)/i, label: 'Pode alterar controle de acesso', icon: Lock, severity: 'high' },
  { pattern: /audit\.(delete|update)/i, label: 'Acesso a modificar auditoria', icon: ShieldAlert, severity: 'high' },
  { pattern: /user\.(delete|manage)/i, label: 'Pode excluir usuários', icon: ShieldAlert, severity: 'medium' },
];

// ── Thresholds ─────────────────────────────────────────────────────
const EXCESSIVE_RATIO = 0.8; // 80%+ of all perms = excessive

interface Warning {
  id: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  icon: typeof AlertTriangle;
}

interface Props {
  selectedPermissionIds: Set<string>;
  permissions: PermissionDefinition[];
  /** All role-permission bindings for rarity analysis */
  allRolePermissions?: { role: string; permission_id: string }[];
  roleName?: string;
}

export function PermissionWarnings({ selectedPermissionIds, permissions, allRolePermissions, roleName }: Props) {
  const warnings = useMemo(() => {
    const result: Warning[] = [];
    const selectedPerms = permissions.filter(p => selectedPermissionIds.has(p.id));
    const ratio = selectedPerms.length / (permissions.length || 1);

    // 1. Excessive permissions (>80% of catalogue)
    if (ratio >= EXCESSIVE_RATIO) {
      result.push({
        id: 'excessive',
        message: `Este cargo possui ${selectedPerms.length}/${permissions.length} permissões (${Math.round(ratio * 100)}%). Considere o princípio de menor privilégio.`,
        severity: 'high',
        icon: ShieldAlert,
      });
    }

    // 2. Sensitive permission patterns
    const matchedPatterns = new Set<string>();
    selectedPerms.forEach(p => {
      SENSITIVE_PATTERNS.forEach(sp => {
        if (sp.pattern.test(p.code) && !matchedPatterns.has(sp.label)) {
          matchedPatterns.add(sp.label);
          result.push({
            id: `sensitive-${sp.label}`,
            message: sp.label,
            severity: sp.severity,
            icon: sp.icon,
          });
        }
      });
    });

    // 3. Rarely-used permissions (selected but used by <20% of roles)
    if (allRolePermissions && allRolePermissions.length > 0) {
      const roleCount = new Set(allRolePermissions.map(rp => rp.role)).size;
      if (roleCount >= 2) {
        const permUsage = allRolePermissions.reduce<Record<string, Set<string>>>((acc, rp) => {
          (acc[rp.permission_id] ??= new Set()).add(rp.role);
          return acc;
        }, {});

        const rarePerms = selectedPerms.filter(p => {
          const usedBy = permUsage[p.id]?.size ?? 0;
          return usedBy / roleCount < 0.2;
        });

        if (rarePerms.length > 0) {
          result.push({
            id: 'rare',
            message: `${rarePerms.length} permissão(ões) raramente usada(s) por outros cargos: ${rarePerms.slice(0, 3).map(p => p.code).join(', ')}${rarePerms.length > 3 ? '…' : ''}`,
            severity: 'low',
            icon: TrendingDown,
          });
        }
      }
    }

    return result;
  }, [selectedPermissionIds, permissions, allRolePermissions]);

  if (warnings.length === 0) return null;

  const highCount = warnings.filter(w => w.severity === 'high').length;

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/[0.03] overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-destructive/15">
        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
        <p className="text-xs font-semibold text-destructive">
          {highCount > 0
            ? `${highCount} alerta(s) crítico(s) de segurança`
            : `${warnings.length} aviso(s) de permissão`}
        </p>
      </div>
      <div className="px-3.5 py-2.5 space-y-2">
        {warnings.map(w => {
          const Icon = w.icon;
          return (
            <div
              key={w.id}
              className={cn(
                'flex items-start gap-2 rounded-md p-2 text-xs',
                w.severity === 'high'
                  ? 'bg-destructive/10 text-destructive'
                  : w.severity === 'medium'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'bg-muted/50 text-muted-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{w.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
