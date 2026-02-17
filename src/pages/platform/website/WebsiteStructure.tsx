/**
 * /platform/website/structure — Hierarchical page tree manager.
 */
import { useState, useCallback } from 'react';
import { Network, ChevronRight, ChevronDown, Plus, GripVertical, Trash2, Eye, EyeOff, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SiteNode {
  id: string;
  title: string;
  slug: string;
  visible: boolean;
  children: SiteNode[];
}

const INITIAL_TREE: SiteNode[] = [
  {
    id: 'home', title: 'Home', slug: '/', visible: true,
    children: [],
  },
  {
    id: 'about', title: 'Sobre', slug: '/sobre', visible: true,
    children: [
      { id: 'team', title: 'Equipe', slug: '/sobre/equipe', visible: true, children: [] },
      { id: 'history', title: 'História', slug: '/sobre/historia', visible: true, children: [] },
    ],
  },
  {
    id: 'features', title: 'Funcionalidades', slug: '/funcionalidades', visible: true,
    children: [
      { id: 'payroll', title: 'Folha de Pagamento', slug: '/funcionalidades/folha', visible: true, children: [] },
      { id: 'compliance', title: 'Compliance', slug: '/funcionalidades/compliance', visible: true, children: [] },
      { id: 'benefits', title: 'Benefícios', slug: '/funcionalidades/beneficios', visible: true, children: [] },
    ],
  },
  {
    id: 'pricing', title: 'Preços', slug: '/precos', visible: true,
    children: [],
  },
  {
    id: 'blog', title: 'Blog', slug: '/blog', visible: true,
    children: [],
  },
  {
    id: 'contact', title: 'Contato', slug: '/contato', visible: true,
    children: [],
  },
];

export default function WebsiteStructure() {
  const [tree, setTree] = useState<SiteNode[]>(INITIAL_TREE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['about', 'features']));

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleVisibility = useCallback((id: string) => {
    const toggle = (nodes: SiteNode[]): SiteNode[] =>
      nodes.map((n) =>
        n.id === id
          ? { ...n, visible: !n.visible }
          : { ...n, children: toggle(n.children) },
      );
    setTree(toggle);
  }, []);

  const removeNode = useCallback((id: string) => {
    const remove = (nodes: SiteNode[]): SiteNode[] =>
      nodes.filter((n) => n.id !== id).map((n) => ({ ...n, children: remove(n.children) }));
    setTree(remove);
  }, []);

  const addChild = useCallback((parentId: string) => {
    const newNode: SiteNode = {
      id: `page-${Date.now()}`,
      title: 'Nova Página',
      slug: '/nova-pagina',
      visible: true,
      children: [],
    };
    const add = (nodes: SiteNode[]): SiteNode[] =>
      nodes.map((n) =>
        n.id === parentId
          ? { ...n, children: [...n.children, newNode] }
          : { ...n, children: add(n.children) },
      );
    setTree(add);
    setExpanded((prev) => new Set(prev).add(parentId));
  }, []);

  const addRoot = () => {
    setTree((prev) => [
      ...prev,
      {
        id: `page-${Date.now()}`,
        title: 'Nova Página',
        slug: '/nova-pagina',
        visible: true,
        children: [],
      },
    ]);
  };

  const totalPages = countPages(tree);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Estrutura do Website</h1>
            <p className="text-sm text-muted-foreground">{totalPages} páginas na hierarquia</p>
          </div>
        </div>
        <Button size="sm" onClick={addRoot} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nova Página
        </Button>
      </div>

      <div className="rounded-lg border border-border/60 bg-card/60">
        <ScrollArea className="max-h-[calc(100vh-16rem)]">
          <div className="p-4 space-y-0.5">
            {tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggleExpand={toggleExpand}
                onToggleVisibility={toggleVisibility}
                onRemove={removeNode}
                onAddChild={addChild}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggleExpand,
  onToggleVisibility,
  onRemove,
  onAddChild,
}: {
  node: SiteNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onRemove: (id: string) => void;
  onAddChild: (parentId: string) => void;
}) {
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div
        className={`flex items-center gap-2 group rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors ${
          !node.visible ? 'opacity-50' : ''
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab" />

        {hasChildren ? (
          <button onClick={() => onToggleExpand(node.id)} className="p-0.5">
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-[18px]" />
        )}

        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />

        <span className="text-sm font-medium text-foreground flex-1 truncate">{node.title}</span>

        <Badge variant="outline" className="text-[10px] font-mono">
          {node.slug}
        </Badge>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onToggleVisibility(node.id)} className="p-1 rounded hover:bg-muted" title="Visibilidade">
            {node.visible ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <button onClick={() => onAddChild(node.id)} className="p-1 rounded hover:bg-muted" title="Adicionar subpágina">
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => onRemove(node.id)} className="p-1 rounded hover:bg-destructive/10" title="Remover">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      </div>

      {isOpen &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onToggleVisibility={onToggleVisibility}
            onRemove={onRemove}
            onAddChild={onAddChild}
          />
        ))}
    </>
  );
}

function countPages(nodes: SiteNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countPages(n.children), 0);
}
