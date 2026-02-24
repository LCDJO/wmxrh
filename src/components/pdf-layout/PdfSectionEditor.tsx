/**
 * PdfSectionEditor — Visual drag-and-drop editor for PDF layout sections.
 * Each section (header, body, footer, margins/colors) is a draggable card
 * that can be reordered and expanded inline to edit settings.
 */
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  Droplets,
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

interface SectionGroup {
  title: string;
  description: string;
  sections: SectionDef[];
}

const DOCUMENT_SECTIONS: SectionDef[] = [
  { id: 'header', label: 'Cabeçalho', icon: <Type className="h-4 w-4" />, color: 'bg-primary/10 border-primary/30' },
  { id: 'body', label: 'Corpo do Documento', icon: <AlignLeft className="h-4 w-4" />, color: 'bg-accent/50 border-accent' },
  { id: 'footer', label: 'Rodapé', icon: <FileText className="h-4 w-4" />, color: 'bg-secondary/50 border-secondary' },
];

const CUSTOMIZATION_SECTIONS: SectionDef[] = [
  { id: 'watermark', label: 'Marca d\'Água', icon: <Droplets className="h-4 w-4" />, color: 'bg-chart-4/10 border-chart-4/30' },
  { id: 'colors', label: 'Cores e Tipografia', icon: <Palette className="h-4 w-4" />, color: 'bg-destructive/10 border-destructive/30' },
  { id: 'margins', label: 'Margens e Espaçamento', icon: <Maximize className="h-4 w-4" />, color: 'bg-muted border-border' },
];

const ALL_SECTIONS = [...DOCUMENT_SECTIONS, ...CUSTOMIZATION_SECTIONS];

const SECTION_GROUPS: SectionGroup[] = [
  { title: 'Composição do Documento', description: 'Estrutura fixa que aparece em todas as páginas', sections: DOCUMENT_SECTIONS },
  { title: 'Personalização', description: 'Estilo visual e aparência do documento', sections: CUSTOMIZATION_SECTIONS },
];

interface Props {
  editData: Partial<PdfLayoutConfig>;
  onUpdate: <K extends keyof PdfLayoutConfig>(key: K, value: PdfLayoutConfig[K]) => void;
}

