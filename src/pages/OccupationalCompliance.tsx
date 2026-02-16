import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useQueryScope } from '@/domains/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cboSuggestionService } from '@/domains/occupational-intelligence/cbo-suggestion.service';
import { nrTrainingRequirementService } from '@/domains/occupational-intelligence/nr-training-requirement.service';
import { cnpjDataResolverService } from '@/domains/occupational-intelligence/cnpj-data-resolver.service';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, BookOpen, ShieldCheck, Building2, GraduationCap, Clock, Loader2 } from 'lucide-react';
import { useCompanies } from '@/domains/hooks';

export default function OccupationalCompliance() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qs = useQueryScope();
  const qc = useQueryClient();
  const tenantId = currentTenant?.id;
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const { data: companies = [] } = useCompanies();

  // Get CNAE profile for the selected company
  const { data: cnaeProfile } = useQuery({
    queryKey: ['cnae-profile', selectedCompanyId],
    queryFn: () => cnpjDataResolverService.getByCompany(selectedCompanyId, qs!),
    enabled: !!selectedCompanyId && !!qs,
  });

  // Get pending CBO suggestions for the company's CNAE
  const { data: cboMappings = [], isLoading: cboLoading } = useQuery({
    queryKey: ['cbo-mappings', cnaeProfile?.cnae_principal],
    queryFn: () => cboSuggestionService.listByCnae(cnaeProfile!.cnae_principal, qs!),
    enabled: !!cnaeProfile?.cnae_principal && !!qs,
  });

  // Get training requirements for the company
  const { data: trainings = [], isLoading: trainingsLoading } = useQuery({
    queryKey: ['training-requirements', selectedCompanyId],
    queryFn: () => nrTrainingRequirementService.listByCompany(selectedCompanyId, qs!),
    enabled: !!selectedCompanyId && !!qs,
  });

  // Get NR training catalog
  const { data: catalog = [] } = useQuery({
    queryKey: ['nr-training-catalog', tenantId],
    queryFn: () => nrTrainingRequirementService.listCatalog(qs!),
    enabled: !!qs,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => cboSuggestionService.approve(id, user?.id ?? ''),
    onSuccess: () => {
      toast({ title: 'Cargo aprovado!' });
      qc.invalidateQueries({ queryKey: ['cbo-mappings'] });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => cboSuggestionService.bulkApprove(ids, user?.id ?? ''),
    onSuccess: () => {
      toast({ title: 'Cargos aprovados!' });
      qc.invalidateQueries({ queryKey: ['cbo-mappings'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => cboSuggestionService.reject(id),
    onSuccess: () => {
      toast({ title: 'Sugestão removida.' });
      qc.invalidateQueries({ queryKey: ['cbo-mappings'] });
    },
  });

  const pendingMappings = cboMappings.filter(m => !m.approved);
  const approvedMappings = cboMappings.filter(m => m.approved);

  // Build catalog lookup
  const catalogMap = new Map(catalog.map(c => [c.id, c]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Compliance Ocupacional</h1>
        <p className="text-muted-foreground mt-1">Gerencie cargos sugeridos e treinamentos obrigatórios por empresa.</p>
      </div>

      {/* Company Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Selecione uma empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cnaeProfile && (
              <Badge variant="outline" className="shrink-0">
                CNAE {cnaeProfile.cnae_principal} · Risco {cnaeProfile.grau_risco_sugerido}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedCompanyId && (
        <Tabs defaultValue="cargos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cargos" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Cargos Sugeridos
              {pendingMappings.length > 0 && (
                <Badge variant="destructive" className="text-[10px] ml-1">{pendingMappings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="treinamentos" className="gap-2">
              <GraduationCap className="h-4 w-4" />
              Treinamentos
              <Badge variant="secondary" className="text-[10px] ml-1">{trainings.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Cargos Sugeridos ── */}
          <TabsContent value="cargos" className="space-y-4">
            {/* Pending Approval */}
            {pendingMappings.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-warning" />
                      Pendentes de Aprovação
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={() => bulkApproveMutation.mutate(pendingMappings.map(m => m.id))}
                      disabled={bulkApproveMutation.isPending}
                      className="gap-1"
                    >
                      {bulkApproveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Aprovar Todos
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingMappings.map(m => (
                      <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.cbo_codigo}</p>
                          <p className="text-xs text-muted-foreground">
                            Probabilidade: {(m.probabilidade * 100).toFixed(0)}% · Fonte: {m.source}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-primary hover:bg-primary/10"
                            onClick={() => approveMutation.mutate(m.id)}
                            disabled={approveMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => rejectMutation.mutate(m.id)}
                            disabled={rejectMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Approved */}
            {approvedMappings.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Cargos Aprovados ({approvedMappings.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {approvedMappings.map(m => (
                      <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-accent/30 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.cbo_codigo}</p>
                          <p className="text-xs text-muted-foreground">
                            Aprovado em {m.approved_at ? new Date(m.approved_at).toLocaleDateString('pt-BR') : '—'}
                          </p>
                        </div>
                        <Badge variant="default" className="text-[10px]">Aprovado</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {cboLoading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando sugestões...
              </div>
            )}

            {!cboLoading && cboMappings.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma sugestão de cargo disponível. Consulte o CNAE na tela de cadastro de empresa.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Tab: Treinamentos ── */}
          <TabsContent value="treinamentos" className="space-y-4">
            {trainingsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando treinamentos...
              </div>
            ) : trainings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhum treinamento obrigatório gerado. Aprove os cargos sugeridos e execute a análise ocupacional.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {trainings.map(t => {
                  const catItem = catalogMap.get(t.catalog_item_id);
                  return (
                    <Card key={t.id} className="overflow-hidden">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              NR-{t.nr_codigo} — {catItem?.nome ?? 'Treinamento'}
                            </p>
                            <p className="text-xs text-muted-foreground">CBO: {t.cbo_codigo}</p>
                          </div>
                          <Badge variant={t.obrigatorio ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                            {t.obrigatorio ? 'Obrigatório' : 'Opcional'}
                          </Badge>
                        </div>
                        {catItem && (
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {catItem.carga_horaria}h
                            </span>
                            <span>{catItem.periodicidade === 'admissional' ? 'Admissional' : 'Periódico'}</span>
                            {catItem.validade_meses && <span>Validade: {catItem.validade_meses}m</span>}
                          </div>
                        )}
                        {catItem?.base_legal && (
                          <p className="text-[10px] text-muted-foreground/70">{catItem.base_legal}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
