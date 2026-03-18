/**
 * Employee Agreement Engine — Ports (Hexagonal Architecture)
 *
 * Defines contracts for digital signature providers.
 * Adapters implement these interfaces for each provider
 * (OpenSign, DocuSign, ClickSign, etc.)
 */

import type { EmployeeAgreement, SignatureProvider } from './types';

// ── Signature Provider Port ──

export interface SignatureRequest {
  /** Tenant owner of the signature flow */
  tenant_id?: string;
  /** Nome do colaborador */
  employee_nome: string;
  /** E-mail do colaborador */
  employee_email: string;
  /** Conteúdo HTML do documento a ser assinado */
  documento_html: string;
  /** URL de callback para receber webhook pós-assinatura */
  callback_url: string;
  /** CPF do colaborador (opcional) */
  employee_cpf?: string;
  /** Metadados adicionais */
  metadata?: Record<string, unknown>;
}

export interface SignatureResponse {
  provider: SignatureProvider;
  external_document_id: string;
  signing_url: string;
  status: 'created' | 'sent' | 'error';
  error_message?: string;
}

export interface SignatureStatusResponse {
  external_document_id: string;
  status: 'pending' | 'signed' | 'rejected' | 'expired';
  signed_at?: string;
  signed_document_url?: string;
  signed_document_hash?: string;
  ip_address?: string;
  user_agent?: string;
  rejection_reason?: string;
}

export interface ISignatureProvider {
  /** Provider identifier */
  readonly provider: SignatureProvider;

  /** Send a document for digital signature */
  sendForSignature(request: SignatureRequest): Promise<SignatureResponse>;

  /** Check current status of a sent document */
  checkStatus(externalDocumentId: string, tenantId?: string): Promise<SignatureStatusResponse>;

  /** Cancel a pending signature request */
  cancelSignature(externalDocumentId: string, tenantId?: string): Promise<boolean>;

  /** Download the signed document as a Blob/Buffer */
  downloadSignedDocument(externalDocumentId: string, tenantId?: string): Promise<Blob | null>;
}

// ── Provider Registry ──

const providerRegistry = new Map<SignatureProvider, ISignatureProvider>();

export function registerSignatureProvider(provider: ISignatureProvider): void {
  providerRegistry.set(provider.provider, provider);
}

export function getSignatureProvider(name: SignatureProvider): ISignatureProvider | null {
  return providerRegistry.get(name) ?? null;
}

export function listRegisteredProviders(): SignatureProvider[] {
  return Array.from(providerRegistry.keys());
}

// ── Storage Port ──

export interface IDocumentStorage {
  /** Upload a signed document, returns the storage path */
  upload(tenantId: string, agreementId: string, file: Blob, filename: string): Promise<string>;

  /** Get a temporary URL for viewing */
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;

  /** Delete a stored document */
  remove(path: string): Promise<boolean>;
}
