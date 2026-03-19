/**
 * Plano de Cargos e Carreira — Wizard de Criação de Cargo
 *
 * Steps:
 *  1. Criar Cargo (nome, nível, descrição)
 *  2. Selecionar CBO
 *  3. Sugestões automáticas (NRs, PCMSO, EPI, piso, faixa)
 *  4. RH Aprova
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import { supabase } from '@/integrations/supabase/client';
import { suggestLegalRequirements } from '@/domains/career-intelligence';
import { suggestSalaryBand } from '@/domains/career-intelligence/salary-band-intelligence.engine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Check, Briefcase, Hash, Plus,
  Lightbulb, ShieldCheck, AlertTriangle, DollarSign,
  Stethoscope, HardHat, GraduationCap, FileCheck, ScrollText,
} from 'lucide-react';
import type { CareerNivel, CareerLegalMapping } from '@/domains/career-intelligence/types';
import type { SuggestedSalaryBand } from '@/domains/career-intelligence/salary-band-intelligence.engine';

const STEPS = [
  { label: 'Cargo', icon: Briefcase },
  { label: 'CBO', icon: Hash },
  { label: 'Sugestões', icon: Lightbulb },
  { label: 'Aprovação', icon: ShieldCheck },
] as const;

const NIVEL_OPTIONS: { value: CareerNivel; label: string }[] = [
  { value: 'junior', label: 'Júnior' },
  { value: 'pleno', label: 'Pleno' },
  { value: 'senior', label: 'Sênior' },
  { value: 'lider', label: 'Líder' },
  { value: 'especialista', label: 'Especialista' },
];

interface CboOption {
  id: string;
  cbo_codigo: string;
  nome_funcao: string;
  nrs_relacionadas: number[];
}

interface SuggestionItem {
  tipo: string;
  descricao: string;
  base_legal: string | null;
  obrigatorio: boolean;
  periodicidade_meses: number | null;
  codigo_referencia: string | null;
  risco_nao_conformidade: string;
  selected: boolean;
}

export default function PccsWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { scope } = useScope();
  const selectedCompanyId = scope.companyId;
  const tenantId = currentTenant?.id ?? '';

  const [step, setStep] = useState(0);

  // ── Step 1 state ──
  const [nome, setNome] = useState('');
  const [nivel, setNivel] = useState<CareerNivel>('junior');
  const [descricao, setDescricao] = useState('');
  const [formacaoMinima, setFormacaoMinima] = useState('');

  // ── Step 2 state ──
  const [cboSearch, setCboSearch] = useState('');
  const [selectedCbo, setSelectedCbo] = useState<CboOption | null>(null);

  // ── Step 3 state ──
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [salaryBand, setSalaryBand] = useState<SuggestedSalaryBand | null>(null);
  const [faixaMin, setFaixaMin] = useState(0);
  const [faixaMax, setFaixaMax] = useState(0);

  // ── Agreement templates state ──
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());

  // ── Fetch CBO catalog ──
  const { data: cboList = [] } = useQuery<CboOption[]>({
    queryKey: ['cbo-catalog', tenantId, cboSearch],
    enabled: step === 1 && !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from('cbo_catalog')
        .select('id, cbo_codigo, nome_funcao, nrs_relacionadas')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('nome_funcao')
        .limit(50);
      if (cboSearch.trim()) {
        q = q.or(`nome_funcao.ilike.%${cboSearch}%,cbo_codigo.ilike.%${cboSearch}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CboOption[];
    },
  });

  // ── Fetch CNAE risk data for selected company ──
  const { data: cnaeProfile } = useQuery({
    queryKey: ['cnae-profile', tenantId, selectedCompanyId],
    enabled: !!tenantId && !!selectedCompanyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('company_cnae_profiles')
        .select('cnae_principal, grau_risco_sugerido')
        .eq('tenant_id', tenantId)
        .eq('company_id', selectedCompanyId!)
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // ── Fetch agreement templates for tenant ──
  const { data: agreementTemplates = [] } = useQuery({
    queryKey: ['agreement-templates-for-cargo', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agreement_templates')
        .select('id, name, category, is_mandatory, escopo, cargo_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; category: string; is_mandatory: boolean; escopo: string; cargo_id: string | null }[];
    },
  });

  // ── Fetch CCT for company ──
  const { data: activeCct } = useQuery({
    queryKey: ['active-cct', tenantId, selectedCompanyId],
    enabled: !!tenantId && !!selectedCompanyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('collective_agreements')
        .select('salary_floor, salary_ceiling, annual_readjustment_pct')
        .eq('tenant_id', tenantId)
        .eq('company_id', selectedCompanyId!)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // ── Generate suggestions when entering step 3 ──
  const generateSuggestions = () => {
    const grau = cnaeProfile?.grau_risco_sugerido ?? 2;
    const nrs = selectedCbo?.nrs_relacionadas ?? [];

    const reqs = suggestLegalRequirements(
      selectedCbo?.cbo_codigo ?? null,
      grau,
      nrs
    );

    setSuggestions(
      reqs.map(r => ({
        ...r,
        selected: r.obrigatorio,
      }))
    );

    // Build a temporary position for salary band engine
    const tempPos = {
      id: 'temp',
      tenant_id: tenantId,
      company_id: selectedCompanyId ?? '',
      company_group_id: null,
      position_id: null,
      nome,
      cbo_codigo: selectedCbo?.cbo_codigo ?? null,
      nivel,
      descricao,
      faixa_salarial_min: 0,
      faixa_salarial_max: 0,
      formacao_minima: formacaoMinima || null,
      certificacoes_exigidas: [],
      tempo_experiencia_meses: 0,
      ativo: true,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };

    const mappings: CareerLegalMapping[] = nrs.map(nr => ({
      id: 'temp',
      tenant_id: tenantId,
      career_position_id: 'temp',
      legal_reference_id: null,
      nr_codigo: `NR-${nr}`,
      exige_treinamento: true,
      exige_exame_medico: grau >= 3,
      exige_epi: grau >= 3,
      adicional_aplicavel: grau >= 4 ? 'insalubridade' as const : null,
      piso_salarial_referencia: null,
      created_at: '',
      updated_at: '',
    }));

    const band = suggestSalaryBand(
      tempPos,
      [],
      mappings,
      activeCct ? {
        salary_floor: activeCct.salary_floor,
        salary_ceiling: activeCct.salary_ceiling,
        annual_readjustment_pct: activeCct.annual_readjustment_pct,
      } : null,
      null
    );

    setSalaryBand(band);
    setFaixaMin(band.suggested_min);
    setFaixaMax(band.suggested_max);

    // Pre-select mandatory agreement templates (global + matching cargo/CBO)
    const autoSelected = new Set<string>();
    agreementTemplates.forEach(t => {
      if (!t.is_mandatory) return;
      if (t.escopo === 'global') autoSelected.add(t.id);
      // cargo-specific will be matched after position is created
    });
    setSelectedTemplateIds(autoSelected);
  };

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Create position
      const { data: pos, error: posErr } = await supabase
        .from('career_positions')
        .insert({
          tenant_id: tenantId,
          company_id: selectedCompanyId!,
          nome,
          nivel,
          descricao: descricao || null,
          cbo_codigo: selectedCbo?.cbo_codigo ?? null,
          faixa_salarial_min: faixaMin,
          faixa_salarial_max: faixaMax,
          formacao_minima: formacaoMinima || null,
        })
        .select('id')
        .single();
      if (posErr) throw posErr;

      // 2. Create legal requirements (selected ones)
      const selectedReqs = suggestions.filter(s => s.selected);
      if (selectedReqs.length > 0) {
        const { error: reqErr } = await supabase
          .from('career_legal_requirements')
          .insert(
            selectedReqs.map(s => ({
              tenant_id: tenantId,
              career_position_id: pos.id,
              tipo: s.tipo,
              codigo_referencia: s.codigo_referencia,
              descricao: s.descricao,
              obrigatorio: s.obrigatorio,
              periodicidade_meses: s.periodicidade_meses,
              base_legal: s.base_legal,
              risco_nao_conformidade: s.risco_nao_conformidade,
            }))
          );
        if (reqErr) throw reqErr;
      }

      // 3. Create legal mapping if NRs
      const nrs = selectedCbo?.nrs_relacionadas ?? [];
      if (nrs.length > 0) {
        const grau = cnaeProfile?.grau_risco_sugerido ?? 2;
        const { error: mapErr } = await supabase
          .from('career_legal_mappings')
          .insert(
            nrs.map(nr => ({
              tenant_id: tenantId,
              career_position_id: pos.id,
              nr_codigo: `NR-${nr}`,
              exige_treinamento: true,
              exige_exame_medico: grau >= 3,
              exige_epi: grau >= 3,
              adicional_aplicavel: grau >= 4 ? 'insalubridade' : null,
            }))
          );
        if (mapErr) throw mapErr;
      }

      // 4. Create assignment rules for selected agreement templates
      const templateIdsArray = Array.from(selectedTemplateIds);
      if (templateIdsArray.length > 0) {
        const { error: ruleErr } = await supabase
          .from('agreement_assignment_rules')
          .insert(
            templateIdsArray.map(tid => ({
              tenant_id: tenantId,
              template_id: tid,
              regra_tipo: 'por_cargo',
              cargo_id: pos.id,
              evento_disparo: 'hiring',
              is_active: true,
              prioridade: 10,
            }))
          );
        if (ruleErr) console.error('Assignment rule creation error:', ruleErr);
      }

      // 5. Auto-dispatch agreements to existing employees with this cargo
      // Find employees already in a position mapped to this cargo
      const { data: existingEmployees } = await supabase
        .from('employees')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('company_id', selectedCompanyId!)
        .eq('position_id', pos.id)
        .eq('status', 'active');

      if (existingEmployees && existingEmployees.length > 0 && templateIdsArray.length > 0) {
        // Get current version for each template
        for (const tid of templateIdsArray) {
          const { data: version } = await supabase
            .from('agreement_template_versions')
            .select('id')
            .eq('template_id', tid)
            .eq('is_current', true)
            .single();

          if (!version) continue;

          const agreementRows = existingEmployees.map((emp: { id: string }) => ({
            tenant_id: tenantId,
            employee_id: emp.id,
            template_id: tid,
            template_version_id: version.id,
            company_id: selectedCompanyId,
            status: 'pending',
            versao: 1,
          }));

          const { error: agrErr } = await supabase
            .from('employee_agreements')
            .insert(agreementRows);

          if (agrErr) console.error('Auto-dispatch error:', agrErr);
        }
      }

      return pos.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pccs-dashboard'] });
      toast.success('Cargo criado com sucesso!');
      navigate('/pccs-dashboard');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar cargo: ${err.message}`);
    },
  });

  // ── Navigation ──
  const canNext = () => {
    if (step === 0) return nome.trim().length > 0 && !!selectedCompanyId;
    if (step === 1) return true; // CBO is optional
    if (step === 2) return faixaMin > 0;
    return true;
  };

  const goNext = () => {
    if (step === 1) generateSuggestions();
    setStep(s => Math.min(s + 1, 3));
  };

  const toggleSuggestion = (idx: number) => {
    setSuggestions(prev =>
      prev.map((s, i) => (i === idx ? { ...s, selected: !s.selected } : s))
    );
  };

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const suggestionIcon = (tipo: string) => {
    if (tipo === 'exame_medico') return <Stethoscope className="h-4 w-4 text-primary" />;
    if (tipo === 'nr_training') return <GraduationCap className="h-4 w-4 text-primary" />;
    if (tipo === 'epi') return <HardHat className="h-4 w-4 text-primary" />;
    return <ShieldCheck className="h-4 w-4 text-primary" />;
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Novo Cargo — PCCS</h1>
        <p className="text-sm text-muted-foreground">
          Plano de Cargos, Carreiras e Salários
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.label} className="flex items-center gap-1">
              <div
                className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold transition-colors
                  ${done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/20 text-primary border-2 border-primary' : 'bg-muted text-muted-foreground'}`}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-xs hidden sm:inline ${active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px ${done ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6 space-y-5">
          {/* ── STEP 0: Criar Cargo ── */}
          {step === 0 && (
            <>
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">Dados do Cargo</CardTitle>
                <CardDescription>Informações básicas do cargo</CardDescription>
              </CardHeader>
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label>Nome do Cargo *</Label>
                  <Input
                    placeholder="Ex: Técnico de Segurança do Trabalho"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>Nível</Label>
                    <Select value={nivel} onValueChange={v => setNivel(v as CareerNivel)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NIVEL_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Formação Mínima</Label>
                    <Input
                      placeholder="Ex: Ensino Técnico"
                      value={formacaoMinima}
                      onChange={e => setFormacaoMinima(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Descrição</Label>
                  <Textarea
                    placeholder="Responsabilidades e atribuições do cargo..."
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    rows={3}
                  />
                </div>
                {!selectedCompanyId && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 rounded-md p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Selecione uma empresa no seletor de escopo antes de continuar.
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── STEP 1: Selecionar CBO ── */}
          {step === 1 && (
            <>
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">Classificação CBO</CardTitle>
                <CardDescription>Vincule o cargo a um código CBO (opcional, mas recomendado para eSocial)</CardDescription>
              </CardHeader>
              <div className="grid gap-4">
                <Input
                  placeholder="Buscar por nome ou código CBO..."
                  value={cboSearch}
                  onChange={e => setCboSearch(e.target.value)}
                />
                {selectedCbo && (
                  <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                    <Hash className="h-4 w-4 text-primary" />
                    <span className="font-mono text-sm font-medium text-foreground">{selectedCbo.cbo_codigo}</span>
                    <span className="text-sm text-muted-foreground">— {selectedCbo.nome_funcao}</span>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedCbo(null)}>
                      Limpar
                    </Button>
                  </div>
                )}
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {cboList.map(c => (
                    <button
                      key={c.id}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent
                        ${selectedCbo?.id === c.id ? 'bg-primary/10 font-medium' : ''}`}
                      onClick={() => setSelectedCbo(c)}
                    >
                      <span className="font-mono text-xs text-muted-foreground mr-2">{c.cbo_codigo}</span>
                      {c.nome_funcao}
                      {c.nrs_relacionadas.length > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({c.nrs_relacionadas.map(n => `NR-${n}`).join(', ')})
                        </span>
                      )}
                    </button>
                  ))}
                  {cboList.length === 0 && (
                    <p className="text-sm text-muted-foreground p-3 text-center">
                      {cboSearch ? 'Nenhum CBO encontrado.' : 'Digite para buscar no catálogo CBO.'}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── STEP 2: Sugestões ── */}
          {step === 2 && (
            <>
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">Sugestões Automáticas</CardTitle>
                <CardDescription>
                  Baseado no CBO{selectedCbo ? ` (${selectedCbo.cbo_codigo})` : ''} e no grau de risco da empresa
                </CardDescription>
              </CardHeader>

              {/* Legal requirements */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Requisitos Legais Sugeridos
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs"
                    onClick={() => {
                      setSuggestions(prev => [...prev, {
                        tipo: 'exame_medico',
                        codigo_referencia: '',
                        descricao: '',
                        obrigatorio: false,
                        periodicidade_meses: 12,
                        base_legal: '',
                        risco_nao_conformidade: 'medio',
                        selected: true,
                        _editing: true,
                      } as any]);
                    }}
                  >
                    <Plus className="h-3 w-3" /> Adicionar Requisito
                  </Button>
                </div>
                {suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma sugestão gerada.</p>
                ) : (
                  <div className="space-y-2">
                    {suggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${s.selected ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                      >
                        <Checkbox
                          checked={s.selected}
                          onCheckedChange={() => toggleSuggestion(idx)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          {(s as any)._editing ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <Select
                                  value={s.tipo}
                                  onValueChange={v => {
                                    setSuggestions(prev => prev.map((item, i) => i === idx ? { ...item, tipo: v } : item));
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="exame_medico">Exame Médico</SelectItem>
                                    <SelectItem value="nr_training">Treinamento NR</SelectItem>
                                    <SelectItem value="epi">EPI</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="Periodicidade (meses)"
                                  type="number"
                                  value={s.periodicidade_meses ?? ''}
                                  onChange={e => {
                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                    setSuggestions(prev => prev.map((item, i) => i === idx ? { ...item, periodicidade_meses: val } : item));
                                  }}
                                />
                              </div>
                              <Input
                                className="h-8 text-xs"
                                placeholder="Descrição do requisito *"
                                value={s.descricao}
                                onChange={e => {
                                  setSuggestions(prev => prev.map((item, i) => i === idx ? { ...item, descricao: e.target.value } : item));
                                }}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="Base legal (ex: NR-7)"
                                  value={s.base_legal ?? ''}
                                  onChange={e => {
                                    setSuggestions(prev => prev.map((item, i) => i === idx ? { ...item, base_legal: e.target.value } : item));
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 text-xs"
                                  disabled={!s.descricao}
                                  onClick={() => {
                                    setSuggestions(prev => prev.map((item, i) => i === idx ? { ...item, _editing: undefined } : item));
                                  }}
                                >
                                  Confirmar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                {suggestionIcon(s.tipo)}
                                <span className="text-sm font-medium text-foreground">{s.descricao}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {s.base_legal && (
                                  <Badge variant="secondary" className="text-[10px]">{s.base_legal}</Badge>
                                )}
                                {s.obrigatorio && (
                                  <Badge variant="destructive" className="text-[10px]">Obrigatório</Badge>
                                )}
                                {s.periodicidade_meses && (
                                  <span className="text-[10px] text-muted-foreground">
                                    A cada {s.periodicidade_meses} meses
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Salary band */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Faixa Salarial
                </h3>
                {salaryBand && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Piso Legal</p>
                        <p className="text-sm font-bold text-foreground">{fmt(salaryBand.minimo_legal)}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Mercado</p>
                        <p className="text-sm font-bold text-foreground">
                          {salaryBand.media_mercado ? fmt(salaryBand.media_mercado) : '—'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-primary/10 p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Sugerido Mín</p>
                        <p className="text-sm font-bold text-primary">{fmt(salaryBand.suggested_min)}</p>
                      </div>
                      <div className="rounded-lg bg-primary/10 p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Sugerido Máx</p>
                        <p className="text-sm font-bold text-primary">{fmt(salaryBand.suggested_max)}</p>
                      </div>
                    </div>

                    {salaryBand.impacto_risco > 0 && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 rounded-md p-2">
                        <DollarSign className="h-4 w-4 shrink-0" />
                        Adicional de risco: {fmt(salaryBand.impacto_risco)}/mês
                      </div>
                    )}

                    {salaryBand.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>Faixa Mínima *</Label>
                    <Input
                      type="number"
                      value={faixaMin || ''}
                      onChange={e => setFaixaMin(Number(e.target.value))}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Faixa Máxima</Label>
                    <Input
                      type="number"
                      value={faixaMax || ''}
                      onChange={e => setFaixaMax(Number(e.target.value))}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 3: Aprovação ── */}
          {step === 3 && (
            <>
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">Revisão e Aprovação</CardTitle>
                <CardDescription>Confira os dados antes de criar o cargo</CardDescription>
              </CardHeader>
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Cargo</span>
                    <span className="font-medium text-foreground">{nome}</span>
                    <span className="text-muted-foreground">Nível</span>
                    <span className="font-medium text-foreground">{NIVEL_OPTIONS.find(n => n.value === nivel)?.label}</span>
                    <span className="text-muted-foreground">CBO</span>
                    <span className="font-medium text-foreground">
                      {selectedCbo ? `${selectedCbo.cbo_codigo} — ${selectedCbo.nome_funcao}` : 'Não definido'}
                    </span>
                    <span className="text-muted-foreground">Faixa Salarial</span>
                    <span className="font-medium text-foreground">{fmt(faixaMin)} — {fmt(faixaMax)}</span>
                    {formacaoMinima && (
                      <>
                        <span className="text-muted-foreground">Formação</span>
                        <span className="font-medium text-foreground">{formacaoMinima}</span>
                      </>
                    )}
                  </div>
                </div>

                {suggestions.filter(s => s.selected).length > 0 && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                      Requisitos Legais ({suggestions.filter(s => s.selected).length})
                    </h4>
                    {suggestions.filter(s => s.selected).map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {suggestionIcon(s.tipo)}
                        <span className="text-foreground">{s.descricao}</span>
                        {s.obrigatorio && <Badge variant="destructive" className="text-[10px]">Obrigatório</Badge>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Agreement templates section */}
                <Separator />
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                      Termos e Acordos Vinculados
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecione os termos obrigatórios que devem ser enviados para assinatura dos colaboradores neste cargo.
                  </p>
                  {agreementTemplates.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">Nenhum template de termo cadastrado.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {agreementTemplates.map(t => {
                        const isSelected = selectedTemplateIds.has(t.id);
                        return (
                          <div
                            key={t.id}
                            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer ${isSelected ? 'border-primary/30 bg-primary/5' : 'border-border hover:bg-accent/30'}`}
                            onClick={() => {
                              setSelectedTemplateIds(prev => {
                                const next = new Set(prev);
                                if (next.has(t.id)) next.delete(t.id);
                                else next.add(t.id);
                                return next;
                              });
                            }}
                          >
                            <Checkbox checked={isSelected} className="pointer-events-none" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-foreground">{t.name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground capitalize">{t.category}</span>
                                {t.is_mandatory && <Badge variant="destructive" className="text-[10px]">Obrigatório</Badge>}
                                <span className="text-[10px] text-muted-foreground">{t.escopo}</span>
                              </div>
                            </div>
                            <FileCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {selectedTemplateIds.size > 0 && (
                    <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 rounded-md p-2">
                      <FileCheck className="h-3.5 w-3.5" />
                      {selectedTemplateIds.size} termo(s) será(ão) vinculado(s) ao cargo e enviado(s) aos colaboradores existentes.
                    </div>
                  )}
                </div>

                {!salaryBand?.compliant && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Atenção: a faixa salarial pode estar abaixo do piso legal.
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => (step === 0 ? navigate('/pccs-dashboard') : setStep(s => s - 1))}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {step === 0 ? 'Voltar' : 'Anterior'}
        </Button>

        {step < 3 ? (
          <Button onClick={goNext} disabled={!canNext()}>
            Próximo
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Salvando...' : 'Aprovar e Criar Cargo'}
            <Check className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
