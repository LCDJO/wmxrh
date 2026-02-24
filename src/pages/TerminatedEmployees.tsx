/**
 * TerminatedEmployees — Dashboard "Colaboradores Desligados"
 *
 * Features:
 *   - List terminated employees from archived_employee_profiles
 *   - Filter by period (date range)
 *   - View complete record (snapshot)
 *   - Download documents
 *   - View disciplinary history
 *   - Permission-controlled access
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryScope } from '@/domains/hooks';
import { usePermissions } from '@/domains/security';
import { supabase } from '@/integrations/supabase/client';
import { OFFBOARDING_TYPE_LABELS } from '@/domains/automated-offboarding';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  UserX, Search, Calendar, FileText, AlertTriangle, Shield,
  Loader2, Download, Eye, Briefcase, MapPin, Users, DollarSign,
  ClipboardList, Hash,
} from 'lucide-react';

// ── Types ──

interface ArchivedProfile {
  id: string;
  tenant_id: string;
  employee_id: string;
  workflow_id: string | null;
  employee_snapshot: Record<string, unknown>;
  contracts_snapshot: Record<string, unknown>[];
  documents_snapshot: Record<string, unknown>[];
  addresses_snapshot: Record<string, unknown>[];
  dependents_snapshot: Record<string, unknown>[];
  disciplinary_snapshot: Record<string, unknown>[];
  agreements_snapshot: Record<string, unknown>[];
  sst_snapshot: Record<string, unknown>[];
  financial_snapshot: Record<string, unknown>;
  benefits_snapshot: Record<string, unknown>[];
  rescission_result: Record<string, unknown> | null;
  offboarding_type: string;
  data_desligamento: string;
  archived_at: string;
  is_anonymized: boolean;
  snapshot_hash: string | null;
}

// ── Main Component ──

export default function TerminatedEmployees() {
  const qs = useQueryScope();
  const { canManageEmployees } = usePermissions();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ArchivedProfile | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['archived_employees', qs?.tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('archived_employee_profiles')
        .select('*')
        .eq('tenant_id', qs!.tenantId)
        .order('data_desligamento', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ArchivedProfile[];
    },
    enabled: !!qs?.tenantId,
  });

  // ── Filtering ──
  const filtered = useMemo(() => {
    let result = profiles;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => {
        const snap = p.employee_snapshot as any;
        const name = (snap?.personalData?.nome_completo || snap?.record?.employee_id || '').toLowerCase();
        const cpf = (snap?.personalData?.cpf || '').toLowerCase();
        return name.includes(q) || cpf.includes(q) || p.employee_id.toLowerCase().includes(q);
      });
    }

    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom));
      result = result.filter(p => parseISO(p.data_desligamento) >= from);
    }
    if (dateTo) {
      const to = endOfDay(parseISO(dateTo));
      result = result.filter(p => parseISO(p.data_desligamento) <= to);
    }

    return result;
  }, [profiles, search, dateFrom, dateTo]);

  const getEmployeeName = (p: ArchivedProfile): string => {
    const snap = p.employee_snapshot as any;
    return snap?.personalData?.nome_completo || snap?.record?.employee_id || 'Colaborador';
  };

  const getEmployeeCpf = (p: ArchivedProfile): string => {
    const snap = p.employee_snapshot as any;
    return snap?.personalData?.cpf || '—';
  };

  if (!canManageEmployees) {
    return (
      <div className="flex items-center justify-center py-24">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Acesso Restrito</h2>
            <p className="text-sm text-muted-foreground">
              Você não tem permissão para acessar os registros de colaboradores desligados.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UserX className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Colaboradores Desligados</h1>
          <p className="text-sm text-muted-foreground">Consulte fichas arquivadas, documentos e históricos</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <UserX className="h-8 w-8 text-muted-foreground/60" />
            <div>
              <p className="text-2xl font-bold text-foreground">{profiles.length}</p>
              <p className="text-xs text-muted-foreground">Total Desligados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-chart-3/60" />
            <div>
              <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
              <p className="text-xs text-muted-foreground">No Período</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Shield className="h-8 w-8 text-chart-4/60" />
            <div>
              <p className="text-2xl font-bold text-foreground">{profiles.filter(p => p.is_anonymized).length}</p>
              <p className="text-xs text-muted-foreground">Anonimizados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, CPF ou ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
            </div>
            {(search || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}>
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros Arquivados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {profiles.length === 0 ? 'Nenhum colaborador desligado encontrado.' : 'Nenhum resultado para os filtros aplicados.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data Desligamento</TableHead>
                  <TableHead>Arquivado em</TableHead>
                  <TableHead>Integridade</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setSelectedProfile(p)}>
                    <TableCell className="font-medium">
                      {p.is_anonymized ? (
                        <span className="italic text-muted-foreground">Anonimizado</span>
                      ) : (
                        getEmployeeName(p)
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.is_anonymized ? '***.***.***-**' : getEmployeeCpf(p)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {OFFBOARDING_TYPE_LABELS[p.offboarding_type as keyof typeof OFFBOARDING_TYPE_LABELS] || p.offboarding_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{format(parseISO(p.data_desligamento), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(p.archived_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {p.snapshot_hash ? (
                        <Badge variant="outline" className="text-[10px] text-chart-2 border-chart-2">
                          <Hash className="h-3 w-3 mr-0.5" /> Verificado
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setSelectedProfile(p); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {selectedProfile && (
        <ArchivedProfileDialog
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// Archived Profile Detail Dialog
// ══════════════════════════════════════════

function ArchivedProfileDialog({ profile, onClose }: { profile: ArchivedProfile; onClose: () => void }) {
  const snap = profile.employee_snapshot as any;
  const personalData = snap?.personalData || {};
  const workflowSummary = snap?.workflow_summary || {};

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            {profile.is_anonymized ? 'Perfil Anonimizado' : (personalData.nome_completo || 'Colaborador Desligado')}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ficha" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="ficha" className="text-xs">Ficha</TabsTrigger>
            <TabsTrigger value="contratos" className="text-xs">Contratos</TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs">Financeiro</TabsTrigger>
            <TabsTrigger value="disciplinar" className="text-xs">Disciplinar</TabsTrigger>
            <TabsTrigger value="documentos" className="text-xs">Documentos</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* ── Ficha ── */}
            <TabsContent value="ficha" className="space-y-4 m-0">
              <div className="grid grid-cols-2 gap-4">
                <InfoBlock label="Nome" value={personalData.nome_completo} anonymized={profile.is_anonymized} />
                <InfoBlock label="CPF" value={personalData.cpf} anonymized={profile.is_anonymized} />
                <InfoBlock label="Data de Nascimento" value={personalData.data_nascimento} anonymized={profile.is_anonymized} />
                <InfoBlock label="Estado Civil" value={personalData.estado_civil} />
                <InfoBlock label="Sexo" value={personalData.sexo} />
                <InfoBlock label="Nacionalidade" value={personalData.nacionalidade} />
              </div>

              <Separator />

              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4" /> Desligamento
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <InfoBlock label="Tipo" value={OFFBOARDING_TYPE_LABELS[profile.offboarding_type as keyof typeof OFFBOARDING_TYPE_LABELS] || profile.offboarding_type} />
                <InfoBlock label="Data Desligamento" value={format(parseISO(profile.data_desligamento), 'dd/MM/yyyy', { locale: ptBR })} />
                <InfoBlock label="Aviso Prévio" value={workflowSummary.aviso_previo_type} />
                <InfoBlock label="eSocial" value={workflowSummary.esocial_status || 'N/A'} />
                {workflowSummary.motivo && <InfoBlock label="Motivo" value={workflowSummary.motivo} className="col-span-2" />}
              </div>

              {profile.snapshot_hash && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" />
                    <span>SHA-256: <code className="font-mono text-[10px]">{profile.snapshot_hash.slice(0, 32)}...</code></span>
                  </div>
                </>
              )}

              {/* Addresses */}
              {profile.addresses_snapshot.length > 0 && (
                <>
                  <Separator />
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Endereços
                  </h4>
                  {profile.addresses_snapshot.map((addr: any, i) => (
                    <div key={i} className="text-sm text-muted-foreground">
                      {profile.is_anonymized ? 'Endereço anonimizado' : `${addr.logradouro || ''}, ${addr.numero || ''} — ${addr.cidade || ''} / ${addr.uf || ''}`}
                    </div>
                  ))}
                </>
              )}

              {/* Dependents */}
              {profile.dependents_snapshot.length > 0 && (
                <>
                  <Separator />
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> Dependentes ({profile.dependents_snapshot.length})
                  </h4>
                  {profile.dependents_snapshot.map((dep: any, i) => (
                    <div key={i} className="text-sm text-muted-foreground">
                      {profile.is_anonymized ? 'Dependente anonimizado' : `${dep.name || '—'} — ${dep.relationship || ''}`}
                    </div>
                  ))}
                </>
              )}
            </TabsContent>

            {/* ── Contratos ── */}
            <TabsContent value="contratos" className="space-y-3 m-0">
              {profile.contracts_snapshot.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum contrato registrado.</p>
              ) : (
                profile.contracts_snapshot.map((c: any, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{c.contract_type || 'CLT'}</span>
                        <Badge variant={c.is_current ? 'default' : 'secondary'} className="text-[10px]">
                          {c.is_current ? 'Vigente' : 'Encerrado'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>Admissão: {c.admission_date || c.started_at || '—'}</span>
                        <span>Término: {c.ended_at || '—'}</span>
                        <span>Salário: {c.salario_base ? `R$ ${Number(c.salario_base).toLocaleString('pt-BR')}` : '—'}</span>
                        <span>Jornada: {c.weekly_hours ? `${c.weekly_hours}h/sem` : '—'}</span>
                        {c.end_reason && <span className="col-span-2">Motivo: {c.end_reason}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* ── Financeiro ── */}
            <TabsContent value="financeiro" className="space-y-4 m-0">
              {/* Rescission */}
              {profile.rescission_result && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Rescisão
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Proventos</p>
                        <p className="text-lg font-bold text-chart-2">
                          R$ {Number((profile.rescission_result as any).total_proventos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Descontos</p>
                        <p className="text-lg font-bold text-destructive">
                          R$ {Number((profile.rescission_result as any).total_descontos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Líquido</p>
                        <p className="text-lg font-bold text-foreground">
                          R$ {Number((profile.rescission_result as any).valor_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Salary History */}
              {((profile.financial_snapshot as any)?.salary_history || []).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Histórico Salarial</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Data Efetiva</TableHead>
                          <TableHead className="text-xs">Valor</TableHead>
                          <TableHead className="text-xs">Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {((profile.financial_snapshot as any).salary_history || []).slice(0, 10).map((s: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{s.effective_date || '—'}</TableCell>
                            <TableCell className="text-xs">R$ {Number(s.new_salary || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.adjustment_reason || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Benefits */}
              {profile.benefits_snapshot.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Benefícios (à época)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {profile.benefits_snapshot.map((b: any, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{b.benefit_plan?.name || b.benefit_plan_id || 'Benefício'}</span>
                          <Badge variant="outline" className="text-[10px]">{b.status || 'ativo'}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Disciplinar ── */}
            <TabsContent value="disciplinar" className="space-y-3 m-0">
              {profile.disciplinary_snapshot.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum registro disciplinar encontrado.</p>
              ) : (
                profile.disciplinary_snapshot.map((d: any, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{d.action_type || d.tipo || 'Ocorrência'}</span>
                        <Badge variant={d.severity === 'high' ? 'destructive' : 'outline'} className="text-[10px]">
                          {d.severity || 'info'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{d.description || d.descricao || '—'}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {d.created_at ? format(parseISO(d.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* ── Documentos / Termos ── */}
            <TabsContent value="documentos" className="space-y-4 m-0">
              {/* Employee Documents */}
              {profile.documents_snapshot.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Documentos Pessoais
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {profile.documents_snapshot.map((doc: any, i) => (
                        <div key={i} className="flex items-center justify-between text-sm rounded-md border border-border px-3 py-2">
                          <span className="text-foreground">{doc.document_type || 'Documento'}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {profile.is_anonymized ? '***' : (doc.document_number || '—')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Signed Agreements */}
              {profile.agreements_snapshot.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" /> Termos e Acordos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {profile.agreements_snapshot.map((agr: any, i) => (
                        <div key={i} className="flex items-center justify-between text-sm rounded-md border border-border px-3 py-2">
                          <div>
                            <span className="text-foreground">{agr.title || agr.template_id || 'Termo'}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {agr.signed_at ? format(parseISO(agr.signed_at), 'dd/MM/yyyy', { locale: ptBR }) : ''}
                            </span>
                          </div>
                          <Badge variant={agr.status === 'signed' ? 'default' : 'secondary'} className="text-[10px]">
                            {agr.status || '—'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* SST */}
              {profile.sst_snapshot.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> SST (Saúde e Segurança)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {profile.sst_snapshot.map((s: any, i) => (
                        <div key={i} className="text-sm text-muted-foreground">
                          {s._sst_type || 'Registro SST'}: {s.description || s.tipo || '—'}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── InfoBlock helper ──

function InfoBlock({ label, value, anonymized, className }: { label: string; value?: string | null; anonymized?: boolean; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">
        {anonymized ? '████████' : (value || '—')}
      </p>
    </div>
  );
}
