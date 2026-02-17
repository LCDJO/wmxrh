import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Monitor, Smartphone, Tablet, ShieldCheck, Sparkles } from 'lucide-react';
import type { WebsiteBlock, WebsiteBlockType, Viewport } from '@/domains/website-builder/types';
import { BLOCK_DEFINITIONS } from '@/domains/website-builder/types';
import { ComponentPalette } from './ComponentPalette';
import { SortableBlock } from './SortableBlock';
import { CompliancePanel } from './CompliancePanel';
import { AIContentAdvisor } from './AIContentAdvisor';
import { ScrollArea } from '@/components/ui/scroll-area';



export function DragDropEditor() {
  const [blocks, setBlocks] = useState<WebsiteBlock[]>([]);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [showCompliance, setShowCompliance] = useState(true);
  const [showAIAdvisor, setShowAIAdvisor] = useState(true);

  const complianceOptions = useMemo(() => ({
    hasGTM: false,
    hasPrivacyLink: false,
    hasTermsLink: false,
  }), []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addBlock = useCallback((type: WebsiteBlockType) => {
    const def = BLOCK_DEFINITIONS.find((d) => d.type === type);
    if (!def) return;

    const newBlock: WebsiteBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      order: blocks.length,
      content: { ...def.defaultContent },
    };
    setBlocks((prev) => [...prev, newBlock]);
  }, [blocks.length]);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      return arrayMove(prev, oldIndex, newIndex).map((b, i) => ({ ...b, order: i }));
    });
  }, []);

  const viewportWidth = viewport === 'desktop' ? 'max-w-full' : viewport === 'tablet' ? 'max-w-2xl' : 'max-w-sm';

  return (
    <div className="flex gap-4 h-[calc(100vh-14rem)]">
      {/* Palette */}
      <ComponentPalette onAddBlock={addBlock} />

      {/* Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground font-medium">
            {blocks.length} {blocks.length === 1 ? 'seção' : 'seções'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAIAdvisor((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                showAIAdvisor ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Advisor
            </button>
            <button
              onClick={() => setShowCompliance((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                showCompliance ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Compliance
            </button>
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/60 p-0.5">
            {([
              { key: 'desktop', Icon: Monitor },
              { key: 'tablet', Icon: Tablet },
              { key: 'mobile', Icon: Smartphone },
            ] as const).map(({ key, Icon }) => (
              <button
                key={key}
                onClick={() => setViewport(key)}
                className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors ${
                  viewport === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <ScrollArea className="flex-1 rounded-xl border-2 border-dashed border-border/60 bg-background">
          <div className={`mx-auto transition-all duration-200 ${viewportWidth} p-6 space-y-4`}>
            {blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-3">
                  <Monitor className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Nenhuma seção adicionada</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Clique nos componentes à esquerda para montar o layout da página.
                </p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((block) => (
                    <SortableBlock key={block.id} block={block} viewport={viewport} onRemove={removeBlock} />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panels */}
      {showAIAdvisor && (
        <AIContentAdvisor blocks={blocks} />
      )}
      {showCompliance && blocks.length > 0 && (
        <CompliancePanel blocks={blocks} options={complianceOptions} />
      )}
    </div>
  );
}
