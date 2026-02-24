/**
 * PdfLayoutPicker — Reusable selector for PDF layout configs within a tenant.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';

interface Props {
  tenantId: string;
  value: string | null;
  onChange: (id: string | null) => void;
}

export function PdfLayoutPicker({ tenantId, value, onChange }: Props) {
  const { data: layouts = [], isLoading } = useQuery({
    queryKey: ['pdf_layouts_picker', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pdf_layout_configs')
        .select('id, name, is_active, version_number')
        .eq('tenant_id', tenantId)
        .order('is_active', { ascending: false })
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        Layout do PDF
      </Label>
      <Select
        value={value || '__default__'}
        onValueChange={v => onChange(v === '__default__' ? null : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? 'Carregando...' : 'Layout padrão do tenant'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">
            <span className="flex items-center gap-2">
              Layout padrão (ativo)
            </span>
          </SelectItem>
          {layouts.map(l => (
            <SelectItem key={l.id} value={l.id}>
              <span className="flex items-center gap-2">
                {l.name}
                <Badge variant={l.is_active ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
                  {l.is_active ? 'Ativo' : `v${l.version_number}`}
                </Badge>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">
        Escolha um layout específico ou use o layout padrão ativo do tenant.
      </p>
    </div>
  );
}
