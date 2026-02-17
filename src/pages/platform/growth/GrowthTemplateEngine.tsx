/**
 * GrowthTemplateEngine — Landing Template Engine page with template selection,
 * drag-and-drop section reordering, and live preview.
 */
import { useState, useCallback, useMemo } from 'react';
import {
  GripVertical, Eye, EyeOff, Rocket, Building2, Zap, Gift,
  Sparkles, Layout, ChevronRight, ToggleLeft, ToggleRight, Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  landingTemplateEngine,
  type LandingTemplate,
  type TemplateSection,
  type TemplateSectionType,
} from '@/domains/platform-growth/landing-template-engine';
import { LandingPageRenderer } from '@/components/landing/LandingPageRenderer';

// ── Icon map ─────────────────────────────────────────────────
const TEMPLATE_ICONS: Record<string, typeof Rocket> = {
  Rocket, Building2, Zap, Gift,
};

const SECTION_ICONS: Record<TemplateSectionType, { icon: typeof Layout; color: string }> = {
  hero:         { icon: Rocket,    color: 'hsl(265 80% 55%)' },
  fab:          { icon: Sparkles,  color: 'hsl(200 70% 50%)' },
  pricing:      { icon: Layout,    color: 'hsl(145 60% 42%)' },
  referral_cta: { icon: Gift,      color: 'hsl(340 75% 55%)' },
  testimonials: { icon: Building2, color: 'hsl(30 90% 55%)' },
  faq:          { icon: Layout,    color: 'hsl(50 80% 50%)' },
  footer:       { icon: Layout,    color: 'hsl(0 0% 50%)' },
};

export default function GrowthTemplateEngine() {
  const templates = landingTemplateEngine.getAll();
  const [selectedId, setSelectedId] = useState<string>(templates[0].id);
  const [customSections, setCustomSections] = useState<Record<string, TemplateSection[]>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const selected = landingTemplateEngine.getById(selectedId)!;
  const sections = customSections[selectedId] ?? selected.sections;

  const blueprint = useMemo(
    () => landingTemplateEngine.generateBlueprint(selectedId),
    [selectedId]
  );

  const updateSections = useCallback((newSections: TemplateSection[]) => {
    setCustomSections(prev => ({ ...prev, [selectedId]: newSections }));
  }, [selectedId]);

  const moveSection = useCallback((fromIdx: number, toIdx: number) => {
    const next = [...sections];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    updateSections(next);
  }, [sections, updateSections]);

  const toggleSection = useCallback((sectionId: string) => {
    const next = sections.map(s =>
      s.id === sectionId && !s.locked ? { ...s, enabled: !s.enabled } : s
    );
    updateSections(next);
  }, [sections, updateSections]);

  const enabledCount = sections.filter(s => s.enabled).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
            <Layout className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Template Engine</h1>
            <p className="text-sm text-muted-foreground">Templates pré-construídos com drag-and-drop.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowPreview(p => !p)} className="gap-1.5">
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showPreview ? 'Editor' : 'Preview'}
        </Button>
      </div>

      {showPreview ? (
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0">
            <div className="max-h-[75vh] overflow-y-auto">
              <LandingPageRenderer
                blueprint={blueprint}
                industry={selected.defaultIndustry}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* ── Template Selector ── */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Templates disponíveis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {templates.map(tpl => {
                  const Icon = TEMPLATE_ICONS[tpl.icon] ?? Layout;
                  const isActive = tpl.id === selectedId;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedId(tpl.id)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left',
                        isActive
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border/50 bg-muted/20 hover:border-border'
                      )}
                    >
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `${tpl.color}15` }}
                      >
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

          {/* ── Section Editor (drag-and-drop) ── */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {(() => { const I = TEMPLATE_ICONS[selected.icon] ?? Layout; return <I className="h-4 w-4" style={{ color: selected.color }} />; })()}
                    {selected.name} — Seções
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    {enabledCount} ativa{enabledCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {sections.map((section, idx) => {
                  const meta = SECTION_ICONS[section.type];
                  const SIcon = meta.icon;
                  return (
                    <div
                      key={section.id}
                      draggable={!section.locked}
                      onDragStart={() => setDragIdx(idx)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => {
                        if (dragIdx !== null && dragIdx !== idx) moveSection(dragIdx, idx);
                        setDragIdx(null);
                      }}
                      onDragEnd={() => setDragIdx(null)}
                      className={cn(
                        'flex items-center gap-2.5 p-3 rounded-lg border transition-all',
                        section.enabled
                          ? 'border-border/50 bg-card/60'
                          : 'border-border/30 bg-muted/10 opacity-50',
                        dragIdx === idx && 'opacity-40',
                        section.locked && 'cursor-default'
                      )}
                    >
                      {/* Drag handle */}
                      {section.locked ? (
                        <Lock className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      ) : (
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                      )}

                      {/* Icon */}
                      <div
                        className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: `${meta.color}15` }}
                      >
                        <SIcon className="h-4 w-4" style={{ color: meta.color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{section.label}</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">#{idx + 1}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{section.description}</p>
                      </div>

                      {/* Toggle */}
                      {!section.locked && (
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="p-1 rounded hover:bg-muted/30 transition-colors"
                          title={section.enabled ? 'Desativar seção' : 'Ativar seção'}
                        >
                          {section.enabled ? (
                            <ToggleRight className="h-5 w-5 text-primary" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Summary */}
                <div className="pt-3 border-t border-border/40 mt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Indústria: <span className="font-medium text-foreground">{selected.defaultIndustry}</span> · 
                        Módulos: <span className="font-medium text-foreground">{selected.defaultModules.join(', ')}</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5"
                      onClick={() => setShowPreview(true)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Visualizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Template info card */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Dica:</strong> Arraste as seções para reordenar.
                  Use o toggle para ativar/desativar seções opcionais. Seções com <Lock className="inline h-3 w-3 text-muted-foreground/60" /> são obrigatórias.
                  Clique em <strong>Preview</strong> para ver o resultado final com o Design System aplicado.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
