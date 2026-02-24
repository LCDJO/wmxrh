/**
 * PdfSectionEditor — Visual drag-and-drop editor for PDF layout sections.
 * Each section (header, body, footer, margins/colors) is a draggable card
 * that can be reordered and expanded inline to edit settings.
 */
import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Type,
  FileText,
  AlignLeft,
  Palette,
  Maximize,
  QrCode,
  Eye,
  EyeOff,
  Image,
} from 'lucide-react';
import type { PdfLayoutConfig } from '@/pages/PdfLayoutSettings';

const FONT_OPTIONS = [
  'Helvetica Neue, Arial, sans-serif',
  'Georgia, Times New Roman, serif',
  'Courier New, monospace',
  'Verdana, Geneva, sans-serif',
  'Trebuchet MS, sans-serif',
  'Palatino, serif',
];

interface SectionDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const SECTIONS: SectionDef[] = [
  { id: 'header', label: 'Cabeçalho', icon: <Type className="h-4 w-4" />, color: 'bg-primary/10 border-primary/30' },
  { id: 'body', label: 'Corpo do Documento', icon: <AlignLeft className="h-4 w-4" />, color: 'bg-accent/50 border-accent' },
  { id: 'footer', label: 'Rodapé', icon: <FileText className="h-4 w-4" />, color: 'bg-secondary/50 border-secondary' },
  { id: 'colors', label: 'Cores e Tipografia', icon: <Palette className="h-4 w-4" />, color: 'bg-destructive/10 border-destructive/30' },
  { id: 'margins', label: 'Margens e Espaçamento', icon: <Maximize className="h-4 w-4" />, color: 'bg-muted border-border' },
];

interface Props {
  editData: Partial<PdfLayoutConfig>;
  onUpdate: <K extends keyof PdfLayoutConfig>(key: K, value: PdfLayoutConfig[K]) => void;
}

