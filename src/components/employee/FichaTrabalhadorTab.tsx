/**
 * Ficha do Trabalhador — Master Record Tab
 *
 * Shows documents, addresses, dependents, and contract data
 * as sub-tabs inside the employee detail page.
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, MapPin, Users, Briefcase, Loader2, User, IdCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useEmployeeMasterRecord,
  useCreateEmployeeDocument,
  useCreateEmployeeAddress,
  useCreateEmployeeDependent,
  useCreateEmployeeContract,
  useUpsertEmployeePersonalData,
  useCreateEmployeeRecord,
} from '@/domains/hooks';
import {
  DOCUMENT_TYPE_LABELS,
  DEPENDENT_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  WORK_REGIME_LABELS,
  FGTS_REGIME_LABELS,
  RECORD_STATUS_LABELS,
  SEXO_LABELS,
  ESTADO_CIVIL_LABELS,
} from '@/domains/employee-master-record';
import type {
  EmployeeDocumentType,
  EmployeeDependentType,
  ContractType,
  WorkRegime,
  FgtsRegime,
  EmployeeRecordStatus,
  EmployeeSexo,
  EmployeeEstadoCivil,
} from '@/domains/employee-master-record';

interface Props {
  employeeId: string;
  tenantId: string;
  canEdit: boolean;
}

export function FichaTrabalhadorTab({ employeeId, tenantId, canEdit }: Props) {
  const { data: record, isLoading } = useEmployeeMasterRecord(employeeId);
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card p-6">
      <h3 className="text-lg font-semibold font-display text-card-foreground mb-4">
        Ficha Completa do Trabalhador
      </h3>
      <Tabs defaultValue="registro" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="registro" className="gap-1.5 text-xs">
            <IdCard className="h-3.5 w-3.5" /> Registro
          </TabsTrigger>
          <TabsTrigger value="dados_pessoais" className="gap-1.5 text-xs">
            <User className="h-3.5 w-3.5" /> Dados Pessoais
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> Documentos ({record?.documents.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="enderecos" className="gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" /> Endereços ({record?.addresses.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="dependentes" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> Dependentes ({record?.dependents.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="contrato" className="gap-1.5 text-xs">
            <Briefcase className="h-3.5 w-3.5" /> Dados Contratuais ({record?.contracts.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* ── Aggregate Root ── */}
        <TabsContent value="registro">
          <RecordSection
            record={record?.record ?? null}
            employeeId={employeeId}
            tenantId={tenantId}
            canEdit={canEdit}
          />
        </TabsContent>

        {/* ── Personal Data ── */}
        <TabsContent value="dados_pessoais">
          <PersonalDataSection
            personalData={record?.personalData ?? null}
            employeeId={employeeId}
            tenantId={tenantId}
            canEdit={canEdit}
          />
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="documentos">
          <DocumentsSection
            documents={record?.documents ?? []}
            employeeId={employeeId}
            tenantId={tenantId}
            canEdit={canEdit}
          />
        </TabsContent>

        {/* ── Addresses ── */}
        <TabsContent value="enderecos">
          <AddressesSection
            addresses={record?.addresses ?? []}
            employeeId={employeeId}
            tenantId={tenantId}
            canEdit={canEdit}
          />
        </TabsContent>

        {/* ── Dependents ── */}
        <TabsContent value="dependentes">
          <DependentsSection
            dependents={record?.dependents ?? []}
            employeeId={employeeId}
            tenantId={tenantId}
            canEdit={canEdit}
          />
        </TabsContent>

        {/* ── Contract ── */}
        <TabsContent value="contrato">
          <ContractsSection
            contracts={record?.contracts ?? []}
            employeeId={employeeId}
            tenantId={tenantId}
            canEdit={canEdit}
          />
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
      });
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
      },
      {
        onSuccess: () => { toast({ title: 'Dados pessoais salvos!' }); setOpen(false); },
        onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
      }
    );
  };

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value }));

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
              <div className="space-y-2"><Label>CPF *</Label><Input value={form.cpf} onChange={f('cpf')} placeholder="000.000.000-00" required /></div>
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
      },
      {
        onSuccess: () => {
          toast({ title: 'Dependente adicionado!' });
          setOpen(false);
          setName(''); setCpf(''); setBirthDate(''); setIsIr(false); setIsBenefit(false);
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
      },
      {
        onSuccess: () => {
          toast({ title: 'Contrato registrado!' });
          setOpen(false);
          setAdmissionDate(''); setCboCode(''); setJobFunction('');
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
            <Button type="submit" className="w-full" disabled={createContract.isPending}>
              {createContract.isPending ? 'Salvando...' : 'Registrar Contrato'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
