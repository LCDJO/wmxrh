/**
 * EditTemplateDialog — Modal for editing an existing agreement template
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  escopo: string;
  is_mandatory: boolean;
  is_active: boolean;
  exige_assinatura: boolean;
  expiry_days: number | null;
  renovacao_obrigatoria: boolean;
  conteudo_html: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateData | null;
}

const CATEGORIAS = [
  { value: 'general', label: 'Geral' },
  { value: 'position_specific', label: 'Específico por Cargo' },
  { value: 'department_specific', label: 'Específico por Departamento' },
  { value: 'onboarding', label: 'Onboarding / Admissão' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'policy', label: 'Política Interna' },
];

export function EditTemplateDialog({ open, onOpenChange, template }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('general');
  const [obrigatorio, setObrigatorio] = useState(true);
  const [ativo, setAtivo] = useState(true);
  const [exigeAssinatura, setExigeAssinatura] = useState(true);
  const [validadeDias, setValidadeDias] = useState('');
  const [renovacaoObrigatoria, setRenovacaoObrigatoria] = useState(false);
  const [conteudoHtml, setConteudoHtml] = useState('');

  useEffect(() => {
    if (template) {
      setNome(template.name);
      setDescricao(template.description || '');
      setCategoria(template.category);
      setObrigatorio(template.is_mandatory);
      setAtivo(template.is_active);
      setExigeAssinatura(template.exige_assinatura);
      setValidadeDias(template.expiry_days?.toString() || '');
      setRenovacaoObrigatoria(template.renovacao_obrigatoria);
      setConteudoHtml(template.conteudo_html);
    }
  }, [template]);

  const handleSubmit = async () => {
    if (!template) return;
    if (!nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('agreement_templates')
        .update({
          name: nome.trim(),
          description: descricao.trim() || null,
          category: categoria,
          is_mandatory: obrigatorio,
          is_active: ativo,
          exige_assinatura: exigeAssinatura,
          expiry_days: validadeDias ? parseInt(validadeDias) : null,
          renovacao_obrigatoria: renovacaoObrigatoria,
          conteudo_html: conteudoHtml,
        })
        .eq('id', template.id);

      if (error) throw error;

      toast({ title: 'Termo atualizado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['agreement_templates_admin'] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar termo', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Editar Termo</DialogTitle>
          <DialogDescription>Altere os campos desejados e salve.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome do Termo *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={obrigatorio} onCheckedChange={setObrigatorio} />
              <Label className="text-sm">Obrigatório</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <Label className="text-sm">Ativo</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={exigeAssinatura} onCheckedChange={setExigeAssinatura} />
              <Label className="text-sm">Exige Assinatura</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={renovacaoObrigatoria} onCheckedChange={setRenovacaoObrigatoria} />
              <Label className="text-sm">Renovação</Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Validade (dias)</Label>
            <Input type="number" min="0" placeholder="Sem expiração" value={validadeDias} onChange={e => setValidadeDias(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Conteúdo do Termo (HTML)</Label>
            <Textarea
              rows={8}
              className="font-mono text-xs"
              value={conteudoHtml}
              onChange={e => setConteudoHtml(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
