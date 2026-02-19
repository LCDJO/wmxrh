/**
 * WorkflowNodePalette — Sidebar with draggable node templates.
 */
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2, Globe, Receipt, UserPlus, Webhook, Send, CreditCard, Ticket,
  ExternalLink, GitBranch, BarChart3, Zap, Filter, Play,
} from 'lucide-react';
import { TRIGGER_NODES, ACTION_NODES, CONDITION_NODES } from './node-catalog';
import type { WfNodeTemplate } from './types';

const ICON_MAP: Record<string, typeof Zap> = {
  Building2, Globe, Receipt, UserPlus, Webhook, Send, CreditCard, Ticket,
  ExternalLink, GitBranch, BarChart3,
};

const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string; icon: typeof Zap }> = {
  trigger: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-600 dark:text-blue-400', icon: Play },
  action: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-600 dark:text-green-400', icon: Zap },
  condition: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', icon: Filter },
};

interface Props {
  onAddNode: (template: WfNodeTemplate) => void;
}

export function WorkflowNodePalette({ onAddNode }: Props) {
  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Nós Disponíveis</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">Clique para adicionar ao canvas</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          <NodeGroup title="Triggers" nodes={TRIGGER_NODES} category="trigger" onAdd={onAddNode} />
          <NodeGroup title="Actions" nodes={ACTION_NODES} category="action" onAdd={onAddNode} />
          <NodeGroup title="Conditions" nodes={CONDITION_NODES} category="condition" onAdd={onAddNode} />
        </div>
      </ScrollArea>
    </div>
  );
}

function NodeGroup({ title, nodes, category, onAdd }: {
  title: string;
  nodes: WfNodeTemplate[];
  category: string;
  onAdd: (t: WfNodeTemplate) => void;
}) {
  const style = CATEGORY_STYLES[category];
  const CategoryIcon = style.icon;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 px-1">
        <CategoryIcon className={`h-3 w-3 ${style.text}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${style.text}`}>{title}</span>
        <Badge variant="outline" className="text-[9px] ml-auto">{nodes.length}</Badge>
      </div>
      <div className="space-y-1">
        {nodes.map(node => (
          <PaletteNode key={node.key} template={node} style={style} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}

function PaletteNode({ template, style, onAdd }: {
  template: WfNodeTemplate;
  style: typeof CATEGORY_STYLES.trigger;
  onAdd: (t: WfNodeTemplate) => void;
}) {
  const Icon = ICON_MAP[template.icon] ?? Zap;

  return (
    <button
      onClick={() => onAdd(template)}
      className={`w-full flex items-center gap-2 p-2 rounded-md border ${style.border} ${style.bg} hover:opacity-80 transition-opacity text-left group`}
    >
      <div className={`shrink-0 h-6 w-6 rounded flex items-center justify-center ${style.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${style.text}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-medium ${style.text} truncate`}>{template.label}</p>
        <p className="text-[9px] text-muted-foreground truncate">{template.description}</p>
      </div>
    </button>
  );
}
