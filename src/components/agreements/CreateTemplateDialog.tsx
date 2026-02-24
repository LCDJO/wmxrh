/**
 * CreateTemplateDialog — Modal for creating a new agreement template
 */

import { useState, useRef } from 'react';
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
import { Loader2, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PdfLayoutPicker } from './PdfLayoutPicker';
import { TemplateHtmlPreview } from './TemplateHtmlPreview';

const VARIAVEIS = [
  { key: '{{nome_colaborador}}', label: 'Nome do Colaborador' },
  { key: '{{cpf}}', label: 'CPF' },
  { key: '{{rg}}', label: 'RG' },
  { key: '{{cargo}}', label: 'Cargo' },
  { key: '{{departamento}}', label: 'Departamento' },
  { key: '{{empresa}}', label: 'Empresa' },
  { key: '{{cnpj_empresa}}', label: 'CNPJ da Empresa' },
  { key: '{{data_admissao}}', label: 'Data de Admissão' },
  { key: '{{data_atual}}', label: 'Data Atual' },
  { key: '{{matricula}}', label: 'Matrícula' },
  { key: '{{endereco}}', label: 'Endereço' },
  { key: '{{salario}}', label: 'Salário' },
  { key: '{{jornada}}', label: 'Jornada de Trabalho' },
  { key: '{{gestor}}', label: 'Nome do Gestor' },
  { key: '{{unidade}}', label: 'Unidade / Filial' },
  { key: '{{email}}', label: 'E-mail' },
  { key: '{{telefone}}', label: 'Telefone' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
}

const CATEGORIAS = [
  { value: 'general', label: 'Geral' },
  { value: 'position_specific', label: 'Específico por Cargo' },
  { value: 'department_specific', label: 'Específico por Departamento' },
  { value: 'onboarding', label: 'Onboarding / Admissão' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'policy', label: 'Política Interna' },
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
  const [categoria, setCategoria] = useState('general');
  const [escopo, setEscopo] = useState('global');
  const [cargoId, setCargoId] = useState<string | null>(null);
  const [obrigatorio, setObrigatorio] = useState(true);
  const [exigeAssinatura, setExigeAssinatura] = useState(true);
  const [validadeDias, setValidadeDias] = useState('');
  const [renovacaoObrigatoria, setRenovacaoObrigatoria] = useState(false);
  const [conteudoHtml, setConteudoHtml] = useState('');
  const [pdfLayoutId, setPdfLayoutId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (varKey: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setConteudoHtml(prev => prev + varKey);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = conteudoHtml.slice(0, start);
    const after = conteudoHtml.slice(end);
    setConteudoHtml(before + varKey + after);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + varKey.length;
      ta.setSelectionRange(pos, pos);
    });
  };

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
    setConteudoHtml(''); setPdfLayoutId(null);
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
          pdf_layout_config_id: pdfLayoutId,
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
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Novo Termo / Acordo</DialogTitle>
          <DialogDescription>Preencha os campos abaixo para cadastrar um novo modelo de termo.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 overflow-hidden min-h-0">
          {/* Left: Form */}
          <div className="overflow-y-auto pr-1 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tmpl-name">Nome do Termo *</Label>
              <Input id="tmpl-name" placeholder="Ex: Termo de Confidencialidade" value={nome} onChange={e => setNome(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tmpl-desc">Descrição</Label>
              <Textarea id="tmpl-desc" placeholder="Breve descrição do objetivo do termo..." rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} />
            </div>

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

            <div className="space-y-1.5">
              <Label htmlFor="tmpl-val">Validade (dias)</Label>
              <Input id="tmpl-val" type="number" min="0" placeholder="Deixe vazio para sem expiração" value={validadeDias} onChange={e => setValidadeDias(e.target.value)} />
            </div>

            <PdfLayoutPicker tenantId={tenantId} value={pdfLayoutId} onChange={setPdfLayoutId} />

            <div className="space-y-1.5">
              <Label htmlFor="tmpl-html">Conteúdo do Termo (HTML) *</Label>
              <Textarea
                id="tmpl-html"
                ref={textareaRef}
                placeholder="<p>Eu, {{nome_colaborador}}, declaro que...</p>"
                rows={10}
                className="font-mono text-xs"
                value={conteudoHtml}
                onChange={e => setConteudoHtml(e.target.value)}
              />
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-medium text-muted-foreground">Clique para inserir a variável no texto:</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIAVEIS.map(v => (
                    <Badge
                      key={v.key}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors text-[11px] gap-1"
                      onClick={() => insertVariable(v.key)}
                    >
                      <Copy className="h-3 w-3" />
                      {v.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="border border-border rounded-lg overflow-hidden hidden lg:flex flex-col min-h-0">
            <TemplateHtmlPreview contentHtml={conteudoHtml} title={nome} />
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
