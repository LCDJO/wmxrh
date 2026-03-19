/**
 * PDF Layout Settings — Full config page with versioning, preview, and active/inactive toggle.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Save, Copy, Trash2, FileText, Eye, Pencil } from 'lucide-react';
import { PdfLayoutPreview } from '@/components/pdf-layout/PdfLayoutPreview';
import { PdfSectionEditor } from '@/components/pdf-layout/PdfSectionEditor';

export interface PdfLayoutConfig {
  id: string;
  tenant_id: string;
  name: string;
  version_number: number;
  is_active: boolean;
  logo_url: string | null;
  company_name_override: string | null;
  header_subtitle: string | null;
  header_border_color: string;
  show_logo: boolean;
  show_date: boolean;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  section_gap: number;
  header_font_family: string;
  body_font_family: string;
  footer_font_family: string;
  header_font_size: number;
  body_font_size: number;
  footer_font_size: number;
  body_line_height: number;
  show_qr_code: boolean;
  show_validator_code: boolean;
  show_page_numbers: boolean;
  footer_position: string;
  qr_code_size: number;
  footer_text: string | null;
  primary_color: string;
  text_color: string;
  secondary_text_color: string;
  watermark_enabled: boolean;
  watermark_type: string;
  watermark_text: string | null;
  watermark_image_url: string | null;
  watermark_opacity: number;
  watermark_rotation: number;
  watermark_font_size: number;
  watermark_color: string;
  watermark_position: string;
  created_at: string;
  updated_at: string;
  page_size: string;
  qr_position: string;
  pagination_location: string;
  header_extra_text: string | null;
  footer_show_doc_name: boolean;
  footer_show_validator_link: boolean;
}

const DEFAULT_LAYOUT: Omit<PdfLayoutConfig, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> = {
  name: 'Layout Padrão',
  version_number: 1,
  is_active: false,
  logo_url: null,
  company_name_override: null,
  header_subtitle: 'Documento Oficial',
  header_border_color: '#1a1a2e',
  show_logo: true,
  show_date: true,
  margin_top: 15,
  margin_bottom: 15,
  margin_left: 15,
  margin_right: 15,
  section_gap: 3,
  header_font_family: 'Helvetica Neue, Arial, sans-serif',
  body_font_family: 'Georgia, Times New Roman, serif',
  footer_font_family: 'Helvetica Neue, Arial, sans-serif',
  header_font_size: 16,
  body_font_size: 13,
  footer_font_size: 9,
  body_line_height: 1.7,
  show_qr_code: true,
  show_validator_code: true,
  show_page_numbers: true,
  footer_position: 'bottom',
  qr_code_size: 56,
  footer_text: null,
  primary_color: '#1a1a2e',
  text_color: '#222222',
  secondary_text_color: '#666666',
  watermark_enabled: false,
  watermark_type: 'text',
  watermark_text: null,
  watermark_image_url: null,
  watermark_opacity: 0.08,
  watermark_rotation: -30,
  watermark_font_size: 60,
  watermark_color: '#000000',
  watermark_position: 'center',
  page_size: 'a4',
  qr_position: 'left',
  pagination_location: 'footer',
  header_extra_text: null,
  footer_show_doc_name: false,
  footer_show_validator_link: false,
};

const FONT_OPTIONS = [
  'Helvetica Neue, Arial, sans-serif',
  'Georgia, Times New Roman, serif',
  'Courier New, monospace',
  'Verdana, Geneva, sans-serif',
  'Trebuchet MS, sans-serif',
  'Palatino, serif',
];

export default function PdfLayoutSettings() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<PdfLayoutConfig> | null>(null);

  const { data: layouts = [], isLoading } = useQuery({
    queryKey: ['pdf-layouts', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('pdf_layout_configs')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PdfLayoutConfig[];
    },
    enabled: !!currentTenant?.id,
  });

  const selected = layouts.find(l => l.id === selectedId);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<PdfLayoutConfig>) => {
      if (data.id) {
        const { error } = await supabase.from('pdf_layout_configs').update(data).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pdf_layout_configs').insert({
          ...DEFAULT_LAYOUT,
          ...data,
          tenant_id: currentTenant!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-layouts'] });
      toast.success('Layout salvo com sucesso');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao salvar'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('pdf_layout_configs').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-layouts'] });
      queryClient.invalidateQueries({ queryKey: ['pdf_layouts_picker'] });
      toast.success('Status atualizado');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pdf_layout_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-layouts'] });
      setSelectedId(null);
      setEditData(null);
      toast.success('Layout removido');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (source: PdfLayoutConfig) => {
      const { id, created_at, updated_at, ...rest } = source;
      const maxVersion = Math.max(...layouts.filter(l => l.name === source.name).map(l => l.version_number), 0);
      const { error } = await supabase.from('pdf_layout_configs').insert({
        ...rest,
        is_active: false,
        version_number: maxVersion + 1,
        name: `${source.name} (cópia)`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-layouts'] });
      toast.success('Layout duplicado');
    },
  });

  function handleSelect(layout: PdfLayoutConfig) {
    setSelectedId(layout.id);
    setEditData({ ...layout });
  }

  function handleCreate() {
    setSelectedId(null);
    setEditData({ ...DEFAULT_LAYOUT, name: `Layout v${layouts.length + 1}` });
  }

  function handleSave() {
    if (!editData) return;
    saveMutation.mutate(editData);
  }

  function updateField<K extends keyof PdfLayoutConfig>(key: K, value: PdfLayoutConfig[K]) {
    setEditData(prev => prev ? { ...prev, [key]: value } : null);
  }

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Carregando layouts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Layout do PDF</h1>
          <p className="text-muted-foreground">Configure e versione layouts para documentos PDF</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Layout
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel — list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Versões
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {layouts.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum layout criado ainda.</p>
            )}
            {layouts.map(layout => (
              <div
                key={layout.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedId === layout.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                }`}
                onClick={() => handleSelect(layout)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{layout.name}</p>
                    <p className="text-xs text-muted-foreground">v{layout.version_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {layout.is_active ? (
                      <Badge variant="default" className="text-xs">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <Switch
                    checked={layout.is_active}
                    onCheckedChange={(checked) => {
                      toggleActiveMutation.mutate({ id: layout.id, is_active: checked });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs text-muted-foreground">
                    {layout.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Editar"
                      onClick={(e) => { e.stopPropagation(); handleSelect(layout); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Duplicar"
                      onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate(layout); }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive"
                      title="Excluir"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(layout.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right panel — visual editor + live preview */}
        <div className="lg:col-span-2">
          {editData ? (
            <div className="space-y-4">
              {/* Top bar: name + save */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Nome do Layout</Label>
                        <Input value={editData.name || ''} onChange={e => updateField('name', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Versão</Label>
                        <Input type="number" value={editData.version_number || 1} onChange={e => updateField('version_number', Number(e.target.value))} />
                      </div>
                    </div>
                    <Button onClick={handleSave} disabled={saveMutation.isPending} className="self-end">
                      <Save className="mr-2 h-4 w-4" /> Salvar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Two-column: drag editor + live preview */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <div>
                  <PdfSectionEditor editData={editData} onUpdate={updateField} />
                </div>
                <div className="sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-auto">
                  <PdfLayoutPreview config={editData as PdfLayoutConfig} />
                </div>
              </div>
            </div>
          ) : (
            <Card className="flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-40" />
                <p>Selecione um layout ou crie um novo para editar</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
