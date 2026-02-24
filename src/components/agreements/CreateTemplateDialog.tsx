/**
 * CreateTemplateDialog — Modal for creating a new agreement template
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
}

const CATEGORIAS = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'confidencialidade', label: 'Confidencialidade' },
  { value: 'uso_imagem', label: 'Uso de Imagem' },
  { value: 'epi', label: 'EPI' },
  { value: 'veiculo', label: 'Veículo' },
  { value: 'gps', label: 'GPS / Monitoramento' },
  { value: 'disciplinar', label: 'Disciplinar' },
  { value: 'lgpd', label: 'LGPD' },
  { value: 'outros', label: 'Outros' },
];

const ESCOPOS = [
  { value: 'global', label: 'Global (todos os colaboradores)' },
  { value: 'cargo', label: 'Por Cargo' },
  { value: 'risco', label: 'Por Risco' },
  { value: 'funcao_especifica', label: 'Função Específica' },
];

export function CreateTemplateDialog({ open, onOpenChange, tenantId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Form state
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('contrato');
  const [escopo, setEscopo] = useState('global');
  const [cargoId, setCargoId] = useState<string | null>(null);
  const [obrigatorio, setObrigatorio] = useState(true);
  const [exigeAssinatura, setExigeAssinatura] = useState(true);
  const [validadeDias, setValidadeDias] = useState('');
  const [renovacaoObrigatoria, setRenovacaoObrigatoria] = useState(false);
  const [conteudoHtml, setConteudoHtml] = useState('');

  // Load positions for cargo scope
  const { data: positions = [] } = useQuery({
    queryKey: ['positions_simple', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('positions')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name');
      return data || [];
    },
    enabled: !!tenantId && escopo === 'cargo',
  });

  const resetForm = () => {
    setNome(''); setDescricao(''); setCategoria('contrato');
    setEscopo('global'); setCargoId(null); setObrigatorio(true);
    setExigeAssinatura(true); setValidadeDias(''); setRenovacaoObrigatoria(false);
    setConteudoHtml('');
  };

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    if (!conteudoHtml.trim()) {
      toast({ title: 'Conteúdo do termo é obrigatório', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const slug = nome
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const { data, error } = await supabase
        .from('agreement_templates')
        .insert({
          tenant_id: tenantId,
          name: nome.trim(),
          slug,
          description: descricao.trim() || null,
          category: categoria,
          escopo,
          is_mandatory: obrigatorio,
          is_active: true,
          cargo_id: escopo === 'cargo' ? cargoId : null,
          versao: 1,
          conteudo_html: conteudoHtml,
          exige_assinatura: exigeAssinatura,
          expiry_days: validadeDias ? parseInt(validadeDias) : null,
          renovacao_obrigatoria: renovacaoObrigatoria,
        })
        .select()
        .single();

      if (error) throw error;

      // Create initial version record
      await supabase.from('agreement_template_versions').insert({
        template_id: data.id,
        tenant_id: tenantId,
        version_number: 1,
        title: nome.trim(),
        content_html: conteudoHtml,
        is_current: true,
        published_at: new Date().toISOString(),
      });

      toast({ title: 'Termo criado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['agreement_templates_admin'] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao criar termo', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Novo Termo / Acordo</DialogTitle>
          <DialogDescription>Preencha os campos abaixo para cadastrar um novo modelo de termo.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-name">Nome do Termo *</Label>
            <Input id="tmpl-name" placeholder="Ex: Termo de Confidencialidade" value={nome} onChange={e => setNome(e.target.value)} />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-desc">Descrição</Label>
            <Textarea id="tmpl-desc" placeholder="Breve descrição do objetivo do termo..." rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>

          {/* Categoria + Escopo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Escopo *</Label>
              <Select value={escopo} onValueChange={v => { setEscopo(v); if (v !== 'cargo') setCargoId(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESCOPOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cargo selector (conditional) */}
          {escopo === 'cargo' && (
            <div className="space-y-1.5">
              <Label>Cargo vinculado</Label>
              <Select value={cargoId || ''} onValueChange={setCargoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo..." /></SelectTrigger>
                <SelectContent>
                  {positions.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Switches row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Switch id="sw-obrig" checked={obrigatorio} onCheckedChange={setObrigatorio} />
              <Label htmlFor="sw-obrig" className="text-sm">Obrigatório</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sw-assin" checked={exigeAssinatura} onCheckedChange={setExigeAssinatura} />
              <Label htmlFor="sw-assin" className="text-sm">Exige Assinatura</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sw-renov" checked={renovacaoObrigatoria} onCheckedChange={setRenovacaoObrigatoria} />
              <Label htmlFor="sw-renov" className="text-sm">Renovação</Label>
            </div>
          </div>

          {/* Validade */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-val">Validade (dias)</Label>
            <Input id="tmpl-val" type="number" min="0" placeholder="Deixe vazio para sem expiração" value={validadeDias} onChange={e => setValidadeDias(e.target.value)} />
          </div>

          {/* Conteúdo HTML */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-html">Conteúdo do Termo (HTML) *</Label>
            <Textarea
              id="tmpl-html"
              placeholder="<p>Eu, {{nome_colaborador}}, declaro que...</p>"
              rows={8}
              className="font-mono text-xs"
              value={conteudoHtml}
              onChange={e => setConteudoHtml(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Use variáveis como {'{{nome_colaborador}}'}, {'{{cargo}}'}, {'{{empresa}}'}, {'{{data_admissao}}'}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Termo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
