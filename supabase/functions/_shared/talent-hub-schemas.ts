import type { ValidationSchema } from "./middleware.ts";

export const CANDIDATE_ORIGINS = [
  "site",
  "linkedin",
  "importacao",
  "indicacao",
  "manual",
  "outro",
] as const;

export const PIPELINE_STATUSES = [
  "novo",
  "triagem",
  "entrevista",
  "proposta",
  "contratado",
  "rejeitado",
] as const;

export const JOB_STATUSES = [
  "draft",
  "open",
  "paused",
  "closed",
  "cancelled",
] as const;

export const ENRICHMENT_PROVIDERS = [
  "receita_federal",
  "cnj",
  "tst",
  "ceis",
  "trabalho_escravo",
] as const;

export const candidateCreateSchema: ValidationSchema = {
  nome: { type: "string", required: true, min: 2, max: 200, sanitize: true },
  email: { type: "email", required: true },
  telefone: { type: "string", required: false, min: 8, max: 20, pattern: /^[0-9+()\-\s]+$/, sanitize: true },
  cpf_hash: { type: "string", required: true, min: 16, max: 255, pattern: /^[a-zA-Z0-9_\-+=/]+$/ },
  data_nascimento: { type: "date", required: false },
  cidade: { type: "string", required: false, max: 120, sanitize: true },
  estado: { type: "string", required: false, min: 2, max: 3, pattern: /^[A-Za-z]{2,3}$/ },
  consentimento_lgpd: { type: "boolean", required: true },
  origem: { type: "enum", required: true, enumValues: [...CANDIDATE_ORIGINS] },
  metadata_json: { type: "object", required: false },
  termo_versao: { type: "string", required: false, max: 50, sanitize: true },
};

export const candidateUpdateSchema: ValidationSchema = {
  nome: { type: "string", required: false, min: 2, max: 200, sanitize: true },
  email: { type: "email", required: false },
  telefone: { type: "string", required: false, min: 8, max: 20, pattern: /^[0-9+()\-\s]+$/, sanitize: true },
  cpf_hash: { type: "string", required: false, min: 16, max: 255, pattern: /^[a-zA-Z0-9_\-+=/]+$/ },
  data_nascimento: { type: "date", required: false },
  cidade: { type: "string", required: false, max: 120, sanitize: true },
  estado: { type: "string", required: false, min: 2, max: 3, pattern: /^[A-Za-z]{2,3}$/ },
  consentimento_lgpd: { type: "boolean", required: false },
  origem: { type: "enum", required: false, enumValues: [...CANDIDATE_ORIGINS] },
  metadata_json: { type: "object", required: false },
  termo_versao: { type: "string", required: false, max: 50, sanitize: true },
};

export const pipelineMoveSchema: ValidationSchema = {
  candidate_id: { type: "uuid", required: true },
  job_id: { type: "uuid", required: false },
  status: { type: "enum", required: true, enumValues: [...PIPELINE_STATUSES] },
  score: { type: "number", required: false, min: 0, max: 1000, precision: 2 },
  responsavel_id: { type: "uuid", required: false },
  observacoes: { type: "string", required: false, max: 1000, sanitize: true },
};

export const jobCreateSchema: ValidationSchema = {
  titulo: { type: "string", required: true, min: 2, max: 200, sanitize: true },
  descricao: { type: "string", required: false, max: 4000, sanitize: true },
  requisitos: { type: "array", required: false, max: 100 },
  salario: { type: "number", required: false, min: 0, max: 999999999.99, precision: 2 },
  status: { type: "enum", required: false, enumValues: [...JOB_STATUSES] },
  metadata_json: { type: "object", required: false },
};

export const jobUpdateSchema: ValidationSchema = {
  titulo: { type: "string", required: false, min: 2, max: 200, sanitize: true },
  descricao: { type: "string", required: false, max: 4000, sanitize: true },
  requisitos: { type: "array", required: false, max: 100 },
  salario: { type: "number", required: false, min: 0, max: 999999999.99, precision: 2 },
  status: { type: "enum", required: false, enumValues: [...JOB_STATUSES] },
  metadata_json: { type: "object", required: false },
};

export const enrichmentStartSchema: ValidationSchema = {
  candidate_id: { type: "uuid", required: true },
  providers: { type: "array", required: false, min: 1, max: 5 },
  identifier: { type: "string", required: false, min: 8, max: 32, pattern: /^\d+$/ },
  identifier_type: { type: "enum", required: false, enumValues: ["cpf", "cnpj"] },
};

export const aiAnalyzeSchema: ValidationSchema = {
  candidate_id: { type: "uuid", required: true },
  focus: { type: "string", required: false, max: 500, sanitize: true },
};

export type EnrichmentProviderKey = typeof ENRICHMENT_PROVIDERS[number];
