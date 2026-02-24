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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Save, Copy, Trash2, FileText, Eye } from 'lucide-react';
import { PdfLayoutPreview } from '@/components/pdf-layout/PdfLayoutPreview';

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
  created_at: string;
  updated_at: string;
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
      if (is_active) {
        // Deactivate all others first
        await supabase
          .from('pdf_layout_configs')
          .update({ is_active: false })
          .eq('tenant_id', currentTenant!.id)
          .neq('id', id);
      }
      const { error } = await supabase.from('pdf_layout_configs').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-layouts'] });
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
                      onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate(layout); }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive"
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

        {/* Right panel — editor + preview */}
        <div className="lg:col-span-2 space-y-4">
          {editData ? (
            <Tabs defaultValue="header" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="header">Cabeçalho</TabsTrigger>
                  <TabsTrigger value="body">Corpo</TabsTrigger>
                  <TabsTrigger value="footer">Rodapé</TabsTrigger>
                  <TabsTrigger value="margins">Margens</TabsTrigger>
                  <TabsTrigger value="preview">
                    <Eye className="mr-1 h-3 w-3" /> Preview
                  </TabsTrigger>
                </TabsList>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </Button>
              </div>

              {/* Name */}
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nome do Layout</Label>
                      <Input value={editData.name || ''} onChange={e => updateField('name', e.target.value)} />
                    </div>
                    <div>
                      <Label>Versão</Label>
                      <Input type="number" value={editData.version_number || 1} onChange={e => updateField('version_number', Number(e.target.value))} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Header Tab */}
              <TabsContent value="header">
                <Card>
                  <CardHeader><CardTitle className="text-base">Cabeçalho</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nome da Empresa (override)</Label>
                        <Input value={editData.company_name_override || ''} onChange={e => updateField('company_name_override', e.target.value)} placeholder="Usa o nome do tenant se vazio" />
                      </div>
                      <div>
                        <Label>Subtítulo</Label>
                        <Input value={editData.header_subtitle || ''} onChange={e => updateField('header_subtitle', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>URL do Logo</Label>
                        <Input value={editData.logo_url || ''} onChange={e => updateField('logo_url', e.target.value)} placeholder="https://..." />
                      </div>
                      <div>
                        <Label>Cor da borda</Label>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={editData.header_border_color || '#1a1a2e'} onChange={e => updateField('header_border_color', e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                          <Input value={editData.header_border_color || ''} onChange={e => updateField('header_border_color', e.target.value)} className="flex-1" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Fonte do cabeçalho</Label>
                        <Select value={editData.header_font_family} onValueChange={v => updateField('header_font_family', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f.split(',')[0]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tamanho da fonte: {editData.header_font_size}px</Label>
                        <Slider value={[editData.header_font_size || 16]} min={10} max={28} step={1} onValueChange={([v]) => updateField('header_font_size', v)} />
                      </div>
                    </div>
                    <Separator />
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <Switch checked={editData.show_logo ?? true} onCheckedChange={v => updateField('show_logo', v)} />
                        <Label>Exibir Logo</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={editData.show_date ?? true} onCheckedChange={v => updateField('show_date', v)} />
                        <Label>Exibir Data</Label>
                      </div>
                    </div>
                    <div>
                      <Label>Cor primária</Label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={editData.primary_color || '#1a1a2e'} onChange={e => updateField('primary_color', e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                        <Input value={editData.primary_color || ''} onChange={e => updateField('primary_color', e.target.value)} className="flex-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Body Tab */}
              <TabsContent value="body">
                <Card>
                  <CardHeader><CardTitle className="text-base">Corpo do Documento</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Fonte do corpo</Label>
                        <Select value={editData.body_font_family} onValueChange={v => updateField('body_font_family', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f.split(',')[0]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tamanho: {editData.body_font_size}px</Label>
                        <Slider value={[editData.body_font_size || 13]} min={9} max={20} step={0.5} onValueChange={([v]) => updateField('body_font_size', v)} />
                      </div>
                    </div>
                    <div>
                      <Label>Altura da linha: {editData.body_line_height}</Label>
                      <Slider value={[editData.body_line_height || 1.7]} min={1} max={3} step={0.1} onValueChange={([v]) => updateField('body_line_height', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Cor do texto</Label>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={editData.text_color || '#222222'} onChange={e => updateField('text_color', e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                          <Input value={editData.text_color || ''} onChange={e => updateField('text_color', e.target.value)} className="flex-1" />
                        </div>
                      </div>
                      <div>
                        <Label>Cor secundária</Label>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={editData.secondary_text_color || '#666666'} onChange={e => updateField('secondary_text_color', e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                          <Input value={editData.secondary_text_color || ''} onChange={e => updateField('secondary_text_color', e.target.value)} className="flex-1" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Footer Tab */}
              <TabsContent value="footer">
                <Card>
                  <CardHeader><CardTitle className="text-base">Rodapé</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center gap-2">
                        <Switch checked={editData.show_qr_code ?? true} onCheckedChange={v => updateField('show_qr_code', v)} />
                        <Label>QR Code</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={editData.show_validator_code ?? true} onCheckedChange={v => updateField('show_validator_code', v)} />
                        <Label>Código Validador</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={editData.show_page_numbers ?? true} onCheckedChange={v => updateField('show_page_numbers', v)} />
                        <Label>Número de Páginas</Label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tamanho do QR Code: {editData.qr_code_size}px</Label>
                        <Slider value={[editData.qr_code_size || 56]} min={32} max={120} step={4} onValueChange={([v]) => updateField('qr_code_size', v)} />
                      </div>
                      <div>
                        <Label>Fonte do rodapé</Label>
                        <Select value={editData.footer_font_family} onValueChange={v => updateField('footer_font_family', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f.split(',')[0]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Texto adicional do rodapé</Label>
                      <Input value={editData.footer_text || ''} onChange={e => updateField('footer_text', e.target.value)} placeholder="Ex: Confidencial — Uso interno" />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Margins Tab */}
              <TabsContent value="margins">
                <Card>
                  <CardHeader><CardTitle className="text-base">Margens e Espaçamento</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Margem superior: {editData.margin_top}mm</Label>
                        <Slider value={[editData.margin_top || 15]} min={5} max={40} step={1} onValueChange={([v]) => updateField('margin_top', v)} />
                      </div>
                      <div>
                        <Label>Margem inferior: {editData.margin_bottom}mm</Label>
                        <Slider value={[editData.margin_bottom || 15]} min={5} max={40} step={1} onValueChange={([v]) => updateField('margin_bottom', v)} />
                      </div>
                      <div>
                        <Label>Margem esquerda: {editData.margin_left}mm</Label>
                        <Slider value={[editData.margin_left || 15]} min={5} max={40} step={1} onValueChange={([v]) => updateField('margin_left', v)} />
                      </div>
                      <div>
                        <Label>Margem direita: {editData.margin_right}mm</Label>
                        <Slider value={[editData.margin_right || 15]} min={5} max={40} step={1} onValueChange={([v]) => updateField('margin_right', v)} />
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <Label>Espaço entre seções: {editData.section_gap}mm</Label>
                      <Slider value={[editData.section_gap || 3]} min={0} max={15} step={1} onValueChange={([v]) => updateField('section_gap', v)} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Preview Tab */}
              <TabsContent value="preview">
                <PdfLayoutPreview config={editData as PdfLayoutConfig} />
              </TabsContent>
            </Tabs>
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
