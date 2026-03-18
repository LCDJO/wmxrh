/**
 * Ficha do Trabalhador — Master Record Tab
 *
 * Shows documents, addresses, dependents, and contract data
 * as sub-tabs inside the employee detail page.
 */
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, MapPin, Users, Briefcase, Loader2, User, IdCard, DollarSign, ShieldAlert, Scale, Lock, Building2, FileCheck, Banknote, ScrollText, Gift, Calculator, GraduationCap, HardHat, Clock, Activity } from 'lucide-react';
import { RemuneracaoSection } from './RemuneracaoSection';
...
import type {
  EmployeeDocumentType,
  EmployeeDependentType,
  ContractType,
  WorkRegime,
  FgtsRegime,
  EmployeeRecordStatus,
  EmployeeSexo,
  EmployeeEstadoCivil,
  TipoSalario,
  FormaPagamento,
  JornadaTipo,
} from '@/domains/employee-master-record';
import { externalDataService } from '@/domains/occupational-intelligence/external-data.service';

interface Props {
  employeeId: string;
  tenantId: string;
  canEdit: boolean;
  /** Employee data for salary/simulation sections */
  employee?: {
    id: string;
    name: string;
    base_salary?: number | null;
    current_salary?: number | null;
    position_id?: string | null;
    department_id?: string | null;
    company_id?: string | null;
  } | null;
  canManageCompensation?: boolean;
}

