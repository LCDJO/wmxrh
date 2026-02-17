/**
 * MenuDiffViewer — Visual side-by-side diff for menu tree versions.
 *
 * Shows ANTES vs DEPOIS with color-coded changes:
 * - 🟢 added  - 🔴 removed  - 🔵 moved  - 🟡 renamed
 */
import { Plus, Minus, ArrowUpDown, Type, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MenuDiff } from '@/domains/menu-structure/types';
import type { MenuTreeNode } from '@/domains/menu-structure/types';

const DIFF_CONFIG: Record<MenuDiff['type'], { icon: typeof Plus; label: string; color: string; bg: string; border: string }> = {
  added:              { icon: Plus,        label: 'Adicionado', color: 'text-emerald-400', bg: 'bg-emerald-500/8',  border: 'border-emerald-500/25' },
  removed:            { icon: Minus,       label: 'Removido',   color: 'text-destructive',  bg: 'bg-destructive/8',  border: 'border-destructive/25' },
  moved:              { icon: ArrowUpDown, label: 'Movido',     color: 'text-blue-400',     bg: 'bg-blue-500/8',     border: 'border-blue-500/25' },
  renamed:            { icon: Type,        label: 'Renomeado',  color: 'text-amber-400',    bg: 'bg-amber-500/8',    border: 'border-amber-500/25' },
  permission_changed: { icon: Shield,      label: 'Permissão',  color: 'text-purple-400',   bg: 'bg-purple-500/8',   border: 'border-purple-500/25' },
};

interface MenuDiffViewerProps {
  diffs: MenuDiff[];
  beforeLabel?: string;
  afterLabel?: string;
  beforeTree?: MenuTreeNode[];
  afterTree?: MenuTreeNode[];
}

/** Flatten tree to list with depth */
function flattenTree(nodes: MenuTreeNode[], depth = 0): { node: MenuTreeNode; depth: number }[] {
  const result: { node: MenuTreeNode; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ node: n, depth });
    if (n.children) result.push(...flattenTree(n.children, depth + 1));
  }
  return result;
}

/** Mini tree renderer for side-by-side */
function MiniTree({ nodes, highlightIds, type }: { nodes: MenuTreeNode[]; highlightIds: Set<string>; type: 'before' | 'after' }) {
  const flat = flattenTree(nodes);
  const colorMap: Record<string, string> = {};
  // We just highlight the affected nodes
  return (
    <div className="space-y-0.5">
      {flat.map(({ node, depth }) => {
        const isHighlighted = highlightIds.has(node.id);
        return (
          <div
            key={node.id}
            className={cn(
              'flex items-center gap-1.5 py-1 px-2 rounded text-xs transition-colors',
              isHighlighted && type === 'before' && 'bg-destructive/10 text-destructive line-through',
              isHighlighted && type === 'after' && 'bg-emerald-500/10 text-emerald-400 font-medium',
              !isHighlighted && 'text-muted-foreground',
            )}
            style={{ paddingLeft: depth * 16 + 8 }}
          >
            <span className="truncate">{node.label}</span>
            {isHighlighted && (
              <span className="text-[9px] opacity-70 font-mono shrink-0">L{depth}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MenuDiffViewer({ diffs, beforeLabel = 'Antes', afterLabel = 'Depois', beforeTree, afterTree }: MenuDiffViewerProps) {
  if (diffs.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Nenhuma alteração detectada entre as versões.
      </div>
    );
  }

  // Collect affected node IDs
  const beforeHighlight = new Set(diffs.filter(d => d.type === 'removed' || d.type === 'moved' || d.type === 'renamed').map(d => d.nodeId));
  const afterHighlight = new Set(diffs.filter(d => d.type === 'added' || d.type === 'moved' || d.type === 'renamed').map(d => d.nodeId));

  // Group diffs by type
  const grouped = diffs.reduce((acc, d) => {
    (acc[d.type] ??= []).push(d);
    return acc;
  }, {} as Record<string, MenuDiff[]>);

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(grouped).map(([type, items]) => {
          const cfg = DIFF_CONFIG[type as MenuDiff['type']];
          const Icon = cfg.icon;
          return (
            <Badge key={type} variant="outline" className={cn('gap-1 text-[10px]', cfg.border, cfg.color, cfg.bg)}>
              <Icon className="h-3 w-3" />
              {items.length} {cfg.label}
            </Badge>
          );
        })}
        <Badge variant="secondary" className="text-[10px]">{diffs.length} alterações</Badge>
      </div>

      {/* Side-by-side trees */}
      {beforeTree && afterTree && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/40 bg-card/50 p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Minus className="h-3 w-3 text-destructive" />{beforeLabel}
            </p>
            <MiniTree nodes={beforeTree} highlightIds={beforeHighlight} type="before" />
          </div>
          <div className="rounded-lg border border-border/40 bg-card/50 p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Plus className="h-3 w-3 text-emerald-400" />{afterLabel}
            </p>
            <MiniTree nodes={afterTree} highlightIds={afterHighlight} type="after" />
          </div>
        </div>
      )}

      {/* Detailed changelog */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Detalhes</p>
        {diffs.map((d, i) => {
          const cfg = DIFF_CONFIG[d.type];
          const Icon = cfg.icon;
          return (
            <div key={i} className={cn('flex items-center gap-2 rounded-md border p-2 text-xs', cfg.border, cfg.bg)}>
              <Icon className={cn('h-3.5 w-3.5 shrink-0', cfg.color)} />
              <span className={cn('font-medium', cfg.color)}>{d.nodeLabel}</span>
              <span className="text-muted-foreground">—</span>
              <span className="text-foreground/70 truncate">{d.details}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
