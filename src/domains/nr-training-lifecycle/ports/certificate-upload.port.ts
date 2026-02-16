/**
 * Certificate Auto-Upload Port — Future
 *
 * Contract for automatic certificate upload, validation,
 * and matching to training assignments.
 *
 * Capabilities:
 *   - Upload PDF/image certificates to blob storage
 *   - OCR extraction of certificate data
 *   - Auto-match to existing training assignments
 *   - Validate certificate authenticity
 *   - Store in document vault with audit trail
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type CertificateFormat = 'pdf' | 'image' | 'html';

export interface CertificateUploadRequest {
  /** File from form upload or blob storage URL */
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  format: CertificateFormat;
  /** Employee who owns the certificate */
  employee_id: string;
  /** Optional: if known, the assignment this cert belongs to */
  assignment_id?: string;
  /** Optional: NR number if known */
  nr_number?: number;
  /** Who is uploading (employee self-service, RH, etc.) */
  uploaded_by: string;
  upload_source: 'manual' | 'lms_sync' | 'email_parser' | 'api';
}

export interface OcrExtractionResult {
  /** Confidence 0-1 */
  confidence: number;
  extracted: {
    employee_name: string | null;
    employee_cpf: string | null;
    course_name: string | null;
    nr_number: number | null;
    completion_date: string | null;
    expiry_date: string | null;
    workload_hours: number | null;
    certificate_number: string | null;
    instructor_name: string | null;
    provider_name: string | null;
    institution_cnpj: string | null;
  };
  /** Raw OCR text for audit */
  raw_text: string;
  /** Warnings (e.g. "low confidence on date field") */
  warnings: string[];
}

export interface CertificateMatchResult {
  matched: boolean;
  assignment_id: string | null;
  match_confidence: number; // 0-1
  match_criteria: {
    employee_matched: boolean;
    nr_matched: boolean;
    date_in_range: boolean;
    hours_sufficient: boolean;
  };
  /** If multiple possible matches, list alternatives */
  alternatives: Array<{
    assignment_id: string;
    confidence: number;
    reason: string;
  }>;
}

export interface ProcessedCertificate {
  upload_id: string;
  employee_id: string;
  /** Final storage URL in document vault */
  vault_url: string;
  /** Hash for integrity verification */
  file_hash: string;
  ocr_result: OcrExtractionResult;
  match_result: CertificateMatchResult;
  /** Whether auto-completion was triggered */
  auto_completed: boolean;
  processed_at: string;
}

// ═══════════════════════════════════════════════════════
// PORT
// ═══════════════════════════════════════════════════════

export interface CertificateUploadPort {
  readonly slug: string;
  readonly displayName: string;

  /** Upload certificate to blob storage */
  upload(request: CertificateUploadRequest): Promise<{ upload_id: string; storage_url: string }>;

  /** Extract data from certificate via OCR */
  extractData(storageUrl: string, format: CertificateFormat): Promise<OcrExtractionResult>;

  /** Match extracted data to existing training assignments */
  matchToAssignment(
    tenantId: string,
    employeeId: string,
    ocrResult: OcrExtractionResult,
  ): Promise<CertificateMatchResult>;

  /** Full pipeline: upload → OCR → match → auto-complete */
  processAndMatch(request: CertificateUploadRequest): Promise<ProcessedCertificate>;

  /** Validate certificate authenticity (e.g. QR code, digital signature) */
  validateAuthenticity(storageUrl: string): Promise<{
    authentic: boolean;
    method: 'qr_code' | 'digital_signature' | 'provider_api' | 'manual';
    details: string;
  }>;

  /** Health check */
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

// ═══════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════

const certificateRegistry = new Map<string, CertificateUploadPort>();

export const certificateUploadRegistry = {
  register(adapter: CertificateUploadPort): void {
    certificateRegistry.set(adapter.slug, adapter);
  },
  get(slug: string): CertificateUploadPort | undefined {
    return certificateRegistry.get(slug);
  },
  list(): CertificateUploadPort[] {
    return Array.from(certificateRegistry.values());
  },
  has(slug: string): boolean {
    return certificateRegistry.has(slug);
  },
};