export function FichaTrabalhadorTab({ employeeId, tenantId, canEdit, employee, canManageCompensation = false }: Props) {
  const { data: record, isLoading } = useEmployeeMasterRecord(employeeId);
  const { data: exams = [] } = useHealthExams(employeeId);
  const { toast } = useToast();

  // LGPD: log access to employee record
  useEffect(() => {
    import('@/domains/security').then(({ lgpdService }) => {
      lgpdService.logAccess({
        tenantId,
        employeeId,
        accessType: 'view',
        dataScope: 'ficha_trabalhador',
      });
    });
  }, [tenantId, employeeId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold font-display text-card-foreground">
          Ficha Completa do Trabalhador
        </h3>
      </div>

      {/* Status Indicators */}
      <FichaStatusIndicators record={record} employeeId={employeeId} exams={exams} />

      {/* Compliance Validation */}
      <ComplianceValidationBanner record={record} exams={exams} />

      <Tabs defaultValue="cadastro" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="cadastro" className="gap-1.5 text-xs">
            <User className="h-3.5 w-3.5" /> Cadastro
          </TabsTrigger>
          <TabsTrigger value="contrato_trabalho" className="gap-1.5 text-xs">
            <Briefcase className="h-3.5 w-3.5" /> Contrato & Trabalho
          </TabsTrigger>
          <TabsTrigger value="remuneracao" className="gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5" /> Remuneração
          </TabsTrigger>
          <TabsTrigger value="sst_compliance" className="gap-1.5 text-xs">
            <ShieldAlert className="h-3.5 w-3.5" /> SST & Compliance
          </TabsTrigger>
          <TabsTrigger value="docs_legais" className="gap-1.5 text-xs">
            <FileCheck className="h-3.5 w-3.5" /> Documentos Legais
          </TabsTrigger>
          <TabsTrigger value="governanca" className="gap-1.5 text-xs">
            <Scale className="h-3.5 w-3.5" /> Governança
          </TabsTrigger>
        </TabsList>

        {/* ═══ GRUPO 1: CADASTRO ═══ */}
        <TabsContent value="cadastro">
          <div className="space-y-6">
            <PersonalDataSection
              personalData={record?.personalData ?? null}
              employeeId={employeeId}
              tenantId={tenantId}
              canEdit={canEdit}
            />
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documentos Pessoais
              </h4>
              <DocumentsSection
                documents={record?.documents ?? []}
                employeeId={employeeId}
                tenantId={tenantId}
                canEdit={canEdit}
              />
            </div>
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Dependentes
              </h4>
              <DependentsSection
                dependents={record?.dependents ?? []}
                employeeId={employeeId}
                tenantId={tenantId}
                canEdit={canEdit}
              />
            </div>
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Endereços
              </h4>
              <AddressesSection
                addresses={record?.addresses ?? []}
                employeeId={employeeId}
                tenantId={tenantId}
                canEdit={canEdit}
              />
            </div>
          </div>
        </TabsContent>

        {/* ═══ GRUPO 2: CONTRATO & TRABALHO ═══ */}
        <TabsContent value="contrato_trabalho">
          <div className="space-y-6">
            <RecordSection
              record={record?.record ?? null}
              employeeId={employeeId}
              tenantId={tenantId}
              canEdit={canEdit}
            />
            <div className="border-t border-border pt-4">
              <ContractsSection
                contracts={record?.contracts ?? []}
                employeeId={employeeId}
                tenantId={tenantId}
                canEdit={canEdit}
              />
            </div>
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" /> Cargo PCCS — Requisitos e Faixas
              </h4>
              <CareerPositionSection positionId={employee?.position_id} tenantId={tenantId} />
            </div>
            <div className="border-t border-border pt-4">
              <EmployeeEventsSection employeeId={employeeId} />
            </div>
            <div className="border-t border-border pt-4">
              <UnifiedTimelineSection employeeId={employeeId} />
            </div>
          </div>
        </TabsContent>

        {/* ═══ GRUPO 3: REMUNERAÇÃO ═══ */}
        <TabsContent value="remuneracao">
          <div className="space-y-6">
            <SalaryCompositionSection
              employeeId={employeeId}
              tenantId={tenantId}
              employeeName={employee?.name ?? ''}
              baseSalary={employee?.base_salary ?? 0}
              currentSalary={employee?.current_salary ?? 0}
              canManageCompensation={canManageCompensation}
            />
            <div className="border-t border-border pt-4">
              <RemuneracaoSection employeeId={employeeId} tenantId={tenantId} />
            </div>
            <div className="border-t border-border pt-4">
              <BenefitsSection employeeId={employeeId} />
            </div>
            <div className="border-t border-border pt-4">
              <FinanceiroSection
                personalData={record?.personalData ?? null}
                currentContract={record?.contracts?.filter(c => !c.deleted_at && c.is_current)[0] ?? null}
              />
            </div>
            {employee && (
              <div className="border-t border-border pt-4">
                <SimulacaoTrabalhistaTab employee={employee as any} />
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ GRUPO 4: SST & COMPLIANCE ═══ */}
        <TabsContent value="sst_compliance">
          <div className="space-y-6">
            <SSTSection employeeId={employeeId} tenantId={tenantId} />
            <div className="border-t border-border pt-4">
              <HealthExamsSection employeeId={employeeId} tenantId={tenantId} />
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold text-card-foreground">Exposições a Risco</h4>
                </div>
                <AddRiskExposureDialog employeeId={employeeId} tenantId={tenantId} />
              </div>
              <RiskExposuresSection employeeId={employeeId} />
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HardHat className="h-4 w-4" /> 
                  <h4 className="text-sm font-semibold text-card-foreground">EPIs</h4>
                </div>
                <AddEpiDeliveryDialog employeeId={employeeId} tenantId={tenantId} />
              </div>
              <EpisTab employeeId={employeeId} tenantId={tenantId} />
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  <h4 className="text-sm font-semibold text-card-foreground">Treinamentos NR</h4>
                </div>
                <AddNrTrainingDialog employeeId={employeeId} tenantId={tenantId} />
              </div>
              <TreinamentosNrTab employeeId={employeeId} />
            </div>
            <div className="border-t border-border pt-4">
              <CorrectiveActionsTab employeeId={employeeId} tenantId={tenantId} />
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-card-foreground">Perfil Comportamental</h4>
              </div>
              <BehavioralProfileSection employeeId={employeeId} tenantId={tenantId} />
            </div>
          </div>
        </TabsContent>

        {/* ═══ GRUPO 5: DOCUMENTOS LEGAIS ═══ */}
        <TabsContent value="docs_legais">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                <FileCheck className="h-4 w-4" /> Documentos Legais
              </h4>
              <AutoProvisionDocumentsButton
                employeeId={employeeId}
                tenantId={tenantId}
                positionId={employee?.position_id}
                departmentId={employee?.department_id}
                companyId={employee?.company_id}
              />
            </div>
            <DocumentosTab employeeId={employeeId} />
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <FileCheck className="h-4 w-4" /> Termos e Acordos Assinados
              </h4>
              <TermosDocumentosTab employeeId={employeeId} />
            </div>
            <div className="border-t border-border pt-4">
              <SignedDocumentsSection employeeId={employeeId} tenantId={tenantId} />
            </div>
          </div>
        </TabsContent>

        {/* ═══ GRUPO 6: GOVERNANÇA ═══ */}
        <TabsContent value="governanca">
          <div className="space-y-6">
            <DisciplinarySection employeeId={employeeId} tenantId={tenantId} />
            <div className="border-t border-border pt-4">
              <EmployeeAuditLogSection employeeId={employeeId} tenantId={tenantId} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════
// RECORD SECTION (Aggregate Root)
// ════════════════════════════════════════════

function RecordSection({
  record,
  employeeId,
  tenantId,
  canEdit,
}: {
  record: any;
  employeeId: string;
  tenantId: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [matricula, setMatricula] = useState('');
  const [status, setStatus] = useState<EmployeeRecordStatus>('pre_admissao');
  const [dataAdmissao, setDataAdmissao] = useState('');
  const { toast } = useToast();
  const createRecord = useCreateEmployeeRecord();

  const handleCreate = () => {
    createRecord.mutate(
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        matricula_interna: matricula,
        status,
        data_admissao: dataAdmissao,
      },
      {
        onSuccess: () => { toast({ title: 'Registro criado!' }); setOpen(false); },
        onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
      }
    );
  };

  if (record) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Matrícula</p>
            <p className="text-sm font-mono font-medium text-card-foreground">{record.matricula_interna}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={record.status === 'ativo' ? 'default' : 'secondary'}>
              {RECORD_STATUS_LABELS[record.status as EmployeeRecordStatus] ?? record.status}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Data Admissão</p>
            <p className="text-sm text-card-foreground">{new Date(record.data_admissao).toLocaleDateString('pt-BR')}</p>
          </div>
          {record.data_desligamento && (
            <div>
              <p className="text-xs text-muted-foreground">Data Desligamento</p>
              <p className="text-sm text-card-foreground">{new Date(record.data_desligamento).toLocaleDateString('pt-BR')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground italic">Nenhum registro principal cadastrado.</p>
      {canEdit && (
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Criar Registro
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Criar Registro do Trabalhador</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Matrícula Interna *</Label><Input value={matricula} onChange={(e) => setMatricula(e.target.value)} required /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EmployeeRecordStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RECORD_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Data de Admissão *</Label><Input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={createRecord.isPending}>
              {createRecord.isPending ? 'Salvando...' : 'Criar Registro'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════
// PERSONAL DATA SECTION
// ════════════════════════════════════════════

function PersonalDataSection({
  personalData,
  employeeId,
  tenantId,
  canEdit,
}: {
  personalData: any;
  employeeId: string;
  tenantId: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cpfLookupLoading, setCpfLookupLoading] = useState(false);
  const [lastResolvedCpf, setLastResolvedCpf] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome_completo: '',
    nome_social: '',
    cpf: '',
    pis_pasep_nit: '',
    data_nascimento: '',
    sexo: 'nao_informado' as EmployeeSexo,
    estado_civil: 'nao_informado' as EmployeeEstadoCivil,
    nacionalidade: 'Brasileira',
    pais_nascimento: 'Brasil',
    uf_nascimento: '',
    municipio_nascimento: '',
    nome_mae: '',
    nome_pai: '',
    rg_numero: '',
    rg_orgao_emissor: '',
    rg_uf: '',
    rg_data_emissao: '',
    cnh_numero: '',
    cnh_categoria: '',
    cnh_validade: '',
    passaporte: '',
    rne_rnm: '',
    banco: '',
    agencia: '',
    conta: '',
    tipo_conta: 'corrente',
    chave_pix: '',
  });
  const { toast } = useToast();
  const upsert = useUpsertEmployeePersonalData();

  const openEdit = () => {
    if (personalData) {
      setForm({
        nome_completo: personalData.nome_completo || '',
        nome_social: personalData.nome_social || '',
        cpf: personalData.cpf || '',
        pis_pasep_nit: personalData.pis_pasep_nit || '',
        data_nascimento: personalData.data_nascimento || '',
        sexo: personalData.sexo || 'nao_informado',
        estado_civil: personalData.estado_civil || 'nao_informado',
        nacionalidade: personalData.nacionalidade || 'Brasileira',
        pais_nascimento: personalData.pais_nascimento || 'Brasil',
        uf_nascimento: personalData.uf_nascimento || '',
        municipio_nascimento: personalData.municipio_nascimento || '',
        nome_mae: personalData.nome_mae || '',
        nome_pai: personalData.nome_pai || '',
        rg_numero: personalData.rg_numero || '',
        rg_orgao_emissor: personalData.rg_orgao_emissor || '',
        rg_uf: personalData.rg_uf || '',
        rg_data_emissao: personalData.rg_data_emissao || '',
        cnh_numero: personalData.cnh_numero || '',
        cnh_categoria: personalData.cnh_categoria || '',
        cnh_validade: personalData.cnh_validade || '',
        passaporte: personalData.passaporte || '',
        rne_rnm: personalData.rne_rnm || '',
        banco: personalData.banco || '',
        agencia: personalData.agencia || '',
        conta: personalData.conta || '',
        tipo_conta: personalData.tipo_conta || 'corrente',
        chave_pix: personalData.chave_pix || '',
      });
      setLastResolvedCpf((personalData.cpf || '').replace(/\D/g, '').slice(0, 11) || null);
    } else {
      setLastResolvedCpf(null);
    }
    setOpen(true);
  };

  const handleSave = () => {
    upsert.mutate(
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        nome_completo: form.nome_completo,
        nome_social: form.nome_social || null,
        cpf: form.cpf,
        pis_pasep_nit: form.pis_pasep_nit || null,
        data_nascimento: form.data_nascimento,
        sexo: form.sexo,
        estado_civil: form.estado_civil,
        nacionalidade: form.nacionalidade,
        pais_nascimento: form.pais_nascimento,
        uf_nascimento: form.uf_nascimento || null,
        municipio_nascimento: form.municipio_nascimento || null,
        nome_mae: form.nome_mae || null,
        nome_pai: form.nome_pai || null,
        rg_numero: form.rg_numero || null,
        rg_orgao_emissor: form.rg_orgao_emissor || null,
        rg_uf: form.rg_uf || null,
        rg_data_emissao: form.rg_data_emissao || null,
        cnh_numero: form.cnh_numero || null,
        cnh_categoria: form.cnh_categoria || null,
        cnh_validade: form.cnh_validade || null,
        passaporte: form.passaporte || null,
        rne_rnm: form.rne_rnm || null,
        banco: form.banco || null,
        agencia: form.agencia || null,
        conta: form.conta || null,
        tipo_conta: form.tipo_conta || null,
        chave_pix: form.chave_pix || null,
      },
      {
        onSuccess: () => {
          toast({ title: 'Dados pessoais salvos!' });
          setOpen(false);
        },
        onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
      }
    );
  };

  const resolveCpf = async (cpfValue: string) => {
    const cleanedCpf = cpfValue.replace(/\D/g, '').slice(0, 11);
    if (cleanedCpf.length !== 11 || cleanedCpf === lastResolvedCpf || cpfLookupLoading) return;

    setCpfLookupLoading(true);
    try {
      const result = await externalDataService.resolveCpf(cleanedCpf, tenantId);
      setForm((prev) => ({
        ...prev,
        cpf: cleanedCpf,
        nome_completo: result.nome ?? prev.nome_completo,
        data_nascimento: result.data_nascimento ?? prev.data_nascimento,
      }));
      setLastResolvedCpf(cleanedCpf);
      toast({
        title: 'CPF consultado',
        description: 'Nome e data de nascimento foram preenchidos automaticamente.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível consultar o CPF.';
      toast({ title: 'Falha ao consultar CPF', description: message, variant: 'destructive' });
    } finally {
      setCpfLookupLoading(false);
    }
  };

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((p) => ({ ...p, [key]: value }));

    if (key === 'cpf') {
      const cleaned = value.replace(/\D/g, '').slice(0, 11);
      if (cleaned !== lastResolvedCpf) {
        setLastResolvedCpf(null);
      }
      if (cleaned.length === 11) {
        void resolveCpf(cleaned);
      }
    }
  };

  if (personalData && !open) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Dados pessoais do trabalhador</p>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={openEdit}>Editar</Button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div><p className="text-xs text-muted-foreground">Nome Completo</p><p className="text-sm font-medium text-card-foreground">{personalData.nome_completo}</p></div>
          {personalData.nome_social && <div><p className="text-xs text-muted-foreground">Nome Social</p><p className="text-sm text-card-foreground">{personalData.nome_social}</p></div>}
          <div><p className="text-xs text-muted-foreground">CPF</p><p className="text-sm font-mono text-card-foreground">{personalData.cpf}</p></div>
          {personalData.pis_pasep_nit && <div><p className="text-xs text-muted-foreground">PIS/PASEP/NIT</p><p className="text-sm font-mono text-card-foreground">{personalData.pis_pasep_nit}</p></div>}
          <div><p className="text-xs text-muted-foreground">Data Nascimento</p><p className="text-sm text-card-foreground">{new Date(personalData.data_nascimento).toLocaleDateString('pt-BR')}</p></div>
          <div><p className="text-xs text-muted-foreground">Sexo</p><p className="text-sm text-card-foreground">{SEXO_LABELS[personalData.sexo as EmployeeSexo]}</p></div>
          <div><p className="text-xs text-muted-foreground">Estado Civil</p><p className="text-sm text-card-foreground">{ESTADO_CIVIL_LABELS[personalData.estado_civil as EmployeeEstadoCivil]}</p></div>
          <div><p className="text-xs text-muted-foreground">Nacionalidade</p><p className="text-sm text-card-foreground">{personalData.nacionalidade}</p></div>
          {personalData.uf_nascimento && <div><p className="text-xs text-muted-foreground">UF/Município Nasc.</p><p className="text-sm text-card-foreground">{personalData.municipio_nascimento ? `${personalData.municipio_nascimento}/` : ''}{personalData.uf_nascimento}</p></div>}
          {personalData.nome_mae && <div><p className="text-xs text-muted-foreground">Nome da Mãe</p><p className="text-sm text-card-foreground">{personalData.nome_mae}</p></div>}
          {personalData.nome_pai && <div><p className="text-xs text-muted-foreground">Nome do Pai</p><p className="text-sm text-card-foreground">{personalData.nome_pai}</p></div>}
        </div>
        {(personalData.rg_numero || personalData.cnh_numero || personalData.passaporte || personalData.rne_rnm) && (
          <>
            <h4 className="text-sm font-semibold text-card-foreground mt-4">Documentação</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {personalData.rg_numero && <div><p className="text-xs text-muted-foreground">RG</p><p className="text-sm font-mono text-card-foreground">{personalData.rg_numero} {personalData.rg_orgao_emissor ? `— ${personalData.rg_orgao_emissor}` : ''}{personalData.rg_uf ? `/${personalData.rg_uf}` : ''}</p></div>}
              {personalData.rg_data_emissao && <div><p className="text-xs text-muted-foreground">Data Emissão RG</p><p className="text-sm text-card-foreground">{new Date(personalData.rg_data_emissao).toLocaleDateString('pt-BR')}</p></div>}
              {personalData.cnh_numero && <div><p className="text-xs text-muted-foreground">CNH</p><p className="text-sm font-mono text-card-foreground">{personalData.cnh_numero} {personalData.cnh_categoria ? `(${personalData.cnh_categoria})` : ''}</p></div>}
              {personalData.cnh_validade && <div><p className="text-xs text-muted-foreground">Validade CNH</p><p className="text-sm text-card-foreground">{new Date(personalData.cnh_validade).toLocaleDateString('pt-BR')}</p></div>}
              {personalData.passaporte && <div><p className="text-xs text-muted-foreground">Passaporte</p><p className="text-sm font-mono text-card-foreground">{personalData.passaporte}</p></div>}
              {personalData.rne_rnm && <div><p className="text-xs text-muted-foreground">RNE/RNM</p><p className="text-sm font-mono text-card-foreground">{personalData.rne_rnm}</p></div>}
            </div>
          </>
        )}
        {(personalData.banco || personalData.agencia || personalData.conta || personalData.chave_pix) && (
          <>
            <h4 className="text-sm font-semibold text-card-foreground mt-4">Dados Bancários</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {personalData.banco && <div><p className="text-xs text-muted-foreground">Banco</p><p className="text-sm text-card-foreground">{personalData.banco}</p></div>}
              {personalData.agencia && <div><p className="text-xs text-muted-foreground">Agência</p><p className="text-sm font-mono text-card-foreground">{personalData.agencia}</p></div>}
              {personalData.conta && <div><p className="text-xs text-muted-foreground">Conta</p><p className="text-sm font-mono text-card-foreground">{personalData.conta}</p></div>}
              {personalData.tipo_conta && <div><p className="text-xs text-muted-foreground">Tipo Conta</p><p className="text-sm text-card-foreground">{personalData.tipo_conta === 'corrente' ? 'Corrente' : personalData.tipo_conta === 'poupanca' ? 'Poupança' : personalData.tipo_conta}</p></div>}
              {personalData.chave_pix && <div><p className="text-xs text-muted-foreground">Chave PIX</p><p className="text-sm font-mono text-card-foreground">{personalData.chave_pix}</p></div>}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!personalData && <p className="text-sm text-muted-foreground italic">Nenhum dado pessoal cadastrado.</p>}
      {canEdit && !open && (
        <Button variant="outline" size="sm" className="gap-1" onClick={openEdit}>
          <Plus className="h-3.5 w-3.5" /> Cadastrar Dados Pessoais
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{personalData ? 'Editar' : 'Cadastrar'} Dados Pessoais</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nome Completo *</Label><Input value={form.nome_completo} onChange={f('nome_completo')} required /></div>
              <div className="space-y-2"><Label>Nome Social</Label><Input value={form.nome_social} onChange={f('nome_social')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>CPF *</Label>
                <div className="relative">
                  <Input
                    value={form.cpf}
                    onChange={f('cpf')}
                    onBlur={() => void resolveCpf(form.cpf)}
                    placeholder="000.000.000-00"
                    required
                  />
                  {cpfLookupLoading && <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground">Ao informar um CPF válido, o sistema tenta preencher nome e data de nascimento automaticamente.</p>
              </div>
              <div className="space-y-2"><Label>PIS/PASEP/NIT</Label><Input value={form.pis_pasep_nit} onChange={f('pis_pasep_nit')} /></div>
              <div className="space-y-2"><Label>Data Nascimento *</Label><Input type="date" value={form.data_nascimento} onChange={f('data_nascimento')} required /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select value={form.sexo} onValueChange={(v) => setForm(p => ({ ...p, sexo: v as EmployeeSexo }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEXO_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado Civil</Label>
                <Select value={form.estado_civil} onValueChange={(v) => setForm(p => ({ ...p, estado_civil: v as EmployeeEstadoCivil }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ESTADO_CIVIL_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Nacionalidade</Label><Input value={form.nacionalidade} onChange={f('nacionalidade')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2"><Label>País Nascimento</Label><Input value={form.pais_nascimento} onChange={f('pais_nascimento')} /></div>
              <div className="space-y-2"><Label>UF Nascimento</Label><Input value={form.uf_nascimento} onChange={f('uf_nascimento')} maxLength={2} /></div>
              <div className="space-y-2"><Label>Município Nascimento</Label><Input value={form.municipio_nascimento} onChange={f('municipio_nascimento')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nome da Mãe</Label><Input value={form.nome_mae} onChange={f('nome_mae')} /></div>
              <div className="space-y-2"><Label>Nome do Pai</Label><Input value={form.nome_pai} onChange={f('nome_pai')} /></div>
            </div>
            {/* Documentação */}
            <h4 className="text-sm font-semibold text-card-foreground border-t border-border pt-4">Documentação</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-2"><Label>RG Número</Label><Input value={form.rg_numero} onChange={f('rg_numero')} /></div>
              <div className="space-y-2"><Label>Órgão Emissor</Label><Input value={form.rg_orgao_emissor} onChange={f('rg_orgao_emissor')} placeholder="SSP" /></div>
              <div className="space-y-2"><Label>UF RG</Label><Input value={form.rg_uf} onChange={f('rg_uf')} maxLength={2} /></div>
              <div className="space-y-2"><Label>Data Emissão RG</Label><Input type="date" value={form.rg_data_emissao} onChange={f('rg_data_emissao')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2"><Label>CNH Número</Label><Input value={form.cnh_numero} onChange={f('cnh_numero')} /></div>
              <div className="space-y-2"><Label>Categoria CNH</Label><Input value={form.cnh_categoria} onChange={f('cnh_categoria')} placeholder="AB" /></div>
              <div className="space-y-2"><Label>Validade CNH</Label><Input type="date" value={form.cnh_validade} onChange={f('cnh_validade')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Passaporte</Label><Input value={form.passaporte} onChange={f('passaporte')} /></div>
              <div className="space-y-2"><Label>RNE/RNM</Label><Input value={form.rne_rnm} onChange={f('rne_rnm')} /></div>
            </div>
            {/* Dados Bancários */}
            <h4 className="text-sm font-semibold text-foreground pt-2">Dados Bancários</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Banco</Label><Input value={form.banco} onChange={f('banco')} placeholder="001 - Banco do Brasil" /></div>
              <div className="space-y-2"><Label>Agência</Label><Input value={form.agencia} onChange={f('agencia')} /></div>
              <div className="space-y-2"><Label>Conta</Label><Input value={form.conta} onChange={f('conta')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo Conta</Label>
                <Select value={form.tipo_conta} onValueChange={(v) => setForm(prev => ({ ...prev, tipo_conta: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="salario">Salário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Chave PIX</Label><Input value={form.chave_pix} onChange={f('chave_pix')} placeholder="CPF, email, telefone ou aleatória" /></div>
            </div>
            <Button type="submit" className="w-full" disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvando...' : 'Salvar Dados Pessoais'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════
// DOCUMENTS SECTION
// ════════════════════════════════════════════

function DocumentsSection({
  documents,
  employeeId,
  tenantId,
  canEdit,
}: {
  documents: any[];
  employeeId: string;
  tenantId: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState<EmployeeDocumentType>('rg');
  const [docNumber, setDocNumber] = useState('');
  const [issuingAuth, setIssuingAuth] = useState('');
  const [issuingState, setIssuingState] = useState('');
  const { toast } = useToast();
  const createDoc = useCreateEmployeeDocument();

  const handleCreate = () => {
    createDoc.mutate(
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        document_type: docType,
        document_number: docNumber,
        issuing_authority: issuingAuth || null,
        issuing_state: issuingState || null,
      },
      {
        onSuccess: () => {
          toast({ title: 'Documento adicionado!' });
          setOpen(false);
          setDocNumber('');
          setIssuingAuth('');
          setIssuingState('');
        },
        onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Documentos pessoais cadastrados</p>
        {canEdit && (
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">Nenhum documento cadastrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {documents.map((doc) => (
            <div key={doc.id} className="border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  {DOCUMENT_TYPE_LABELS[doc.document_type as EmployeeDocumentType] ?? doc.document_type}
                </Badge>
              </div>
              <p className="font-mono text-sm font-medium text-card-foreground">{doc.document_number}</p>
              {doc.issuing_authority && (
                <p className="text-xs text-muted-foreground">Órgão: {doc.issuing_authority} {doc.issuing_state ? `(${doc.issuing_state})` : ''}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Documento</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as EmployeeDocumentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número *</Label>
              <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Órgão Emissor</Label>
                <Input value={issuingAuth} onChange={(e) => setIssuingAuth(e.target.value)} placeholder="SSP" />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input value={issuingState} onChange={(e) => setIssuingState(e.target.value)} placeholder="SP" maxLength={2} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createDoc.isPending}>
              {createDoc.isPending ? 'Salvando...' : 'Salvar Documento'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════
// ADDRESSES SECTION
// ════════════════════════════════════════════

function AddressesSection({
  addresses,
  employeeId,
  tenantId,
  canEdit,
}: {
  addresses: any[];
  employeeId: string;
  tenantId: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const { toast } = useToast();
  const createAddr = useCreateEmployeeAddress();

  const handleCreate = () => {
    createAddr.mutate(
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        cep: cep || null,
        logradouro,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade,
        uf,
      },
      {
        onSuccess: () => {
          toast({ title: 'Endereço adicionado!' });
          setOpen(false);
          setCep(''); setLogradouro(''); setNumero(''); setComplemento(''); setBairro(''); setCidade(''); setUf('');
        },
        onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Endereços cadastrados</p>
        {canEdit && (
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        )}
      </div>

      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">Nenhum endereço cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {addr.is_primary && <Badge variant="default" className="text-xs">Principal</Badge>}
              </div>
              <p className="text-sm text-card-foreground">
                {addr.logradouro}{addr.numero ? `, ${addr.numero}` : ''}{addr.complemento ? ` - ${addr.complemento}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {addr.bairro ? `${addr.bairro} — ` : ''}{addr.cidade}/{addr.uf} {addr.cep ? `• CEP: ${addr.cep}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Adicionar Endereço</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-1"><Label>CEP</Label><Input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" /></div>
              <div className="space-y-2 col-span-2"><Label>Logradouro *</Label><Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} required /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Número</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
              <div className="space-y-2 col-span-2"><Label>Complemento</Label><Input value={complemento} onChange={(e) => setComplemento(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Bairro</Label><Input value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
              <div className="space-y-2"><Label>Cidade *</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} required /></div>
              <div className="space-y-2"><Label>UF *</Label><Input value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} required /></div>
            </div>
            <Button type="submit" className="w-full" disabled={createAddr.isPending}>
              {createAddr.isPending ? 'Salvando...' : 'Salvar Endereço'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════
// DEPENDENTS SECTION
// ════════════════════════════════════════════

function DependentsSection({
  dependents,
  employeeId,
  tenantId,
  canEdit,
}: {
  dependents: any[];
  employeeId: string;
  tenantId: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<EmployeeDependentType>('filho');
  const [birthDate, setBirthDate] = useState('');
  const [cpf, setCpf] = useState('');
  const [isIr, setIsIr] = useState(false);
  const [isBenefit, setIsBenefit] = useState(false);
  const [isSalarioFamilia, setIsSalarioFamilia] = useState(false);
  const { toast } = useToast();
  const createDep = useCreateEmployeeDependent();

  const handleCreate = () => {
    createDep.mutate(
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        name,
        relationship,
        birth_date: birthDate || null,
        cpf: cpf || null,
        is_ir_dependent: isIr,
        is_benefit_dependent: isBenefit,
        dependente_salario_familia: isSalarioFamilia,
      },
      {
        onSuccess: () => {
          toast({ title: 'Dependente adicionado!' });
          setOpen(false);
          setName(''); setCpf(''); setBirthDate(''); setIsIr(false); setIsBenefit(false); setIsSalarioFamilia(false);
        },
        onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Dependentes para IR e benefícios</p>
        {canEdit && (
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        )}
      </div>

      {dependents.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">Nenhum dependente cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {dependents.map((dep) => (
            <div key={dep.id} className="border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-card-foreground">{dep.name}</p>
                <Badge variant="secondary" className="text-xs">
                  {DEPENDENT_TYPE_LABELS[dep.relationship as EmployeeDependentType] ?? dep.relationship}
                </Badge>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                {dep.birth_date && <span>Nasc: {new Date(dep.birth_date).toLocaleDateString('pt-BR')}</span>}
                {dep.cpf && <span>CPF: {dep.cpf}</span>}
              </div>
              <div className="flex gap-2 mt-1">
                {dep.is_ir_dependent && <Badge variant="outline" className="text-xs">IR</Badge>}
                {dep.is_benefit_dependent && <Badge variant="outline" className="text-xs">Benefício</Badge>}
                {dep.dependente_salario_familia && <Badge variant="outline" className="text-xs">Salário Família</Badge>}
                {dep.has_disability && <Badge variant="outline" className="text-xs">PcD</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Dependente</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="space-y-2">
              <Label>Parentesco</Label>
              <Select value={relationship} onValueChange={(v) => setRelationship(v as EmployeeDependentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DEPENDENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data Nasc.</Label><Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>CPF</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value)} /></div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isIr} onChange={(e) => setIsIr(e.target.checked)} className="rounded" />
                Dependente IR
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isBenefit} onChange={(e) => setIsBenefit(e.target.checked)} className="rounded" />
                Dependente Benefício
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isSalarioFamilia} onChange={(e) => setIsSalarioFamilia(e.target.checked)} className="rounded" />
                Salário Família
              </label>
            </div>
            <Button type="submit" className="w-full" disabled={createDep.isPending}>
              {createDep.isPending ? 'Salvando...' : 'Salvar Dependente'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════
// CONTRACTS SECTION
// ════════════════════════════════════════════

function ContractsSection({
  contracts,
  employeeId,
  tenantId,
  canEdit,
}: {
  contracts: any[];
  employeeId: string;
  tenantId: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [contractType, setContractType] = useState<ContractType>('clt_indeterminado');
  const [workRegime, setWorkRegime] = useState<WorkRegime>('clt');
  const [fgtsRegime, setFgtsRegime] = useState<FgtsRegime>('optante');
  const [admissionDate, setAdmissionDate] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('44');
  const [cboCode, setCboCode] = useState('');
  const [jobFunction, setJobFunction] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [salarioBase, setSalarioBase] = useState('');
  const [tipoSalario, setTipoSalario] = useState<TipoSalario>('mensalista');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('deposito_bancario');
  const [jornadaTipo, setJornadaTipo] = useState<JornadaTipo>('integral');
  const [indicativoInss, setIndicativoInss] = useState(true);
  const { toast } = useToast();
  const createContract = useCreateEmployeeContract();

  const handleCreate = () => {
    createContract.mutate(
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        contract_type: contractType,
        work_regime: workRegime,
        fgts_regime: fgtsRegime,
        admission_date: admissionDate,
        weekly_hours: parseFloat(weeklyHours) || 44,
        cbo_code: cboCode || null,
        job_function: jobFunction || null,
        started_at: admissionDate,
        departamento: departamento || null,
        salario_base: salarioBase ? parseFloat(salarioBase) : null,
        tipo_salario: tipoSalario,
        forma_pagamento: formaPagamento,
        jornada_tipo: jornadaTipo,
        indicativo_inss: indicativoInss,
      },
      {
        onSuccess: () => {
          toast({ title: 'Contrato registrado!' });
          setOpen(false);
          setAdmissionDate(''); setCboCode(''); setJobFunction(''); setDepartamento(''); setSalarioBase('');
        },
        onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
      }
    );
  };

  const currentContract = contracts.find((c) => c.is_current);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Dados contratuais CLT / eSocial</p>
        {canEdit && (
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo Contrato
          </Button>
        )}
      </div>

      {currentContract && (
        <div className="border-2 border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
          <div className="flex items-center gap-2">
            <Badge className="text-xs">Contrato Vigente</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Tipo</p>
              <p className="font-medium text-card-foreground">{CONTRACT_TYPE_LABELS[currentContract.contract_type as ContractType] ?? currentContract.contract_type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Regime</p>
              <p className="font-medium text-card-foreground">{WORK_REGIME_LABELS[currentContract.work_regime as WorkRegime] ?? currentContract.work_regime}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">FGTS</p>
              <p className="font-medium text-card-foreground">{FGTS_REGIME_LABELS[currentContract.fgts_regime as FgtsRegime] ?? currentContract.fgts_regime}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Admissão</p>
              <p className="font-medium text-card-foreground">{new Date(currentContract.admission_date).toLocaleDateString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Jornada</p>
              <p className="font-medium text-card-foreground">{currentContract.weekly_hours}h/semana</p>
            </div>
            {currentContract.cbo_code && (
              <div>
                <p className="text-xs text-muted-foreground">CBO</p>
                <p className="font-medium text-card-foreground">{currentContract.cbo_code}</p>
              </div>
            )}
            {currentContract.esocial_category && (
              <div>
                <p className="text-xs text-muted-foreground">Categoria eSocial</p>
                <p className="font-medium text-card-foreground">{currentContract.esocial_category}</p>
              </div>
            )}
            {currentContract.job_function && (
              <div>
                <p className="text-xs text-muted-foreground">Função</p>
                <p className="font-medium text-card-foreground">{currentContract.job_function}</p>
              </div>
            )}
            {currentContract.departamento && (
              <div>
                <p className="text-xs text-muted-foreground">Departamento</p>
                <p className="font-medium text-card-foreground">{currentContract.departamento}</p>
              </div>
            )}
            {currentContract.salario_base != null && (
              <div>
                <p className="text-xs text-muted-foreground">Salário Base</p>
                <p className="font-medium text-card-foreground">R$ {Number(currentContract.salario_base).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            )}
            {currentContract.tipo_salario && (
              <div>
                <p className="text-xs text-muted-foreground">Tipo Salário</p>
                <p className="font-medium text-card-foreground">{TIPO_SALARIO_LABELS[currentContract.tipo_salario as TipoSalario]}</p>
              </div>
            )}
            {currentContract.forma_pagamento && (
              <div>
                <p className="text-xs text-muted-foreground">Forma Pagamento</p>
                <p className="font-medium text-card-foreground">{FORMA_PAGAMENTO_LABELS[currentContract.forma_pagamento as FormaPagamento]}</p>
              </div>
            )}
            {currentContract.jornada_tipo && (
              <div>
                <p className="text-xs text-muted-foreground">Tipo Jornada</p>
                <p className="font-medium text-card-foreground">{JORNADA_TIPO_LABELS[currentContract.jornada_tipo as JornadaTipo]}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">INSS</p>
              <p className="font-medium text-card-foreground">{currentContract.indicativo_inss ? 'Sim' : 'Não'}</p>
            </div>
          </div>
        </div>
      )}

      {contracts.filter((c) => !c.is_current).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contratos Anteriores</p>
          {contracts
            .filter((c) => !c.is_current)
            .map((c) => (
              <div key={c.id} className="border border-border rounded-lg p-3 opacity-60">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-card-foreground">{CONTRACT_TYPE_LABELS[c.contract_type as ContractType] ?? c.contract_type}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(c.started_at).toLocaleDateString('pt-BR')}
                    {c.ended_at ? ` — ${new Date(c.ended_at).toLocaleDateString('pt-BR')}` : ''}
                  </span>
                </div>
                {c.end_reason && <p className="text-xs text-muted-foreground mt-1">Motivo: {c.end_reason}</p>}
              </div>
            ))}
        </div>
      )}

      {contracts.length === 0 && !currentContract && (
        <p className="text-sm text-muted-foreground italic py-4">Nenhum contrato cadastrado.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo Contrato</Label>
                <Select value={contractType} onValueChange={(v) => setContractType(v as ContractType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Regime</Label>
                <Select value={workRegime} onValueChange={(v) => setWorkRegime(v as WorkRegime)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(WORK_REGIME_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>FGTS</Label>
                <Select value={fgtsRegime} onValueChange={(v) => setFgtsRegime(v as FgtsRegime)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FGTS_REGIME_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Admissão *</Label>
                <Input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Jornada (h/sem)</Label><Input type="number" value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)} /></div>
              <div className="space-y-2"><Label>CBO</Label><Input value={cboCode} onChange={(e) => setCboCode(e.target.value)} placeholder="5142-05" /></div>
              <div className="space-y-2"><Label>Função</Label><Input value={jobFunction} onChange={(e) => setJobFunction(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Departamento</Label><Input value={departamento} onChange={(e) => setDepartamento(e.target.value)} /></div>
              <div className="space-y-2"><Label>Salário Base (R$)</Label><Input type="number" step="0.01" value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} placeholder="0.00" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Tipo Salário</Label>
                <Select value={tipoSalario} onValueChange={(v) => setTipoSalario(v as TipoSalario)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_SALARIO_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Forma Pagamento</Label>
                <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as FormaPagamento)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMA_PAGAMENTO_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo Jornada</Label>
                <Select value={jornadaTipo} onValueChange={(v) => setJornadaTipo(v as JornadaTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(JORNADA_TIPO_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="indicativo_inss" checked={indicativoInss} onChange={(e) => setIndicativoInss(e.target.checked)} className="rounded border-border" />
              <Label htmlFor="indicativo_inss">Indicativo INSS</Label>
            </div>
            <Button type="submit" className="w-full" disabled={createContract.isPending}>
              {createContract.isPending ? 'Salvando...' : 'Registrar Contrato'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
