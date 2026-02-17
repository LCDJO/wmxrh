/**
 * MenuTreeBuilder — Reusable hierarchical tree editor with:
 * - Pointer-based drag & drop (horizontal = indent/outdent, vertical = reorder)
 * - Expand/collapse
 * - Per-node role-based edit guard
 * - Real-time preview
 */
import {
  LayoutDashboard, Building2, Puzzle, ShieldCheck, ScrollText,
  Zap, Users, Package, Megaphone, KeyRound, Activity, Monitor,
  TrendingUp, GripVertical, Lock,
  ChevronRight, ChevronDown, ChevronUp, ArrowRight, ArrowLeft,
  Shield, Rocket, Globe, Settings, GitBranch, LockKeyhole,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCallback, useRef, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { MAX_TREE_DEPTH } from '@/domains/menu-structure/types';
import type { MenuTreeNode } from '@/domains/menu-structure/types';
import type { MenuTreeManager } from '@/domains/menu-structure/menu-structure-engine';
import type { MenuPermissionResolver, MenuEditorRole } from '@/domains/menu-structure/menu-structure-engine';

/* ─── Icons ─── */
const ICON_MAP: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, Building2, Puzzle, ShieldCheck, ScrollText,
  Zap, Users, Package, Megaphone, KeyRound, Activity, Monitor,
  TrendingUp, Rocket, Globe, Settings, Shield, GitBranch,
};
const getIcon = (key?: string) => ICON_MAP[key ?? ''] ?? Puzzle;

/* ─── Props ─── */
export interface MenuTreeBuilderProps {
  tree: MenuTreeNode[];
  treeManager: MenuTreeManager;
  permissionResolver: MenuPermissionResolver;
  editorRole: MenuEditorRole;
  onTreeChange: () => void;
  onItemMoved?: (item: MenuTreeNode, fromParent: string | null, toParent: string | null, newIndex: number) => void;
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
}

interface DropTarget {
  targetId: string;
  position: 'before' | 'after' | 'child';
  depth: number;
}