export function PdfSectionEditor({ editData, onUpdate }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['header']));

  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderSection = (section: SectionDef) => {
    const isExpanded = expandedSections.has(section.id);

    return (
      <div
        key={section.id}
        className={cn(
          'rounded-lg border-2 transition-all duration-200',
          section.color,
          'hover:shadow-md',
        )}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          onClick={() => toggleSection(section.id)}
        >
          <div className="flex items-center gap-2 flex-1">
            {section.icon}
            <span className="font-medium text-sm">{section.label}</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {section.id === 'header' ? (editData.show_logo ? 'Com logo' : 'Sem logo') :
             section.id === 'footer' ? (editData.show_qr_code ? 'Com QR' : 'Sem QR') :
             section.id === 'body' ? `${editData.body_font_size || 13}px` :
             section.id === 'watermark' ? (editData.watermark_enabled ? editData.watermark_type || 'text' : 'Desativada') :
             section.id === 'colors' ? editData.primary_color || '#1a1a2e' :
             `${editData.margin_top || 15}mm`}
          </Badge>
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-border/50 pt-3">
            {section.id === 'header' && <HeaderSection editData={editData} onUpdate={onUpdate} />}
            {section.id === 'body' && <BodySection editData={editData} onUpdate={onUpdate} />}
            {section.id === 'footer' && <FooterSection editData={editData} onUpdate={onUpdate} />}
            {section.id === 'watermark' && <WatermarkSection editData={editData} onUpdate={onUpdate} />}
            {section.id === 'colors' && <ColorsSection editData={editData} onUpdate={onUpdate} />}
            {section.id === 'margins' && <MarginsSection editData={editData} onUpdate={onUpdate} />}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {SECTION_GROUPS.map(group => (
        <div key={group.title}>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
            <p className="text-xs text-muted-foreground">{group.description}</p>
          </div>
          <div className="space-y-2">
            {group.sections.map(renderSection)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Logo Uploader ─────────────────────────────────────────── */

const MAX_FILE_SIZE = 512 * 1024; // 512KB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

function LogoUploader({ logoUrl, onUpload, onRemove }: { logoUrl: string; onUpload: (url: string) => void; onRemove: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Formato não suportado. Use PNG, JPG, SVG ou WebP.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Arquivo muito grande. Máximo: 512KB.');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('pdf-logos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('pdf-logos').getPublicUrl(path);
      onUpload(publicUrl);
      toast.success('Logo enviado com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar logo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {logoUrl ? (
        <div className="relative group rounded-md border border-border overflow-hidden bg-muted/30 p-2 flex items-center gap-3">
          <img src={logoUrl} alt="Logo" className="h-10 w-auto max-w-[120px] object-contain" />
          <Button variant="ghost" size="sm" className="text-xs text-destructive h-7" onClick={onRemove}>
            Remover
          </Button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer transition-colors',
            'hover:border-primary/50 hover:bg-primary/5',
            uploading && 'opacity-50 pointer-events-none',
          )}
        >
          <div className="text-muted-foreground text-xs space-y-1">
            <p className="font-medium">{uploading ? 'Enviando...' : 'Clique para enviar logo'}</p>
            <p className="text-[10px]">Tamanho ideal: 200×60px · Máx: 512KB</p>
            <p className="text-[10px]">PNG, JPG, SVG ou WebP</p>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,.webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
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
          <Label className="text-xs">Logo</Label>
          <LogoUploader
            logoUrl={editData.logo_url || ''}
            onUpload={(url) => onUpdate('logo_url', url)}
            onRemove={() => onUpdate('logo_url', null)}
          />
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

function WatermarkSection({ editData, onUpdate }: Props) {
  const wmType = editData.watermark_type || 'text';
  const enabled = editData.watermark_enabled ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={v => onUpdate('watermark_enabled', v)} />
        <Label className="text-xs font-medium">Ativar Marca d'Água</Label>
      </div>

      {enabled && (
        <>
          {/* Type selector */}
          <div>
            <Label className="text-xs">Tipo</Label>
            <div className="flex gap-2 mt-1">
              {[
                { value: 'text', label: 'Texto' },
                { value: 'image', label: 'Imagem' },
                { value: 'background', label: 'Fundo' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdate('watermark_type', opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    wmType === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/50',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text watermark */}
          {wmType === 'text' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Texto da Marca d'Água</Label>
                <Input
                  value={editData.watermark_text || ''}
                  onChange={e => onUpdate('watermark_text', e.target.value)}
                  placeholder="Ex: CONFIDENCIAL, RASCUNHO, CÓPIA"
                />
              </div>
              <div>
                <Label className="text-xs">Tamanho da fonte: {editData.watermark_font_size || 60}px</Label>
                <Slider value={[editData.watermark_font_size || 60]} min={20} max={120} step={2} onValueChange={([v]) => onUpdate('watermark_font_size', v)} />
              </div>
            </div>
          )}

          {/* Image watermark */}
          {wmType === 'image' && (
            <div>
              <Label className="text-xs">URL da Imagem</Label>
              <Input
                value={editData.watermark_image_url || ''}
                onChange={e => onUpdate('watermark_image_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}

          {/* Background watermark */}
          {wmType === 'background' && (
            <div>
              <Label className="text-xs">Cor ou URL do Fundo</Label>
              <Input
                value={editData.watermark_image_url || ''}
                onChange={e => onUpdate('watermark_image_url', e.target.value)}
                placeholder="URL da imagem de fundo ou cor hex"
              />
            </div>
          )}

          {/* Common settings */}
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Opacidade: {Math.round((editData.watermark_opacity || 0.08) * 100)}%</Label>
              <Slider value={[editData.watermark_opacity || 0.08]} min={0.01} max={0.5} step={0.01} onValueChange={([v]) => onUpdate('watermark_opacity', v)} />
            </div>
            <div>
              <Label className="text-xs">Rotação: {editData.watermark_rotation || -30}°</Label>
              <Slider value={[editData.watermark_rotation ?? -30]} min={-90} max={90} step={5} onValueChange={([v]) => onUpdate('watermark_rotation', v)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Cor</Label>
              <div className="flex gap-2 items-center mt-1">
                <input type="color" value={editData.watermark_color || '#000000'} onChange={e => onUpdate('watermark_color', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
                <Input size={1} value={editData.watermark_color || '#000000'} onChange={e => onUpdate('watermark_color', e.target.value)} className="flex-1 h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Posição</Label>
              <Select value={editData.watermark_position || 'center'} onValueChange={v => onUpdate('watermark_position', v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="tiled">Repetida (tiled)</SelectItem>
                  <SelectItem value="top-left">Topo Esquerdo</SelectItem>
                  <SelectItem value="top-right">Topo Direito</SelectItem>
                  <SelectItem value="bottom-left">Inferior Esquerdo</SelectItem>
                  <SelectItem value="bottom-right">Inferior Direito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
