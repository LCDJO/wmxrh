/**
 * Employee Master Record Engine — Types
 *
 * Ficha Completa do Trabalhador (CLT, Portaria 671/2021, eSocial)
 * All satellite entity types for the employee master record.
 */

// ════════════════════════════════════════
// ENUMS (mirror DB enums)
// ════════════════════════════════════════

export type EmployeeDocumentType =
  | 'rg' | 'ctps' | 'pis_pasep' | 'titulo_eleitor' | 'cnh'
  | 'certidao_nascimento' | 'certidao_casamento' | 'reservista'
  | 'passaporte' | 'crnm' | 'outros';

export type EmployeeDependentType =
  | 'conjuge' | 'filho' | 'enteado' | 'pai_mae' | 'tutelado' | 'outros';

export type ContractType =
  | 'clt_indeterminado' | 'clt_determinado' | 'clt_intermitente'
  | 'clt_temporario' | 'clt_aprendiz' | 'estagio' | 'autonomo';

export type WorkRegime =
  | 'clt' | 'estatutario' | 'temporario' | 'avulso' | 'cooperado' | 'estagiario';

export type FgtsRegime = 'optante' | 'nao_optante' | 'retroativo';

export type EsocialCategory = string; // e.g. '101', '201', etc.

export type EmployeeRecordStatus = 'pre_admissao' | 'ativo' | 'afastado' | 'desligado';

export type EmployeeSexo = 'masculino' | 'feminino' | 'intersexo' | 'nao_informado';

export type EmployeeEstadoCivil =
  | 'solteiro' | 'casado' | 'divorciado' | 'viuvo'
  | 'separado' | 'uniao_estavel' | 'nao_informado';

export type TipoSalario = 'mensalista' | 'horista';

export type FormaPagamento = 'deposito_bancario' | 'pix' | 'cheque' | 'dinheiro';

export type JornadaTipo = 'integral' | 'parcial' | 'escala' | '12x36' | 'flexivel';

// ════════════════════════════════════════
// LABEL MAPS
// ════════════════════════════════════════

export const RECORD_STATUS_LABELS: Record<EmployeeRecordStatus, string> = {
  pre_admissao: 'Pré-Admissão',
  ativo: 'Ativo',
  afastado: 'Afastado',
  desligado: 'Desligado',
};

export const SEXO_LABELS: Record<EmployeeSexo, string> = {
  masculino: 'Masculino',
  feminino: 'Feminino',
  intersexo: 'Intersexo',
  nao_informado: 'Não Informado',
};

export const ESTADO_CIVIL_LABELS: Record<EmployeeEstadoCivil, string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)',
  separado: 'Separado(a)',
  uniao_estavel: 'União Estável',
  nao_informado: 'Não Informado',
};

export const DOCUMENT_TYPE_LABELS: Record<EmployeeDocumentType, string> = {
  rg: 'RG',
  ctps: 'CTPS',
  pis_pasep: 'PIS/PASEP',
  titulo_eleitor: 'Título de Eleitor',
  cnh: 'CNH',
  certidao_nascimento: 'Certidão de Nascimento',
  certidao_casamento: 'Certidão de Casamento',
  reservista: 'Certificado de Reservista',
  passaporte: 'Passaporte',
  crnm: 'CRNM (Estrangeiro)',
  outros: 'Outros',
};

export const DEPENDENT_TYPE_LABELS: Record<EmployeeDependentType, string> = {
  conjuge: 'Cônjuge/Companheiro(a)',
  filho: 'Filho(a)',
  enteado: 'Enteado(a)',
  pai_mae: 'Pai/Mãe',
  tutelado: 'Tutelado(a)',
  outros: 'Outros',
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  clt_indeterminado: 'CLT - Prazo Indeterminado',
  clt_determinado: 'CLT - Prazo Determinado',
  clt_intermitente: 'CLT - Intermitente',
  clt_temporario: 'CLT - Temporário',
  clt_aprendiz: 'CLT - Aprendiz',
  estagio: 'Estágio',
  autonomo: 'Autônomo',
};

export const WORK_REGIME_LABELS: Record<WorkRegime, string> = {
  clt: 'CLT',
  estatutario: 'Estatutário',
  temporario: 'Temporário',
  avulso: 'Avulso',
  cooperado: 'Cooperado',
  estagiario: 'Estagiário',
};

export const FGTS_REGIME_LABELS: Record<FgtsRegime, string> = {
  optante: 'Optante',
  nao_optante: 'Não Optante',
  retroativo: 'Retroativo',
};

export const TIPO_SALARIO_LABELS: Record<TipoSalario, string> = {
  mensalista: 'Mensalista',
  horista: 'Horista',
};

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  deposito_bancario: 'Depósito Bancário',
  pix: 'PIX',
  cheque: 'Cheque',
  dinheiro: 'Dinheiro',
};

export const JORNADA_TIPO_LABELS: Record<JornadaTipo, string> = {
  integral: 'Integral',
  parcial: 'Parcial',
  escala: 'Escala',
  '12x36': '12x36',
  flexivel: 'Flexível',
};

// ════════════════════════════════════════

