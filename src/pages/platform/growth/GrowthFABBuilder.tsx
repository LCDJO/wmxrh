/**
 * GrowthFABBuilder — Visual editor for landing page sections with drag-and-drop,
 * integrated template selection, and save-as-draft flow.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  GripVertical, Plus, Trash2, Eye, EyeOff, Sparkles, Save, Send,
  Layout, Type, Star, CreditCard, MessageSquare, HelpCircle, ArrowDown,
  LayoutTemplate, ChevronRight, ToggleLeft, ToggleRight, Lock, Gift,
  Rocket, Building2, Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { fabContentEngine, landingPageBuilder } from '@/domains/platform-growth';
import {
  landingTemplateEngine,
  type LandingTemplate,
  type TemplateSection,
  type TemplateSectionType,
} from '@/domains/platform-growth/landing-template-engine';
import type { FABBlock, FABBlockType, FABContent } from '@/domains/platform-growth/types';
import { LandingPageRenderer } from '@/components/landing/LandingPageRenderer';
import { landingPageGovernance } from '@/domains/platform-growth/landing-page-governance';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { hasPlatformPermission } from '@/domains/platform/platform-permissions';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ── Block metadata ──
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

// ── Template metadata ──
const TEMPLATE_ICONS: Record<string, typeof Rocket> = { Rocket, Building2, Zap, Gift };
const SECTION_ICONS: Record<TemplateSectionType, { icon: typeof Layout; color: string }> = {
  hero:         { icon: Rocket,    color: 'hsl(265 80% 55%)' },
  fab:          { icon: Sparkles,  color: 'hsl(200 70% 50%)' },
  pricing:      { icon: Layout,    color: 'hsl(145 60% 42%)' },
  referral_cta: { icon: Gift,      color: 'hsl(340 75% 55%)' },
  testimonials: { icon: Building2, color: 'hsl(30 90% 55%)' },
  faq:          { icon: Layout,    color: 'hsl(50 80% 50%)' },
  footer:       { icon: Layout,    color: 'hsl(0 0% 50%)' },
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { identity } = usePlatformIdentity();
  const canSubmit = hasPlatformPermission(identity?.role, 'landing_page.submit');
  const canPublishAutonomously = hasPlatformPermission(identity?.role, 'landing_page.approve') && hasPlatformPermission(identity?.role, 'landing_page.publish');

  // ── FAB Editor state ──
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
  const [lpName, setLpName] = useState('');
  const [lpSlug, setLpSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  // ── Template state ──
  const templates = landingTemplateEngine.getAll();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0].id);
  const [customSections, setCustomSections] = useState<Record<string, TemplateSection[]>>({});
  const [templateDragIdx, setTemplateDragIdx] = useState<number | null>(null);

  const selectedTemplate = landingTemplateEngine.getById(selectedTemplateId)!;
  const templateSections = customSections[selectedTemplateId] ?? selectedTemplate.sections;

  const blueprint = useMemo(() => fabContentEngine.generateBlueprint(industry, []), [industry]);
  const templateBlueprint = useMemo(() => landingTemplateEngine.generateBlueprint(selectedTemplateId), [selectedTemplateId]);

  const selected = blocks.find(b => b.id === selectedBlock);

  // ── FAB Editor handlers ──
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

  // ── Template handlers ──
  const updateTemplateSections = useCallback((newSections: TemplateSection[]) => {
    setCustomSections(prev => ({ ...prev, [selectedTemplateId]: newSections }));
  }, [selectedTemplateId]);

  const moveTemplateSection = useCallback((fromIdx: number, toIdx: number) => {
    const next = [...templateSections];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    updateTemplateSections(next);
  }, [templateSections, updateTemplateSections]);

  const toggleTemplateSection = useCallback((sectionId: string) => {
    const next = templateSections.map(s =>
      s.id === sectionId && !s.locked ? { ...s, enabled: !s.enabled } : s
    );
    updateTemplateSections(next);
  }, [templateSections, updateTemplateSections]);

  // ── Save as draft ──
  const handleSave = async () => {
    if (!lpName.trim()) {
      toast.error('Informe um nome para a Landing Page');
      return;
    }
    const slug = lpSlug.trim() || lpName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    setSaving(true);
    try {
      await landingPageBuilder.create({
        name: lpName.trim(),
        slug,
        blocks,
      });
      toast.success('Landing Page salva como rascunho!', {
        description: 'Acesse Landing Pages para revisar e autorizar publicação.',
      });
      navigate('/platform/growth/landing-pages');
    } catch (err) {
      toast.error('Erro ao salvar Landing Page');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFromTemplate = async () => {
    if (!lpName.trim()) {
      toast.error('Informe um nome para a Landing Page');
      return;
    }
    const slug = lpSlug.trim() || lpName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    setSaving(true);
    try {
      const enabledSections = templateSections.filter(s => s.enabled);
      const templateBlocks: FABBlock[] = enabledSections.map((s, i) => ({
        id: s.id,
        type: s.type === 'fab' ? 'features' : s.type === 'referral_cta' ? 'cta' : s.type as FABBlockType,
        order: i,
        fab: createDefaultFAB(),
        content: {},
      }));

      await landingPageBuilder.create({
        name: lpName.trim(),
        slug,
        blocks: templateBlocks,
      });
      toast.success('Landing Page criada a partir do template!', {
        description: 'Salva como rascunho. Acesse Landing Pages para revisar.',
      });
      navigate('/platform/growth/landing-pages');
    } catch (err) {
      toast.error('Erro ao salvar Landing Page');
    } finally {
      setSaving(false);
    }
  };

  /** Submit landing page for director approval via governance engine */
  const handleSubmitForApproval = async (contentBlocks: FABBlock[]) => {
    if (!lpName.trim() || !user || !identity) {
      toast.error('Informe um nome para a Landing Page');
      return;
    }
    const slug = lpSlug.trim() || lpName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setSubmitting(true);
    try {
      // 1. Criar LP como rascunho (ou reutilizar se já existir)
      const created = await landingPageBuilder.create({
        name: lpName.trim(),
        slug,
        blocks: contentBlocks,
      });
      if (!created) throw new Error('Falha ao criar landing page');

      // 2. Submeter via governance engine (com permissões + rate limiting)
      await landingPageGovernance.submit(
        created.id,
        { userId: user.id, email: user.email ?? '', role: identity.role },
        changeSummary || undefined,
      );

      toast.success('Submissão enviada para aprovação!', {
        description: 'O Diretor de Marketing ou SuperAdmin precisam aprovar antes da publicação.',
      });
      navigate('/platform/landing/review');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao submeter para aprovação.');
    } finally {
      setSubmitting(false);
    }
  };

  const enabledCount = templateSections.filter(s => s.enabled).length;

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
            <p className="text-sm text-muted-foreground">Construa LPs com editor visual ou templates pré-prontos.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(p => !p)} className="gap-1.5">
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? 'Editor' : 'Preview'}
          </Button>
        </div>
      </div>

      {showPreview ? (
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-y-auto">
              <LandingPageRenderer blueprint={blueprint} industry={industry} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="editor" className="space-y-4">
          <TabsList>
            <TabsTrigger value="editor" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Editor FAB
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5">
              <LayoutTemplate className="h-3.5 w-3.5" /> Templates
            </TabsTrigger>
          </TabsList>

          {/* ════════════════════════════════════════════ */}
          {/* TAB: Editor FAB                              */}
          {/* ════════════════════════════════════════════ */}
          <TabsContent value="editor" className="space-y-4">
            {/* Save bar */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Nome da LP *</label>
                      <Input value={lpName} onChange={e => setLpName(e.target.value)} placeholder="Ex: LP Black Friday 2026" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Slug</label>
                      <Input value={lpSlug} onChange={e => setLpSlug(e.target.value)} placeholder="auto-gerado do nome" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Indústria</label>
                      <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="tech" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button onClick={handleSave} disabled={saving} variant="outline" className="gap-1.5">
                      <Save className="h-4 w-4" />
                      {saving ? 'Salvando...' : 'Rascunho'}
                    </Button>
                    {canSubmit && (
                      <Button onClick={() => handleSubmitForApproval(blocks)} disabled={submitting} className="gap-1.5">
                        <Send className="h-4 w-4" />
                        {submitting ? 'Enviando...' : 'Submeter para Aprovação'}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Input value={changeSummary} onChange={e => setChangeSummary(e.target.value)} placeholder="Resumo das alterações (opcional)" className="h-7 text-xs flex-1" />
                  <p className="text-[10px] text-muted-foreground shrink-0">
                    {canPublishAutonomously ? 'SuperAdmin: publicação autônoma disponível.' : 'Publicação requer aprovação do Diretor.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-3 gap-4">
              {/* Block list */}
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
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => { if (dragIdx !== null && dragIdx !== idx) moveBlock(dragIdx, idx); setDragIdx(null); }}
                          onDragEnd={() => setDragIdx(null)}
                          onClick={() => setSelectedBlock(block.id)}
                          className={cn(
                            'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all',
                            selectedBlock === block.id
                              ? 'border-primary/50 bg-primary/5'
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
                          <button onClick={e => { e.stopPropagation(); removeBlock(block.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}

                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[10px] text-muted-foreground mb-2">Adicionar seção:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.keys(BLOCK_META) as FABBlockType[]).map(type => {
                          const meta = BLOCK_META[type];
                          return (
                            <button key={type} onClick={() => addBlock(type)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/30 border border-border/50 text-[10px] text-muted-foreground hover:text-foreground hover:border-border transition-colors">
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
                        <Input value={selected.fab.feature} onChange={e => updateFAB(selected.id, 'feature', e.target.value)} placeholder="Ex: Multi-tenant avançado" className="text-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground">Advantage <span className="text-muted-foreground">(Por que importa)</span></label>
                        <Input value={selected.fab.advantage} onChange={e => updateFAB(selected.id, 'advantage', e.target.value)} placeholder="Ex: Gestão centralizada de múltiplas empresas" className="text-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground">Benefit <span className="text-muted-foreground">(Resultado para o cliente)</span></label>
                        <Textarea value={selected.fab.benefit} onChange={e => updateFAB(selected.id, 'benefit', e.target.value)} placeholder="Ex: Redução de 60% nos custos operacionais" className="text-sm min-h-[60px]" />
                      </div>

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
                              <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 border-amber-500/30 text-amber-600">A</Badge>
                              <p className="text-xs text-foreground">{selected.fab.advantage}</p>
                            </div>
                          )}
                          {selected.fab.benefit && (
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 border-emerald-500/30 text-emerald-600">B</Badge>
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
          </TabsContent>

          {/* ════════════════════════════════════════════ */}
          {/* TAB: Templates                               */}
          {/* ════════════════════════════════════════════ */}
          <TabsContent value="templates" className="space-y-4">
            {/* Save bar (template) */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Nome da LP *</label>
                      <Input value={lpName} onChange={e => setLpName(e.target.value)} placeholder="Ex: LP SaaS Starter" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Slug</label>
                      <Input value={lpSlug} onChange={e => setLpSlug(e.target.value)} placeholder="auto-gerado do nome" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button onClick={handleSaveFromTemplate} disabled={saving} variant="outline" className="gap-1.5">
                      <Save className="h-4 w-4" />
                      {saving ? 'Salvando...' : 'Rascunho'}
                    </Button>
                    {canSubmit && (
                      <Button onClick={() => {
                        const enabledSections = templateSections.filter(s => s.enabled);
                        const tplBlocks: FABBlock[] = enabledSections.map((s, i) => ({
                          id: s.id,
                          type: s.type === 'fab' ? 'features' : s.type === 'referral_cta' ? 'cta' : s.type as FABBlockType,
                          order: i,
                          fab: createDefaultFAB(),
                          content: {},
                        }));
                        handleSubmitForApproval(tplBlocks);
                      }} disabled={submitting} className="gap-1.5">
                        <Send className="h-4 w-4" />
                        {submitting ? 'Enviando...' : 'Submeter para Aprovação'}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Criará uma LP com base no template selecionado. {canPublishAutonomously ? 'SuperAdmin: publicação autônoma.' : 'Requer aprovação do Diretor.'}
                </p>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-3 gap-5">
              {/* Template Selector */}
              <div className="lg:col-span-1 space-y-4">
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Templates disponíveis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {templates.map(tpl => {
                      const Icon = TEMPLATE_ICONS[tpl.icon] ?? Layout;
                      const isActive = tpl.id === selectedTemplateId;
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => setSelectedTemplateId(tpl.id)}
                          className={cn(
                            'w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left',
                            isActive ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-muted/20 hover:border-border'
                          )}
                        >
                          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${tpl.color}15` }}>
                            <Icon className="h-4 w-4" style={{ color: tpl.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{tpl.name}</span>
                              {isActive && <ChevronRight className="h-3 w-3 text-primary" />}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {tpl.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Section Editor */}
              <div className="lg:col-span-2">
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {(() => { const I = TEMPLATE_ICONS[selectedTemplate.icon] ?? Layout; return <I className="h-4 w-4" style={{ color: selectedTemplate.color }} />; })()}
                        {selectedTemplate.name} — Seções
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px]">{enabledCount} ativa{enabledCount !== 1 ? 's' : ''}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {templateSections.map((section, idx) => {
                      const meta = SECTION_ICONS[section.type];
                      const SIcon = meta.icon;
                      return (
                        <div
                          key={section.id}
                          draggable={!section.locked}
                          onDragStart={() => setTemplateDragIdx(idx)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => { if (templateDragIdx !== null && templateDragIdx !== idx) moveTemplateSection(templateDragIdx, idx); setTemplateDragIdx(null); }}
                          onDragEnd={() => setTemplateDragIdx(null)}
                          className={cn(
                            'flex items-center gap-2.5 p-3 rounded-lg border transition-all',
                            section.enabled ? 'border-border/50 bg-card/60' : 'border-border/30 bg-muted/10 opacity-50',
                            templateDragIdx === idx && 'opacity-40',
                            section.locked && 'cursor-default'
                          )}
                        >
                          {section.locked ? <Lock className="h-4 w-4 text-muted-foreground/40 shrink-0" /> : <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />}
                          <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0" style={{ background: `${meta.color}15` }}>
                            <SIcon className="h-4 w-4" style={{ color: meta.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{section.label}</span>
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">#{idx + 1}</Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{section.description}</p>
                          </div>
                          {!section.locked && (
                            <button onClick={() => toggleTemplateSection(section.id)} className="p-1 rounded hover:bg-muted/30 transition-colors">
                              {section.enabled ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
