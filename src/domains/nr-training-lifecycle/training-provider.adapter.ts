/**
 * Training Provider Integration — Ports & Adapters (Future)
 *
 * Hexagonal architecture for external training provider integrations.
 * Allows plugging in different providers (e.g. Alura, SENAI, SOC)
 * without changing core business logic.
 *
 * Capabilities:
 *   - Cadastrar cursos externos
 *   - Importar certificados
 *   - Validar PDF de certificado
 */

// ═══════════════════════════════════════════════════════
// PORTS (interfaces that adapters must implement)
// ═══════════════════════════════════════════════════════

/** Represents an external training course */
export interface ExternalCourse {
  external_id: string;
  provider_slug: string;
  name: string;
  nr_number: number | null;
  workload_hours: number;
  modality: 'presencial' | 'online' | 'hibrido';
  validity_months: number | null;
  description: string | null;
  url: string | null;
  price_brl: number | null;
  metadata: Record<string, unknown>;
}

/** Represents an imported certificate */
export interface ImportedCertificate {
  external_id: string;
  provider_slug: string;
  course_external_id: string;
  employee_external_ref: string | null;
  employee_cpf: string | null;
  employee_name: string;
  completed_at: string;
  expires_at: string | null;
  certificate_number: string | null;
  certificate_url: string | null;
  score: number | null;
  passed: boolean;
  hours_completed: number;
  instructor_name: string | null;
  raw_data: Record<string, unknown>;
}

/** Result of PDF certificate validation */
export interface CertificateValidationResult {
  is_valid: boolean;
  confidence: number; // 0-1
  extracted_data: {
    employee_name: string | null;
    course_name: string | null;
    nr_number: number | null;
    completion_date: string | null;
    expiry_date: string | null;
    workload_hours: number | null;
    certificate_number: string | null;
    instructor_name: string | null;
    provider_name: string | null;
  };
  validation_errors: string[];
  raw_text: string | null;
}

/** Port: Training Provider Adapter */
export interface TrainingProviderAdapter {
  /** Provider identifier (e.g. 'alura', 'senai', 'soc') */
  readonly slug: string;
  readonly displayName: string;

  /** List available courses from the provider */
  listCourses(filters?: {
    nr_number?: number;
    search?: string;
    modality?: string;
  }): Promise<ExternalCourse[]>;

  /** Get a specific course by external ID */
  getCourse(externalId: string): Promise<ExternalCourse | null>;

  /** Import certificates for a given period or employee */
  importCertificates(params: {
    since?: string;
    employee_cpf?: string;
    course_external_id?: string;
  }): Promise<ImportedCertificate[]>;

  /** Validate a PDF certificate (OCR + structure check) */
  validateCertificatePdf(
    fileUrl: string,
  ): Promise<CertificateValidationResult>;

  /** Check if the adapter connection is healthy */
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

// ═══════════════════════════════════════════════════════
// ADAPTER REGISTRY
// ═══════════════════════════════════════════════════════

const adapterRegistry = new Map<string, TrainingProviderAdapter>();

export const trainingProviderRegistry = {
  register(adapter: TrainingProviderAdapter): void {
    adapterRegistry.set(adapter.slug, adapter);
  },

  get(slug: string): TrainingProviderAdapter | undefined {
    return adapterRegistry.get(slug);
  },

  list(): TrainingProviderAdapter[] {
    return Array.from(adapterRegistry.values());
  },

  has(slug: string): boolean {
    return adapterRegistry.has(slug);
  },
};

// ═══════════════════════════════════════════════════════
// SERVICE (orchestrates adapter calls + persistence)
// ═══════════════════════════════════════════════════════

export const trainingProviderService = {
  /**
   * Import courses from a provider and persist them as catalog entries.
   * (Future: will sync with nr_training_catalog or similar table)
   */
  async syncCourses(providerSlug: string, filters?: { nr_number?: number }) {
    const adapter = adapterRegistry.get(providerSlug);
    if (!adapter) throw new Error(`Provider '${providerSlug}' not registered`);

    const courses = await adapter.listCourses(filters);
    // TODO: persist to training catalog table
    return { provider: providerSlug, courses_found: courses.length, courses };
  },

  /**
   * Import certificates and match to existing training assignments.
   * (Future: will auto-complete assignments when matching certificate found)
   */
  async importAndMatchCertificates(
    providerSlug: string,
    params: { since?: string; employee_cpf?: string },
  ) {
    const adapter = adapterRegistry.get(providerSlug);
    if (!adapter) throw new Error(`Provider '${providerSlug}' not registered`);

    const certificates = await adapter.importCertificates(params);
    // TODO: match certificates to nr_training_assignments by CPF + NR
    // TODO: auto-complete matched assignments
    return {
      provider: providerSlug,
      certificates_imported: certificates.length,
      certificates,
    };
  },

  /**
   * Validate a certificate PDF using the appropriate provider adapter
   * or a generic OCR-based validator.
   */
  async validateCertificate(
    providerSlug: string,
    fileUrl: string,
  ): Promise<CertificateValidationResult> {
    const adapter = adapterRegistry.get(providerSlug);
    if (!adapter) throw new Error(`Provider '${providerSlug}' not registered`);

    return adapter.validateCertificatePdf(fileUrl);
  },
};
