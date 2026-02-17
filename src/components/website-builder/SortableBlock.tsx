import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import type { WebsiteBlock } from '@/domains/website-builder/types';
import { BlockRenderer } from './BlockRenderer';

interface Props {
  block: WebsiteBlock;
  onRemove: (id: string) => void;
}

export function SortableBlock({ block, onRemove }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border-2 transition-colors ${
        isDragging ? 'border-primary/50 shadow-lg' : 'border-transparent hover:border-border'
      }`}
    >
      {/* Drag handle + actions */}
      <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          {...attributes}
          {...listeners}
          className="flex h-8 w-6 items-center justify-center rounded-md bg-muted border border-border shadow-sm cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="absolute -right-3 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onRemove(block.id)}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </button>
      </div>

      <BlockRenderer block={block} />
    </div>
  );
}