export function MenuTreeBuilder({
  tree,
  treeManager,
  permissionResolver,
  editorRole,
  onTreeChange,
  onItemMoved,
  selectedId,
  onSelectNode,
}: MenuTreeBuilderProps) {
  const canEditTree = permissionResolver.canEditTree(editorRole);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    const walk = (nodes: MenuTreeNode[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) { expanded.add(n.id); walk(n.children); }
      }
    };
    walk(tree);
    return expanded;
  });

  // ─── Drag state ───
  const HORIZONTAL_THRESHOLD = 40;
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [dragIntent, setDragIntent] = useState<'none' | 'indent' | 'outdent'>('none');
  const dragStartXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Flat visible list
  const flatVisible = useMemo(() => {
    const result: { node: MenuTreeNode; depth: number; parentId: string | null; index: number }[] = [];
    const walk = (nodes: MenuTreeNode[], depth: number, parentId: string | null) => {
      for (let i = 0; i < nodes.length; i++) {
        result.push({ node: nodes[i], depth, parentId, index: i });
        if (nodes[i].children && nodes[i].children!.length > 0 && expandedIds.has(nodes[i].id)) {
          walk(nodes[i].children!, depth + 1, nodes[i].id);
        }
      }
    };
    walk(tree, 0, null);
    return result;
  }, [tree, expandedIds]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  // ─── Button actions ───
  const canEditNode = (node: MenuTreeNode) => canEditTree && !node.locked && permissionResolver.canEditNode(node, editorRole);

  const handleMoveUp = (id: string) => {
    const parent = treeManager.findParent(id);
    const siblings = parent?.children ?? treeManager.getTree();
    const idx = siblings.findIndex(n => n.id === id);
    if (idx <= 0) return;
    const node = siblings[idx];
    treeManager.moveNode(id, parent?.id ?? null, idx - 1);
    onTreeChange();
    onItemMoved?.(node, parent?.id ?? null, parent?.id ?? null, idx - 1);
  };
  const handleMoveDown = (id: string) => {
    const parent = treeManager.findParent(id);
    const siblings = parent?.children ?? treeManager.getTree();
    const idx = siblings.findIndex(n => n.id === id);
    if (idx < 0 || idx >= siblings.length - 1) return;
    const node = siblings[idx];
    treeManager.moveNode(id, parent?.id ?? null, idx + 2);
    onTreeChange();
    onItemMoved?.(node, parent?.id ?? null, parent?.id ?? null, idx + 2);
  };
  const handleIndentRight = (id: string) => {
    const node = flatVisible.find(f => f.node.id === id);
    const fromParent = node?.parentId ?? null;
    treeManager.demoteNode(id);
    onTreeChange();
    const newParent = treeManager.findParent(id);
    onItemMoved?.(node!.node, fromParent, newParent?.id ?? null, 0);
    toast.success('Nível aumentado');
  };
  const handleIndentLeft = (id: string) => {
    const node = flatVisible.find(f => f.node.id === id);
    const fromParent = node?.parentId ?? null;
    treeManager.promoteNode(id);
    onTreeChange();
    const newParent = treeManager.findParent(id);
    onItemMoved?.(node!.node, fromParent, newParent?.id ?? null, 0);
    toast.success('Nível reduzido');
  };

  // ─── Drag controller ───
  const executeDrop = useCallback((sourceId: string, target: DropTarget) => {
    if (sourceId === target.targetId) return;
    const entry = flatVisible.find(f => f.node.id === target.targetId);
    if (!entry) return;

    // Check permission on source node
    const sourceNode = treeManager.findNode(sourceId);
    if (sourceNode && !permissionResolver.canEditNode(sourceNode, editorRole)) {
      toast.error('Sem permissão para mover este item');
      return;
    }

    if (target.position === 'child') {
      const tgt = treeManager.findNode(target.targetId);
      treeManager.moveNode(sourceId, target.targetId, tgt?.children?.length ?? 0);
      setExpandedIds(prev => new Set([...prev, target.targetId]));
      toast.success('Movido como filho');
    } else if (target.position === 'before') {
      treeManager.moveNode(sourceId, entry.parentId, entry.index);
      toast.success('Reordenado');
    } else {
      treeManager.moveNode(sourceId, entry.parentId, entry.index + 1);
      toast.success('Reordenado');
    }
    onTreeChange();
  }, [treeManager, flatVisible, onTreeChange, permissionResolver, editorRole]);

  const handleGripPointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();

    dragStartXRef.current = e.clientX;
    isDraggingRef.current = false;
    const startY = e.clientY;

    const sourceId = nodeId;
    let currentTarget: DropTarget | null = null;

    const onMove = (me: PointerEvent) => {
      if (!isDraggingRef.current) {
        const dist = Math.abs(me.clientX - dragStartXRef.current) + Math.abs(me.clientY - startY);
        if (dist < 5) return;
        isDraggingRef.current = true;
        setDraggedId(sourceId);
      }

      const deltaX = me.clientX - dragStartXRef.current;
      const intent = deltaX > HORIZONTAL_THRESHOLD ? 'indent' : deltaX < -HORIZONTAL_THRESHOLD ? 'outdent' : 'none';
      setDragIntent(intent);

      if (!treeContainerRef.current) return;
      const rows = treeContainerRef.current.querySelectorAll<HTMLElement>('[data-node-id]');
      let closestId: string | null = null;
      let closestDist = Infinity;
      let closestRect: DOMRect | null = null;

      rows.forEach(row => {
        const id = row.dataset.nodeId!;
        if (id === sourceId) return;
        const rect = row.getBoundingClientRect();
        const d = Math.abs(me.clientY - (rect.top + rect.height / 2));
        if (d < closestDist) { closestDist = d; closestId = id; closestRect = rect; }
      });

      if (closestId && closestRect && closestDist < 60) {
        const idx = flatVisible.findIndex(f => f.node.id === closestId);
        if (idx < 0) { currentTarget = null; setDropTarget(null); return; }
        const entry = flatVisible[idx];
        const relY = me.clientY - (closestRect as DOMRect).top;
        const isTopHalf = relY < (closestRect as DOMRect).height / 2;

        if (intent === 'indent' && entry.depth + 1 < MAX_TREE_DEPTH) {
          currentTarget = { targetId: closestId, position: 'child', depth: entry.depth + 1 };
        } else if (isTopHalf) {
          currentTarget = { targetId: closestId, position: 'before', depth: entry.depth };
        } else {
          currentTarget = { targetId: closestId, position: 'after', depth: entry.depth };
        }
        setDropTarget(currentTarget);
      } else {
        currentTarget = null;
        setDropTarget(null);
      }
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (isDraggingRef.current && currentTarget) executeDrop(sourceId, currentTarget);
      isDraggingRef.current = false;
      setDraggedId(null);
      setDropTarget(null);
      setDragIntent('none');
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [flatVisible, executeDrop]);

  // ─── Node renderer ───
  const renderNode = (node: MenuTreeNode, depth: number, index: number, siblings: MenuTreeNode[]) => {
    const Icon = getIcon(node.icon);
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const isDragged = draggedId === node.id;
    const isFirst = index === 0;
    const isLast = index === siblings.length - 1;
    const nodeEditable = canEditNode(node);

    const isDropBefore = dropTarget?.targetId === node.id && dropTarget.position === 'before';
    const isDropAfter = dropTarget?.targetId === node.id && dropTarget.position === 'after';
    const isDropChild = dropTarget?.targetId === node.id && dropTarget.position === 'child';

    return (
      <div key={node.id} className="select-none relative">
        {isDropBefore && (
          <div className="absolute left-0 right-0 h-0.5 bg-primary rounded-full z-10 pointer-events-none" style={{ marginLeft: depth * 24, top: 0 }}>
            <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-primary" />
          </div>
        )}

        <div
          data-node-id={node.id}
          onClick={() => onSelectNode(isSelected ? null : node.id)}
          className={cn(
            'group flex items-center gap-2 py-2 px-3 rounded-lg transition-all duration-150 cursor-pointer relative',
            isDragged && 'opacity-20 scale-[0.97] pointer-events-none',
            isDropChild && 'ring-2 ring-primary bg-primary/10',
            isSelected && !isDropChild && 'bg-primary/10 ring-1 ring-primary/30',
            !isSelected && !isDropChild && !isDragged && 'hover:bg-muted/40',
            !nodeEditable && 'opacity-60',
          )}
          style={{ marginLeft: depth * 24 }}
        >
          {/* Grip */}
          {nodeEditable ? (
            <div onPointerDown={(e) => handleGripPointerDown(e, node.id)} className="touch-none p-0.5 -m-0.5 cursor-grab active:cursor-grabbing shrink-0">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground" />
            </div>
          ) : (
            <div className="shrink-0 p-0.5 -m-0.5" title={node.locked ? 'Bloqueado' : 'Sem permissão'}>
              {node.locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground/30" /> : <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground/20" />}
            </div>
          )}

          {/* Expand */}
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }} className="p-0.5 rounded hover:bg-muted/60 shrink-0">
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          ) : <div className="w-[18px]" />}

          {/* Icon */}
          <div className={cn(
            'h-7 w-7 rounded-md flex items-center justify-center shrink-0',
            depth === 0 ? 'bg-primary/10' : depth === 1 ? 'bg-accent/40' : 'bg-muted/40',
          )}>
            <Icon className={cn('h-3.5 w-3.5', depth === 0 ? 'text-primary' : 'text-muted-foreground')} />
          </div>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-medium truncate', depth === 0 ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                {node.label}
              </span>
              {node.locked && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 bg-amber-500/10">locked</Badge>}
              {!nodeEditable && !node.locked && (
                <Badge variant="outline" className="text-[9px] border-muted-foreground/30 text-muted-foreground gap-0.5">
                  <LockKeyhole className="h-2.5 w-2.5" />restrito
                </Badge>
              )}
              {node.role_permissions && node.role_permissions.length > 0 && (
                <Badge variant="outline" className="text-[9px] border-primary/30 text-primary/70 gap-0.5">
                  <Shield className="h-2.5 w-2.5" />{node.role_permissions.length}
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono block truncate">{node.slug}</span>
          </div>

          {/* Depth badge */}
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">L{depth}</Badge>

          {/* Actions — only for editable nodes */}
          {nodeEditable && isSelected && (
            <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
              <button onClick={() => handleMoveUp(node.id)} disabled={isFirst} className="p-1 rounded hover:bg-muted/60 disabled:opacity-20" title="Mover para cima"><ChevronUp className="h-3 w-3" /></button>
              <button onClick={() => handleMoveDown(node.id)} disabled={isLast} className="p-1 rounded hover:bg-muted/60 disabled:opacity-20" title="Mover para baixo"><ChevronDown className="h-3 w-3" /></button>
              <button onClick={() => handleIndentRight(node.id)} className="p-1 rounded hover:bg-muted/60" title="Tornar filho"><ArrowRight className="h-3 w-3" /></button>
              <button onClick={() => handleIndentLeft(node.id)} disabled={depth === 0} className="p-1 rounded hover:bg-muted/60 disabled:opacity-20" title="Promover"><ArrowLeft className="h-3 w-3" /></button>
            </div>
          )}

          {hasChildren && <span className="text-[10px] text-muted-foreground shrink-0">{node.children!.length}</span>}
        </div>

        {isDropAfter && !hasChildren && (
          <div className="absolute left-0 right-0 h-0.5 bg-primary rounded-full z-10 pointer-events-none" style={{ marginLeft: depth * 24, bottom: 0 }}>
            <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-primary" />
          </div>
        )}

        {isDropChild && (
          <div className="mx-4 my-0.5 py-1 rounded border border-dashed border-primary/40 flex items-center justify-center text-[10px] text-primary/60 bg-primary/5 pointer-events-none" style={{ marginLeft: (depth + 1) * 24 + 16 }}>
            <ArrowRight className="h-3 w-3 mr-1" />
            Soltar como filho de <span className="font-semibold ml-1">{node.label}</span>
          </div>
        )}

        {hasChildren && isExpanded && (
          <div>{node.children!.map((child, cIdx) => renderNode(child, depth + 1, cIdx, node.children!))}</div>
        )}
      </div>
    );
  };

  // ─── Drag HUD ───
  const dragHud = draggedId && dragIntent !== 'none' && (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
      <div className={cn(
        'px-4 py-2 rounded-full text-xs font-medium shadow-lg border flex items-center gap-2',
        dragIntent === 'indent' ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-amber-500/15 border-amber-500/30 text-amber-400',
      )}>
        {dragIntent === 'indent'
          ? <><ArrowRight className="h-3.5 w-3.5" />Solte para tornar filho (indent)</>
          : <><ArrowLeft className="h-3.5 w-3.5" />Solte para promover (outdent)</>
        }
      </div>
    </div>
  );

  return (
    <>
      {dragHud}

      {/* Role scope banner */}
      {!canEditTree && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-3 text-xs text-amber-400">
          <LockKeyhole className="h-4 w-4 shrink-0" />
          <span>Seu cargo (<strong>{editorRole}</strong>) não permite editar a estrutura de menus.</span>
        </div>
      )}
      {canEditTree && editorRole !== 'PlatformSuperAdmin' && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 mb-3 text-xs text-primary/80">
          <Shield className="h-4 w-4 shrink-0" />
          <span>Escopo de edição: <strong>{permissionResolver.getEditScopeLabel(editorRole)}</strong>. Itens fora do escopo estão marcados como restritos.</span>
        </div>
      )}

      <div ref={treeContainerRef} className="space-y-0.5">
        {tree.map((node, idx) => renderNode(node, 0, idx, tree))}
      </div>
    </>
  );
}
