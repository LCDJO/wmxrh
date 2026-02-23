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
import { Plus, FileText, MapPin, Users, Briefcase, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useEmployeeMasterRecord,
  useCreateEmployeeDocument,
  useCreateEmployeeAddress,
  useCreateEmployeeDependent,
  useCreateEmployeeContract,
} from '@/domains/hooks';
import {
  DOCUMENT_TYPE_LABELS,
  DEPENDENT_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  WORK_REGIME_LABELS,
  FGTS_REGIME_LABELS,
} from '@/domains/employee-master-record';
import type {
  EmployeeDocumentType,
  EmployeeDependentType,
  ContractType,
  WorkRegime,
  FgtsRegime,
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
      <Tabs defaultValue="documentos" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
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
