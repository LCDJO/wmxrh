/**
 * MenuMobilePreview — Shows how the menu tree renders as:
 * 1. Desktop horizontal navbar (with dropdowns)
 * 2. Mobile drawer (accordion-style)
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Menu, X, Monitor, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { MenuTreeNode } from '@/domains/menu-structure/types';

interface MenuMobilePreviewProps {
  tree: MenuTreeNode[];
}

/* ─── Desktop Navbar ─── */
function DesktopNavbar({ tree }: { tree: MenuTreeNode[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border/50 bg-card/80 overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border/40">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
        </div>
        <div className="flex-1 mx-8 h-5 rounded bg-muted/80 border border-border/30 flex items-center px-2">
          <span className="text-[9px] text-muted-foreground font-mono">https://app.example.com</span>
        </div>
      </div>

      {/* Navbar */}
      <div className="flex items-center gap-1 px-4 py-2 bg-background border-b border-border/30">
        <div className="w-6 h-6 rounded bg-primary/20 mr-3 shrink-0" />
        {tree.map(node => {
          const hasChildren = node.children && node.children.length > 0;
          const isOpen = openId === node.id;
          return (
            <div key={node.id} className="relative">
              <button
                onClick={() => setOpenId(isOpen ? null : node.id)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors',
                  isOpen ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:text-foreground hover:bg-muted/50',
                )}
              >
                {node.label}
                {hasChildren && <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />}
              </button>

              {/* Dropdown */}
              {hasChildren && isOpen && (
                <div className="absolute top-full left-0 mt-1 min-w-[180px] rounded-lg border border-border/50 bg-popover shadow-lg z-10 py-1 animate-fade-in">
                  {node.children!.map(child => (
                    <div key={child.id} className="px-3 py-1.5 text-[11px] text-foreground/80 hover:bg-accent/50 cursor-pointer rounded-sm mx-1">
                      {child.label}
                      {child.children && child.children.length > 0 && (
                        <span className="text-[9px] text-muted-foreground ml-1">({child.children.length})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Page body placeholder */}
      <div className="h-32 bg-background flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground">Conteúdo da página</span>
      </div>
    </div>
  );
}

/* ─── Mobile Drawer ─── */
function MobileDrawer({ tree }: { tree: MenuTreeNode[] }) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderItems = (nodes: MenuTreeNode[], depth: number) =>
    nodes.map(node => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedIds.has(node.id);
      return (
        <div key={node.id}>
          <button
            onClick={() => hasChildren && toggle(node.id)}
            className={cn(
              'w-full flex items-center justify-between py-2.5 text-[12px] font-medium transition-colors',
              depth === 0 ? 'text-foreground' : 'text-foreground/70',
              hasChildren && 'hover:text-primary',
            )}
            style={{ paddingLeft: depth * 16 }}
          >
            <span>{node.label}</span>
            {hasChildren && (
              <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
            )}
          </button>
          {hasChildren && isExpanded && (
            <div className="border-l border-border/30 ml-3">
              {renderItems(node.children!, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="max-w-[320px] mx-auto">
      <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden shadow-lg">
        {/* Phone status bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-muted/60 border-b border-border/40">
          <span className="text-[9px] text-muted-foreground font-medium">9:41</span>
          <div className="flex gap-1">
            <div className="w-3 h-2 rounded-sm bg-muted-foreground/30" />
            <div className="w-3 h-2 rounded-sm bg-muted-foreground/30" />
            <div className="w-4 h-2 rounded-sm bg-muted-foreground/30" />
          </div>
        </div>

        {/* App header */}
        <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border/30">
          <div className="w-5 h-5 rounded bg-primary/20" />
          <span className="text-[11px] font-semibold text-foreground">App</span>
          <button onClick={() => setIsOpen(!isOpen)} className="p-1 rounded hover:bg-muted/50">
            {isOpen ? <X className="h-4 w-4 text-muted-foreground" /> : <Menu className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>

        {/* Drawer */}
        {isOpen ? (
          <div className="px-4 py-2 bg-background max-h-[350px] overflow-y-auto">
            {renderItems(tree, 0)}
          </div>
        ) : (
          <div className="h-40 bg-background flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">Toque ☰ para abrir</span>
          </div>
        )}

        {/* Home indicator */}
        <div className="flex justify-center py-2 bg-background">
          <div className="w-24 h-1 rounded-full bg-muted-foreground/20" />
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export function MenuMobilePreview({ tree }: MenuMobilePreviewProps) {
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView('desktop')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            view === 'desktop' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50',
          )}
        >
          <Monitor className="h-3.5 w-3.5" />Desktop Navbar
        </button>
        <button
          onClick={() => setView('mobile')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            view === 'mobile' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50',
          )}
        >
          <Smartphone className="h-3.5 w-3.5" />Mobile Drawer
        </button>
        <Badge variant="secondary" className="text-[9px] ml-auto">{tree.length} itens raiz</Badge>
      </div>

      {/* Preview */}
      {view === 'desktop' ? <DesktopNavbar tree={tree} /> : <MobileDrawer tree={tree} />}
    </div>
  );
}