export interface EmployeeDocument {
  id: string;
  tenant_id: string;
  employee_id: string;
  document_type: EmployeeDocumentType;
  document_number: string;
  issuing_authority: string | null;
  issuing_state: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  series: string | null;
  zone: string | null;
  section: string | null;
  category: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeAddress {
  id: string;
  tenant_id: string;
  employee_id: string;
  address_type: string;
  cep: string | null;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  pais: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeDependent {
  id: string;
  tenant_id: string;
  employee_id: string;
  name: string;
  relationship: EmployeeDependentType;
  birth_date: string | null;
  cpf: string | null;
  is_ir_dependent: boolean;
  is_benefit_dependent: boolean;
  has_disability: boolean;
  dependente_salario_familia: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeContract {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id: string | null;
  contract_type: ContractType;
  work_regime: WorkRegime;
  fgts_regime: FgtsRegime;
  esocial_category: EsocialCategory | null;
  esocial_matricula: string | null;
  admission_date: string;
  contract_end_date: string | null;
  experience_end_date: string | null;
  weekly_hours: number;
  shift_description: string | null;
  is_night_shift: boolean;
  union_name: string | null;
  union_code: string | null;
  collective_agreement_id: string | null;
  cbo_code: string | null;
  job_function: string | null;
  is_current: boolean;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  created_by: string | null;
  departamento: string | null;
  salario_base: number | null;
  tipo_salario: TipoSalario | null;
  forma_pagamento: FormaPagamento | null;
  jornada_tipo: JornadaTipo | null;
  indicativo_inss: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ════════════════════════════════════════
// DTOs
// ════════════════════════════════════════

export interface CreateEmployeeDocumentDTO {
  tenant_id: string;
  employee_id: string;
  document_type: EmployeeDocumentType;
  document_number: string;
  issuing_authority?: string | null;
  issuing_state?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  series?: string | null;
  zone?: string | null;
  section?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateEmployeeAddressDTO {
  tenant_id: string;
  employee_id: string;
  address_type?: string;
  cep?: string | null;
  logradouro: string;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade: string;
  uf: string;
  pais?: string;
  is_primary?: boolean;
}

export interface CreateEmployeeDependentDTO {
  tenant_id: string;
  employee_id: string;
  name: string;
  relationship: EmployeeDependentType;
  birth_date?: string | null;
  cpf?: string | null;
  is_ir_dependent?: boolean;
  is_benefit_dependent?: boolean;
  has_disability?: boolean;
  dependente_salario_familia?: boolean;
  start_date?: string;
  end_date?: string | null;
}

export interface CreateEmployeeContractDTO {
  tenant_id: string;
  employee_id: string;
  company_id?: string | null;
  contract_type?: ContractType;
  work_regime?: WorkRegime;
  fgts_regime?: FgtsRegime;
  esocial_category?: EsocialCategory | null;
  esocial_matricula?: string | null;
  admission_date: string;
  contract_end_date?: string | null;
  experience_end_date?: string | null;
  weekly_hours?: number;
  shift_description?: string | null;
  is_night_shift?: boolean;
  union_name?: string | null;
  union_code?: string | null;
  collective_agreement_id?: string | null;
  cbo_code?: string | null;
  job_function?: string | null;
  started_at: string;
  created_by?: string | null;
  departamento?: string | null;
  salario_base?: number | null;
  tipo_salario?: TipoSalario;
  forma_pagamento?: FormaPagamento;
  jornada_tipo?: JornadaTipo;
  indicativo_inss?: boolean;
}

// ════════════════════════════════════════
// AGGREGATE: Full Master Record
// ════════════════════════════════════════

// ════════════════════════════════════════
// Aggregate Root: Employee Record
// ════════════════════════════════════════

export interface EmployeeRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  matricula_interna: string;
  status: EmployeeRecordStatus;
  data_admissao: string;
  data_desligamento: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateEmployeeRecordDTO {
  tenant_id: string;
  employee_id: string;
  matricula_interna: string;
  status?: EmployeeRecordStatus;
  data_admissao: string;
  data_desligamento?: string | null;
}

// ════════════════════════════════════════
// Personal Data
// ════════════════════════════════════════

export interface EmployeePersonalData {
  id: string;
  tenant_id: string;
  employee_id: string;
  nome_completo: string;
  nome_social: string | null;
  cpf: string;
  pis_pasep_nit: string | null;
  data_nascimento: string;
  sexo: EmployeeSexo;
  estado_civil: EmployeeEstadoCivil;
  nacionalidade: string;
  pais_nascimento: string;
  uf_nascimento: string | null;
  municipio_nascimento: string | null;
  nome_mae: string | null;
  nome_pai: string | null;
  // Documentação
  rg_numero: string | null;
  rg_orgao_emissor: string | null;
  rg_uf: string | null;
  rg_data_emissao: string | null;
  cnh_numero: string | null;
  cnh_categoria: string | null;
  cnh_validade: string | null;
  passaporte: string | null;
  rne_rnm: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  chave_pix: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateEmployeePersonalDataDTO {
  tenant_id: string;
  employee_id: string;
  nome_completo: string;
  nome_social?: string | null;
  cpf: string;
  pis_pasep_nit?: string | null;
  data_nascimento: string;
  sexo?: EmployeeSexo;
  estado_civil?: EmployeeEstadoCivil;
  nacionalidade?: string;
  pais_nascimento?: string;
  uf_nascimento?: string | null;
  municipio_nascimento?: string | null;
  nome_mae?: string | null;
  nome_pai?: string | null;
  // Documentação
  rg_numero?: string | null;
  rg_orgao_emissor?: string | null;
  rg_uf?: string | null;
  rg_data_emissao?: string | null;
  cnh_numero?: string | null;
  cnh_categoria?: string | null;
  cnh_validade?: string | null;
  passaporte?: string | null;
  rne_rnm?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  tipo_conta?: string | null;
  chave_pix?: string | null;
}

// ════════════════════════════════════════
// Full Master Record Aggregate
// ════════════════════════════════════════

export interface EmployeeMasterRecord {
  employee_id: string;
  record: EmployeeRecord | null;
  personalData: EmployeePersonalData | null;
  documents: EmployeeDocument[];
  addresses: EmployeeAddress[];
  dependents: EmployeeDependent[];
  contracts: EmployeeContract[];
}
