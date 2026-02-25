/**
 * CareerPositionSection — Shows PCCS career position details linked to the employee's position,
 * including mandatory exams, NR trainings, EPIs, legal requirements, and salary bands.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Briefcase, GraduationCap, HardHat, Stethoscope, Scale,
  DollarSign, AlertTriangle, Loader2, FileText,
} from 'lucide-react';

interface Props {
  positionId?: string | null;
  tenantId: string;
}

export function CareerPositionSection({ positionId, tenantId }: Props) {
  // 1. Fetch the career_position linked to this position
  const { data: careerPosition, isLoading: loadingCP } = useQuery({
    queryKey: ['career_position_by_position', positionId, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('career_positions')
        .select('*')
        .eq('position_id', positionId!)
        .eq('tenant_id', tenantId)
        .eq('ativo', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!positionId && !!tenantId,
  });

  // 2. Fetch legal requirements for this career position
  const { data: legalReqs = [] } = useQuery({
    queryKey: ['career_legal_requirements', careerPosition?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('career_legal_requirements')
        .select('*')
        .eq('career_position_id', careerPosition!.id)
        .eq('tenant_id', tenantId)
        .order('tipo');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!careerPosition?.id,
  });

  // 3. Fetch legal mappings (NR, exams, EPI flags)
  const { data: legalMappings = [] } = useQuery({
    queryKey: ['career_legal_mappings', careerPosition?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('career_legal_mappings')
        .select('*')
        .eq('career_position_id', careerPosition!.id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!careerPosition?.id,
  });

  // 4. Fetch salary benchmarks
  const { data: benchmarks = [] } = useQuery({
    queryKey: ['career_salary_benchmarks', careerPosition?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('career_salary_benchmarks')
        .select('*')
        .eq('career_position_id', careerPosition!.id)
        .eq('tenant_id', tenantId)
        .order('referencia_data', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!careerPosition?.id,
  });

  if (!positionId) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Nenhum cargo vinculado ao colaborador.
      </p>
    );
  }

  if (loadingCP) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando dados do cargo...</span>
      </div>
    );
  }

  if (!careerPosition) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Cargo não possui vínculo com o PCCS. Configure o cargo no módulo de Cargos & Carreiras.
      </p>
    );
  }

  const trainings = legalReqs.filter((r: any) => r.tipo === 'treinamento');
  const exams = legalReqs.filter((r: any) => r.tipo === 'exame');
  const documents = legalReqs.filter((r: any) => r.tipo === 'documento');
  const others = legalReqs.filter((r: any) => !['treinamento', 'exame', 'documento'].includes(r.tipo));

  const mappingsWithNR = legalMappings.filter((m: any) => m.nr_codigo);
  const mappingsWithEPI = legalMappings.filter((m: any) => m.exige_epi);
  const mappingsWithExam = legalMappings.filter((m: any) => m.exige_exame_medico);

  const benchmark = benchmarks[0];

  return (
    <div className="space-y-4">
      {/* Career Position Header */}
      <div className="flex items-start justify-between">
        <div>
          <h5 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            {careerPosition.nome}
          </h5>
          {careerPosition.descricao && (
            <p className="text-xs text-muted-foreground mt-1">{careerPosition.descricao}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-[10px]">
            Nível: {careerPosition.nivel}
          </Badge>
          {careerPosition.cbo_codigo && (
            <Badge variant="secondary" className="text-[10px]">
              CBO: {careerPosition.cbo_codigo}
            </Badge>
          )}
        </div>
      </div>

      {/* Salary Bands */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-none shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="text-[10px]">Faixa Mín.</span>
            </div>
            <p className="text-sm font-semibold">
              {careerPosition.faixa_salarial_min
                ? `R$ ${Number(careerPosition.faixa_salarial_min).toLocaleString('pt-BR')}`
                : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="text-[10px]">Faixa Máx.</span>
            </div>
            <p className="text-sm font-semibold">
              {careerPosition.faixa_salarial_max
                ? `R$ ${Number(careerPosition.faixa_salarial_max).toLocaleString('pt-BR')}`
                : '—'}
            </p>
          </CardContent>
        </Card>
        {benchmark && (
          <>
            <Card className="border-none shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="text-[10px]">Mediana Mercado</span>
                </div>
                <p className="text-sm font-semibold">
                  R$ {Number(benchmark.valor_mediano).toLocaleString('pt-BR')}
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Scale className="h-3.5 w-3.5" />
                  <span className="text-[10px]">Fonte</span>
                </div>
                <p className="text-xs font-medium">{benchmark.fonte}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Formation & Certifications */}
      {(careerPosition.formacao_minima || (careerPosition.certificacoes_exigidas?.length ?? 0) > 0) && (
        <>
          <Separator />
          <div className="space-y-2">
            {careerPosition.formacao_minima && (
              <div className="flex items-center gap-2 text-sm">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Formação Mínima:</span>
                <span className="font-medium text-card-foreground">{careerPosition.formacao_minima}</span>
              </div>
            )}
            {(careerPosition.certificacoes_exigidas?.length ?? 0) > 0 && (
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Certificações:</span>
                {careerPosition.certificacoes_exigidas!.map((c: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Legal Mappings — NRs, Exams, EPI */}
      {(mappingsWithNR.length > 0 || mappingsWithExam.length > 0 || mappingsWithEPI.length > 0) && (
        <>
          <Separator />
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Mapeamento Legal do Cargo
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {mappingsWithNR.length > 0 && (
              <Card className="border-none shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <GraduationCap className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold">NRs Aplicáveis</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {mappingsWithNR.map((m: any) => (
                      <Badge key={m.id} variant="secondary" className="text-[10px]">
                        NR-{m.nr_codigo}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {mappingsWithExam.length > 0 && (
              <Card className="border-none shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Stethoscope className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold">Exige Exame Médico</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                    {mappingsWithExam.length} mapeamento(s)
                  </Badge>
                </CardContent>
              </Card>
            )}
            {mappingsWithEPI.length > 0 && (
              <Card className="border-none shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <HardHat className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold">Exige EPI</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                    {mappingsWithEPI.length} mapeamento(s)
                  </Badge>
                </CardContent>
              </Card>
            )}
          </div>
          {legalMappings.some((m: any) => m.adicional_aplicavel) && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-muted-foreground">Adicionais:</span>
              {legalMappings.filter((m: any) => m.adicional_aplicavel).map((m: any) => (
                <Badge key={m.id} variant="outline" className="text-[10px]">
                  {m.adicional_aplicavel}
                </Badge>
              ))}
            </div>
          )}
        </>
      )}

      {/* Legal Requirements */}
      {legalReqs.length > 0 && (
        <>
          <Separator />
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Requisitos Legais do Cargo
          </h5>
          <div className="space-y-3">
            {trainings.length > 0 && (
              <RequirementGroup
                icon={<GraduationCap className="h-3.5 w-3.5" />}
                title="Treinamentos Obrigatórios"
                items={trainings}
              />
            )}
            {exams.length > 0 && (
              <RequirementGroup
                icon={<Stethoscope className="h-3.5 w-3.5" />}
                title="Exames Obrigatórios"
                items={exams}
              />
            )}
            {documents.length > 0 && (
              <RequirementGroup
                icon={<FileText className="h-3.5 w-3.5" />}
                title="Documentos do Cargo"
                items={documents}
              />
            )}
            {others.length > 0 && (
              <RequirementGroup
                icon={<Scale className="h-3.5 w-3.5" />}
                title="Outros Requisitos"
                items={others}
              />
            )}
          </div>
        </>
      )}

      {/* Empty state for requirements */}
      {legalReqs.length === 0 && legalMappings.length === 0 && (
        <>
          <Separator />
          <p className="text-xs text-muted-foreground italic text-center py-2">
            Nenhum requisito legal cadastrado para este cargo no PCCS.
          </p>
        </>
      )}
    </div>
  );
}

function RequirementGroup({ icon, title, items }: { icon: React.ReactNode; title: string; items: any[] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-xs font-medium text-card-foreground">{title}</span>
        <Badge variant="secondary" className="text-[9px] ml-1">{items.length}</Badge>
      </div>
      <div className="space-y-1">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-card-foreground">{item.descricao}</span>
              {item.obrigatorio && (
                <Badge variant="destructive" className="text-[9px] px-1">Obrigatório</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              {item.periodicidade_meses && (
                <span className="text-[10px]">A cada {item.periodicidade_meses} meses</span>
              )}
              {item.base_legal && (
                <Badge variant="outline" className="text-[9px]">{item.base_legal}</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