export function PdfSectionEditor({ editData, onUpdate }: Props) {
  const [sectionOrder, setSectionOrder] = useState<string[]>(SECTIONS.map(s => s.id));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['header']));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== draggedId) setDragOverId(id);
  };

  const handleDragLeave = () => setDragOverId(null);

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    setSectionOrder(prev => {
      const fromIdx = prev.indexOf(draggedId);
      const toIdx = prev.indexOf(targetId);
      const next = [...prev];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, draggedId);
      return next;
    });
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const orderedSections = sectionOrder.map(id => SECTIONS.find(s => s.id === id)!).filter(Boolean);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Arraste as seções para reordenar. Clique para expandir e editar.
      </p>

      {orderedSections.map(section => {
        const isExpanded = expandedSections.has(section.id);
        const isDragging = draggedId === section.id;
        const isDragOver = dragOverId === section.id;

        return (
          <div
            key={section.id}
            draggable
            onDragStart={e => handleDragStart(e, section.id)}
            onDragOver={e => handleDragOver(e, section.id)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, section.id)}
            onDragEnd={handleDragEnd}
            className={cn(
              'rounded-lg border-2 transition-all duration-200',
              section.color,
              isDragging && 'opacity-40 scale-95',
              isDragOver && 'ring-2 ring-primary ring-offset-2',
              !isDragging && 'hover:shadow-md',
            )}
          >
            {/* Section header — always visible */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
              onClick={() => toggleSection(section.id)}
            >
              <div
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                onClick={e => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 flex-1">
                {section.icon}
                <span className="font-medium text-sm">{section.label}</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {section.id === 'header' ? (editData.show_logo ? 'Com logo' : 'Sem logo') :
                 section.id === 'footer' ? (editData.show_qr_code ? 'Com QR' : 'Sem QR') :
                 section.id === 'body' ? `${editData.body_font_size || 13}px` :
                 section.id === 'colors' ? editData.primary_color || '#1a1a2e' :
                 `${editData.margin_top || 15}mm`}
              </Badge>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>

            {/* Section content — expanded */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border/50 pt-3">
                {section.id === 'header' && <HeaderSection editData={editData} onUpdate={onUpdate} />}
                {section.id === 'body' && <BodySection editData={editData} onUpdate={onUpdate} />}
                {section.id === 'footer' && <FooterSection editData={editData} onUpdate={onUpdate} />}
                {section.id === 'colors' && <ColorsSection editData={editData} onUpdate={onUpdate} />}
                {section.id === 'margins' && <MarginsSection editData={editData} onUpdate={onUpdate} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Sub-section components ────────────────────────────────── */

function HeaderSection({ editData, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nome da Empresa</Label>
          <Input size={1} value={editData.company_name_override || ''} onChange={e => onUpdate('company_name_override', e.target.value)} placeholder="Usa nome do tenant" />
        </div>
        <div>
          <Label className="text-xs">Subtítulo</Label>
          <Input size={1} value={editData.header_subtitle || ''} onChange={e => onUpdate('header_subtitle', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">URL do Logo</Label>
          <Input size={1} value={editData.logo_url || ''} onChange={e => onUpdate('logo_url', e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <Label className="text-xs">Fonte</Label>
          <Select value={editData.header_font_family} onValueChange={v => onUpdate('header_font_family', v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f.split(',')[0]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Tamanho da fonte: {editData.header_font_size || 16}px</Label>
        <Slider value={[editData.header_font_size || 16]} min={10} max={28} step={1} onValueChange={([v]) => onUpdate('header_font_size', v)} />
      </div>
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <Switch checked={editData.show_logo ?? true} onCheckedChange={v => onUpdate('show_logo', v)} />
          <Label className="text-xs">Exibir Logo</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={editData.show_date ?? true} onCheckedChange={v => onUpdate('show_date', v)} />
          <Label className="text-xs">Exibir Data</Label>
        </div>
      </div>
    </div>
  );
}

function BodySection({ editData, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Fonte do corpo</Label>
          <Select value={editData.body_font_family} onValueChange={v => onUpdate('body_font_family', v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f.split(',')[0]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Tamanho: {editData.body_font_size || 13}px</Label>
          <Slider value={[editData.body_font_size || 13]} min={9} max={20} step={0.5} onValueChange={([v]) => onUpdate('body_font_size', v)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Altura da linha: {editData.body_line_height || 1.7}</Label>
        <Slider value={[editData.body_line_height || 1.7]} min={1} max={3} step={0.1} onValueChange={([v]) => onUpdate('body_line_height', v)} />
      </div>
    </div>
  );
}

function FooterSection({ editData, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={editData.show_qr_code ?? true} onCheckedChange={v => onUpdate('show_qr_code', v)} />
          <Label className="text-xs">QR Code</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={editData.show_validator_code ?? true} onCheckedChange={v => onUpdate('show_validator_code', v)} />
          <Label className="text-xs">Código Validador</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={editData.show_page_numbers ?? true} onCheckedChange={v => onUpdate('show_page_numbers', v)} />
          <Label className="text-xs">Nº Páginas</Label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Tamanho QR: {editData.qr_code_size || 56}px</Label>
          <Slider value={[editData.qr_code_size || 56]} min={32} max={120} step={4} onValueChange={([v]) => onUpdate('qr_code_size', v)} />
        </div>
        <div>
          <Label className="text-xs">Fonte do rodapé</Label>
          <Select value={editData.footer_font_family} onValueChange={v => onUpdate('footer_font_family', v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f.split(',')[0]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Texto adicional</Label>
        <Input value={editData.footer_text || ''} onChange={e => onUpdate('footer_text', e.target.value)} placeholder="Ex: Confidencial — Uso interno" />
      </div>
    </div>
  );
}

function ColorsSection({ editData, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Cor Primária</Label>
          <div className="flex gap-2 items-center mt-1">
            <input type="color" value={editData.primary_color || '#1a1a2e'} onChange={e => onUpdate('primary_color', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
            <Input size={1} value={editData.primary_color || ''} onChange={e => onUpdate('primary_color', e.target.value)} className="flex-1 h-8 text-xs" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Texto</Label>
          <div className="flex gap-2 items-center mt-1">
            <input type="color" value={editData.text_color || '#222222'} onChange={e => onUpdate('text_color', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
            <Input size={1} value={editData.text_color || ''} onChange={e => onUpdate('text_color', e.target.value)} className="flex-1 h-8 text-xs" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Secundária</Label>
          <div className="flex gap-2 items-center mt-1">
            <input type="color" value={editData.secondary_text_color || '#666666'} onChange={e => onUpdate('secondary_text_color', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
            <Input size={1} value={editData.secondary_text_color || ''} onChange={e => onUpdate('secondary_text_color', e.target.value)} className="flex-1 h-8 text-xs" />
          </div>
        </div>
      </div>
      <div>
        <Label className="text-xs">Cor da Borda do Cabeçalho</Label>
        <div className="flex gap-2 items-center mt-1">
          <input type="color" value={editData.header_border_color || '#1a1a2e'} onChange={e => onUpdate('header_border_color', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
          <Input size={1} value={editData.header_border_color || ''} onChange={e => onUpdate('header_border_color', e.target.value)} className="flex-1 h-8 text-xs" />
        </div>
      </div>
    </div>
  );
}

function MarginsSection({ editData, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Superior: {editData.margin_top || 15}mm</Label>
          <Slider value={[editData.margin_top || 15]} min={5} max={40} step={1} onValueChange={([v]) => onUpdate('margin_top', v)} />
        </div>
        <div>
          <Label className="text-xs">Inferior: {editData.margin_bottom || 15}mm</Label>
          <Slider value={[editData.margin_bottom || 15]} min={5} max={40} step={1} onValueChange={([v]) => onUpdate('margin_bottom', v)} />
        </div>
        <div>
          <Label className="text-xs">Esquerda: {editData.margin_left || 15}mm</Label>
          <Slider value={[editData.margin_left || 15]} min={5} max={40} step={1} onValueChange={([v]) => onUpdate('margin_left', v)} />
        </div>
        <div>
          <Label className="text-xs">Direita: {editData.margin_right || 15}mm</Label>
          <Slider value={[editData.margin_right || 15]} min={5} max={40} step={1} onValueChange={([v]) => onUpdate('margin_right', v)} />
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-xs">Espaço entre seções: {editData.section_gap || 3}mm</Label>
        <Slider value={[editData.section_gap || 3]} min={0} max={15} step={1} onValueChange={([v]) => onUpdate('section_gap', v)} />
      </div>
    </div>
  );
}
