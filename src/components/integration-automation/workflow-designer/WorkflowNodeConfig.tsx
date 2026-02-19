/**
 * WorkflowNodeConfig — Right panel to configure selected node properties.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Link2, Settings2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { getTemplateByKey } from './node-catalog';
import type { WfCanvasNode } from './types';

interface Props {
  node: WfCanvasNode;
  onUpdate: (updated: WfCanvasNode) => void;
  onDelete: () => void;
  onStartConnect: () => void;
}

export function WorkflowNodeConfig({ node, onUpdate, onDelete, onStartConnect }: Props) {
  const template = getTemplateByKey(node.templateKey);
  if (!template) return null;

  const categoryColor = {
    trigger: 'text-blue-600 dark:text-blue-400',
    action: 'text-green-600 dark:text-green-400',
    condition: 'text-amber-600 dark:text-amber-400',
  }[node.category];

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Configurar Nó</h3>
          </div>
          <Badge variant="outline" className={`text-[9px] ${categoryColor}`}>
            {node.category.toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Node Label */}
        <div className="space-y-1.5">
          <Label className="text-xs">Nome do Nó</Label>
          <Input
            value={node.label}
            onChange={e => onUpdate({ ...node, label: e.target.value })}
            className="h-8 text-xs"
          />
        </div>

        {/* Template info */}
        <div className="rounded-md border border-border p-2 bg-muted/30">
          <p className="text-[10px] text-muted-foreground">{template.description}</p>
        </div>

        {/* Config fields */}
        {template.configFields.map(field => (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-xs">
              {field.label}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {field.type === 'select' ? (
              <Select
                value={(node.config[field.key] as string) ?? ''}
                onValueChange={v => onUpdate({ ...node, config: { ...node.config, [field.key]: v } })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map(opt => (
                    <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === 'json' ? (
              <Textarea
                value={(node.config[field.key] as string) ?? ''}
                onChange={e => onUpdate({ ...node, config: { ...node.config, [field.key]: e.target.value } })}
                className="h-20 text-xs font-mono"
                placeholder="{}"
              />
            ) : (
              <Input
                type={field.type === 'number' ? 'number' : 'text'}
                value={(node.config[field.key] as string) ?? ''}
                onChange={e => onUpdate({ ...node, config: { ...node.config, [field.key]: e.target.value } })}
                className="h-8 text-xs"
              />
            )}
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-border space-y-2">
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={onStartConnect}>
          <Link2 className="h-3.5 w-3.5" /> Conectar a outro nó
        </Button>
        <Button variant="destructive" size="sm" className="w-full gap-1.5 text-xs" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Remover Nó
        </Button>
      </div>
    </div>
  );
}
