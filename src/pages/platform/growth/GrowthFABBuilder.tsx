/**
 * GrowthFABBuilder — Visual editor for landing page sections with drag-and-drop + live preview.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  GripVertical, Plus, Trash2, Eye, EyeOff, Sparkles,
  Layout, Type, Star, CreditCard, MessageSquare, HelpCircle, ArrowDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { fabContentEngine } from '@/domains/platform-growth';
import type { FABBlock, FABBlockType, FABContent } from '@/domains/platform-growth/types';
import { LandingPageRenderer } from '@/components/landing/LandingPageRenderer';

const BLOCK_META: Record<FABBlockType, { label: string; icon: typeof Layout; color: string }> = {
  hero: { label: 'Hero', icon: Type, color: 'hsl(265 80% 55%)' },
  features: { label: 'Features', icon: Star, color: 'hsl(200 70% 50%)' },
  pricing: { label: 'Pricing', icon: CreditCard, color: 'hsl(145 60% 42%)' },
  testimonials: { label: 'Testimonials', icon: MessageSquare, color: 'hsl(30 90% 55%)' },
  cta: { label: 'CTA', icon: Sparkles, color: 'hsl(340 75% 55%)' },
  faq: { label: 'FAQ', icon: HelpCircle, color: 'hsl(50 80% 50%)' },
  stats: { label: 'Stats', icon: Layout, color: 'hsl(0 70% 55%)' },
  custom: { label: 'Custom', icon: Layout, color: 'hsl(180 60% 45%)' },
};

function createDefaultFAB(): FABContent {
  return { feature: '', advantage: '', benefit: '' };
}

function createBlock(type: FABBlockType, order: number): FABBlock {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    order,
    fab: createDefaultFAB(),
    content: {},
  };
}

export default function GrowthFABBuilder() {
  const [blocks, setBlocks] = useState<FABBlock[]>(() => [
    createBlock('hero', 0),
    createBlock('features', 1),
    createBlock('pricing', 2),
    createBlock('testimonials', 3),
    createBlock('cta', 4),
    createBlock('faq', 5),
  ]);

  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [industry, setIndustry] = useState('tech');

  const blueprint = useMemo(() => fabContentEngine.generateBlueprint(industry, []), [industry]);

  const selected = blocks.find(b => b.id === selectedBlock);

  const moveBlock = useCallback((fromIdx: number, toIdx: number) => {
    setBlocks(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next.map((b, i) => ({ ...b, order: i }));
    });
  }, []);

  const addBlock = (type: FABBlockType) => {
    setBlocks(prev => [...prev, createBlock(type, prev.length)]);
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id).map((b, i) => ({ ...b, order: i })));
    if (selectedBlock === id) setSelectedBlock(null);
  };

  const updateFAB = (id: string, field: keyof FABContent, value: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === id ? { ...b, fab: { ...b.fab, [field]: value } } : b
    ));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">FAB Builder</h1>
            <p className="text-sm text-muted-foreground">Editor visual de seções com drag-and-drop.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            placeholder="Indústria"
            className="w-32 h-8 text-xs"
          />
          <Button variant="outline" size="sm" onClick={() => setShowPreview(p => !p)} className="gap-1.5">
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? 'Editor' : 'Preview'}
          </Button>
        </div>
      </div>

      {showPreview ? (
        /* ── Live Preview ── */
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-y-auto">
              <LandingPageRenderer blueprint={blueprint} industry={industry} />
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ── Editor ── */
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Block list (drag-and-drop) */}
          <div className="lg:col-span-1 space-y-3">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Seções</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {blocks.map((block, idx) => {
                  const meta = BLOCK_META[block.type];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={block.id}
                      draggable
                      onDragStart={() => setDragIdx(idx)}
                      onDragOver={e => { e.preventDefault(); }}
                      onDrop={() => { if (dragIdx !== null && dragIdx !== idx) moveBlock(dragIdx, idx); setDragIdx(null); }}
                      onDragEnd={() => setDragIdx(null)}
                      onClick={() => setSelectedBlock(block.id)}
                      className={cn(
                        'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all',
                        selectedBlock === block.id
                          ? 'border-[hsl(265_60%_50%/0.5)] bg-[hsl(265_60%_50%/0.06)]'
                          : 'border-border/50 bg-muted/20 hover:border-border',
                        dragIdx === idx && 'opacity-50'
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                      <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${meta.color}18` }}>
                        <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                      </div>
                      <span className="text-xs font-medium text-foreground flex-1">{meta.label}</span>
                      <Badge variant="secondary" className="text-[9px]">#{idx + 1}</Badge>
                      <button
                        onClick={e => { e.stopPropagation(); removeBlock(block.id); }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}

                {/* Add block */}
                <div className="pt-2 border-t border-border/40">
                  <p className="text-[10px] text-muted-foreground mb-2">Adicionar seção:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(BLOCK_META) as FABBlockType[]).map(type => {
                      const meta = BLOCK_META[type];
                      return (
                        <button
                          key={type}
                          onClick={() => addBlock(type)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/30 border border-border/50 text-[10px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                        >
                          <Plus className="h-2.5 w-2.5" />{meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FAB Editor panel */}
          <div className="lg:col-span-2">
            {selected ? (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {(() => { const Icon = BLOCK_META[selected.type].icon; return <Icon className="h-4 w-4" style={{ color: BLOCK_META[selected.type].color }} />; })()}
                    {BLOCK_META[selected.type].label} — FAB Content
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Feature <span className="text-muted-foreground">(O que é)</span></label>
                    <Input
                      value={selected.fab.feature}
                      onChange={e => updateFAB(selected.id, 'feature', e.target.value)}
                      placeholder="Ex: Multi-tenant avançado"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Advantage <span className="text-muted-foreground">(Por que importa)</span></label>
                    <Input
                      value={selected.fab.advantage}
                      onChange={e => updateFAB(selected.id, 'advantage', e.target.value)}
                      placeholder="Ex: Gestão centralizada de múltiplas empresas"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Benefit <span className="text-muted-foreground">(Resultado para o cliente)</span></label>
                    <Textarea
                      value={selected.fab.benefit}
                      onChange={e => updateFAB(selected.id, 'benefit', e.target.value)}
                      placeholder="Ex: Redução de 60% nos custos operacionais"
                      className="text-sm min-h-[60px]"
                    />
                  </div>

                  {/* Visual FAB card preview */}
                  {(selected.fab.feature || selected.fab.advantage || selected.fab.benefit) && (
                    <div className="p-4 rounded-lg bg-muted/20 border border-border/40 space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Preview FAB</p>
                      {selected.fab.feature && (
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">F</Badge>
                          <p className="text-xs text-foreground">{selected.fab.feature}</p>
                        </div>
                      )}
                      {selected.fab.advantage && (
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 border-amber-500/30 text-amber-400">A</Badge>
                          <p className="text-xs text-foreground">{selected.fab.advantage}</p>
                        </div>
                      )}
                      {selected.fab.benefit && (
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 border-emerald-500/30 text-emerald-400">B</Badge>
                          <p className="text-xs text-foreground">{selected.fab.benefit}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/60 border-dashed">
                <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                  <ArrowDown className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Selecione uma seção para editar o conteúdo FAB.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Arraste para reordenar as seções.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
