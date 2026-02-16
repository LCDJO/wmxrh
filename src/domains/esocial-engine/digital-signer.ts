/**
 * eSocial Digital Signer — Port (Adapter Pattern)
 *
 * Defines the contract for digital signature of eSocial XML documents.
 * Brazilian eSocial requires ICP-Brasil certificates:
 *   - A1: Software-based (PFX/P12 file), valid for 1 year
 *   - A3: Hardware-based (token/smart card), valid for 1–5 years
 *
 * This is a PORT — the actual crypto implementation is injected as an adapter.
 * Production adapters:
 *   - A1Adapter: reads PFX file, extracts private key via WebCrypto/OpenSSL
 *   - A3Adapter: communicates with HSM/token via PKCS#11
 *
 * Currently provides a simulation adapter for development/testing.
 */

// ════════════════════════════════════
// CERTIFICATE TYPES
// ════════════════════════════════════

export type CertificateType = 'A1' | 'A3';

/**
 * Certificate storage info — differs by type:
 *   A1: PFX file stored server-side (encrypted at rest)
 *   A3: Reference to hardware token/HSM slot
 */
export interface CertificateStorage {
  /** For A1: encrypted PFX blob identifier in secure storage */
  pfx_storage_key?: string;
  /** For A3: PKCS#11 slot/token identifier */
  pkcs11_slot_id?: string;
  /** For A3: HSM provider endpoint */
  hsm_endpoint?: string;
  /** Provider name (e.g. 'Certisign', 'Serasa', 'AC Valid') */
  provider: string;
}

/**
 * Digital certificate representation with required fields:
 *   - certificado_id: unique identifier
 *   - validade_certificado: expiry date
 */
export interface DigitalCertificate {
  /** Unique certificate identifier */
  certificado_id: string;
  /** Certificate type: A1 (software) or A3 (hardware) */
  type: CertificateType;
  /** Common name — usually company legal name */
  subject_cn: string;
  /** Certificate authority name */
  issuer_cn: string;
  /** Serial number from the certificate */
  serial_number: string;
  /** Start of validity period (ISO 8601) */
  valid_from: string;
  /** End of validity period (ISO 8601) — validade_certificado */
  validade_certificado: string;
  /** CNPJ or CPF associated with the certificate */
  document: string;
  /** Whether the cert is currently valid and not revoked */
  is_active: boolean;
  /** Tenant that owns this certificate */
  tenant_id: string;
  /** Company this certificate is bound to (null = all companies in tenant) */
  company_id: string | null;
  /** Storage and provider details */
  storage: CertificateStorage;
  /** ICP-Brasil policy OID */
  policy_oid?: string;
  /** Key usage constraints */
  key_usage?: string[];
}

/** @deprecated Use certificado_id field instead */
export type { DigitalCertificate as Certificate };

// ════════════════════════════════════
// SIGNATURE TYPES
// ════════════════════════════════════

export interface SignatureResult {
  /** The signed XML with embedded <Signature> block */
  signed_xml: string;
  /** Base64 signature value */
  signature_value: string;
  /** Certificate serial used for signing */
  certificate_serial: string;
  /** Certificate ID used */
  certificado_id: string;
  /** Timestamp of signing */
  signed_at: string;
  /** Digest algorithm: always SHA-256 for eSocial */
  digest_algorithm: 'SHA-256';
  /** Signature algorithm */
  signature_algorithm: 'RSA-SHA256';
  /** XML Canonicalization method */
  canonicalization: 'C14N';
}

export interface SignatureValidation {
  valid: boolean;
  certificate_valid: boolean;
  certificate_expired: boolean;
  certificate_type: CertificateType | null;
  certificado_id: string | null;
  errors: string[];
  warnings: string[];
}

export interface CertificateValidationResult {
  valid: boolean;
  days_until_expiry: number;
  is_expired: boolean;
  is_near_expiry: boolean;
  errors: string[];
  warnings: string[];
}

// ════════════════════════════════════
// PORT INTERFACE
// ════════════════════════════════════

export interface IDigitalSigner {
  /** Sign an XML document using the specified certificate */
  sign(xml: string, certificate: DigitalCertificate): Promise<SignatureResult>;

  /** Verify a signed XML's signature integrity */
  verify(signedXml: string): Promise<SignatureValidation>;

  /** List available certificates for a tenant */
  listCertificates(tenantId: string): Promise<DigitalCertificate[]>;

  /** Get a specific certificate by ID */
  getCertificate(certificadoId: string): Promise<DigitalCertificate | null>;

  /** Validate certificate status and expiry */
  validateCertificate(certificate: DigitalCertificate): CertificateValidationResult;

  /** Check if a certificate supports the given event type */
  canSign(certificate: DigitalCertificate, eventType: string): boolean;
}

// ════════════════════════════════════
// A1 ADAPTER INTERFACE (Future)
// ════════════════════════════════════

/**
 * A1 Certificate Adapter — software-based signing.
 * In production: reads PFX from secure storage, extracts RSA key,
 * performs XML-DSig with SHA-256/RSA-SHA256.
 *
 * Integration points:
 *   - Upload PFX via edge function → encrypted storage
 *   - Decrypt PFX at signing time with tenant-specific key
 *   - Extract private key + certificate chain
 *   - Apply enveloped XML signature (XMLDSig)
 */
export interface IA1Adapter extends IDigitalSigner {
  /** Import a PFX file for a tenant */
  importPFX(tenantId: string, pfxBase64: string, password: string): Promise<DigitalCertificate>;
  /** Renew an expiring A1 certificate */
  renewCertificate(certificadoId: string, newPfxBase64: string, password: string): Promise<DigitalCertificate>;
}

// ════════════════════════════════════
// A3 ADAPTER INTERFACE (Future)
// ════════════════════════════════════

/**
 * A3 Certificate Adapter — hardware-based signing.
 * In production: communicates with HSM or smart card reader
 * via PKCS#11 interface.
 *
 * Integration points:
 *   - Connect to HSM endpoint or local PKCS#11 middleware
 *   - Send hash to hardware for signing (private key never leaves device)
 *   - Retrieve signed hash + certificate chain
 */
export interface IA3Adapter extends IDigitalSigner {
  /** Connect to HSM/token and list available certificates */
  connectHSM(endpoint: string, credentials: { slot: string; pin: string }): Promise<DigitalCertificate[]>;
  /** Test connectivity to HSM/token */
  testConnection(certificadoId: string): Promise<{ connected: boolean; latency_ms: number }>;
}

// ════════════════════════════════════
// CERTIFICATE MANAGEMENT UTILITIES
// ════════════════════════════════════

/**
 * Check certificate expiry and generate alerts.
 */
export function checkCertificateExpiry(cert: DigitalCertificate): {
  status: 'valid' | 'expiring_soon' | 'expired';
  days_remaining: number;
  alert_level: 'none' | 'warning' | 'critical';
  message: string;
} {
  const now = new Date();
  const expiry = new Date(cert.validade_certificado);
  const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  if (daysRemaining <= 0) {
    return {
      status: 'expired',
      days_remaining: 0,
      alert_level: 'critical',
      message: `Certificado ${cert.type} (${cert.certificado_id}) expirado em ${cert.validade_certificado.slice(0, 10)}`,
    };
  }
  if (daysRemaining <= 30) {
    return {
      status: 'expiring_soon',
      days_remaining: daysRemaining,
      alert_level: daysRemaining <= 7 ? 'critical' : 'warning',
      message: `Certificado ${cert.type} (${cert.certificado_id}) expira em ${daysRemaining} dias`,
    };
  }
  return {
    status: 'valid',
    days_remaining: daysRemaining,
    alert_level: 'none',
    message: `Certificado ${cert.type} válido por ${daysRemaining} dias`,
  };
}

/**
 * Select the best certificate for signing from a list.
 * Prefers: active → longest validity → A1 over A3 (availability).
 */
export function selectBestCertificate(
  certificates: DigitalCertificate[],
  companyId?: string,
): DigitalCertificate | null {
  const candidates = certificates
    .filter(c => c.is_active)
    .filter(c => {
      const expiry = checkCertificateExpiry(c);
      return expiry.status !== 'expired';
    })
    .filter(c => !companyId || !c.company_id || c.company_id === companyId)
    .sort((a, b) => {
      // Prefer company-specific over tenant-wide
      if (a.company_id && !b.company_id) return -1;
      if (!a.company_id && b.company_id) return 1;
      // Prefer longest remaining validity
      const aExpiry = new Date(a.validade_certificado).getTime();
      const bExpiry = new Date(b.validade_certificado).getTime();
      return bExpiry - aExpiry;
    });

  return candidates[0] ?? null;
}

// ════════════════════════════════════
// SIMULATION ADAPTER (Dev/Test)
// ════════════════════════════════════

export const simulationSigner: IDigitalSigner = {
  async sign(xml: string, certificate: DigitalCertificate): Promise<SignatureResult> {
    const validation = this.validateCertificate(certificate);
    if (!validation.valid) {
      throw new Error(`Certificado inválido: ${validation.errors.join(', ')}`);
    }

    const signatureValue = `SIM_${certificate.type}_SIG_${Date.now()}_${certificate.serial_number}`;
    const signatureBlock = [
      '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">',
      '  <SignedInfo>',
      '    <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
      '    <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>',
      '    <Reference URI="">',
      '      <Transforms>',
      '        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>',
      '        <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
      '      </Transforms>',
      '      <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>',
      `      <DigestValue>SIM_DIGEST_${Date.now()}</DigestValue>`,
      '    </Reference>',
      '  </SignedInfo>',
      `  <SignatureValue>${signatureValue}</SignatureValue>`,
      '  <KeyInfo>',
      '    <X509Data>',
      `      <X509Certificate>${certificate.serial_number}</X509Certificate>`,
      `      <X509SubjectName>${certificate.subject_cn}</X509SubjectName>`,
      '    </X509Data>',
      '  </KeyInfo>',
      '</Signature>',
    ].join('\n');

    const closingTag = '</eSocial>';
    const signedXml = xml.replace(closingTag, `${signatureBlock}\n${closingTag}`);

    return {
      signed_xml: signedXml,
      signature_value: signatureValue,
      certificate_serial: certificate.serial_number,
      certificado_id: certificate.certificado_id,
      signed_at: new Date().toISOString(),
      digest_algorithm: 'SHA-256',
      signature_algorithm: 'RSA-SHA256',
      canonicalization: 'C14N',
    };
  },

  async verify(signedXml: string): Promise<SignatureValidation> {
    const hasSignature = signedXml.includes('<Signature');
    const hasSignatureValue = signedXml.includes('<SignatureValue>');
    const hasCert = signedXml.includes('<X509Certificate>');
    const hasDigest = signedXml.includes('<DigestValue>');

    const errors: string[] = [];
    const warnings: string[] = [];
    if (!hasSignature) errors.push('Assinatura digital não encontrada');
    if (!hasSignatureValue) errors.push('Valor da assinatura ausente');
    if (!hasCert) errors.push('Certificado X509 ausente');
    if (!hasDigest) warnings.push('DigestValue ausente — integridade não verificável');

    // Extract certificate type from signature value
    const sigMatch = signedXml.match(/SIM_(A[13])_SIG/);
    const certType = sigMatch ? (sigMatch[1] as CertificateType) : null;

    return {
      valid: errors.length === 0,
      certificate_valid: hasCert,
      certificate_expired: false,
      certificate_type: certType,
      certificado_id: null,
      errors,
      warnings,
    };
  },

  async listCertificates(tenantId: string): Promise<DigitalCertificate[]> {
    const now = new Date();
    return [
      {
        certificado_id: `cert-a1-sim-${tenantId}`,
        type: 'A1' as CertificateType,
        subject_cn: 'Empresa Simulação LTDA',
        issuer_cn: 'AC Simulação ICP-Brasil',
        serial_number: `SIMA1${Date.now()}`,
        valid_from: now.toISOString(),
        validade_certificado: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        document: '00.000.000/0001-00',
        is_active: true,
        tenant_id: tenantId,
        company_id: null,
        storage: { provider: 'Simulação' },
        key_usage: ['digitalSignature', 'nonRepudiation'],
      },
      {
        certificado_id: `cert-a3-sim-${tenantId}`,
        type: 'A3' as CertificateType,
        subject_cn: 'Empresa Simulação LTDA',
        issuer_cn: 'AC Simulação ICP-Brasil',
        serial_number: `SIMA3${Date.now()}`,
        valid_from: now.toISOString(),
        validade_certificado: new Date(now.getTime() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        document: '00.000.000/0001-00',
        is_active: true,
        tenant_id: tenantId,
        company_id: null,
        storage: { provider: 'Simulação', pkcs11_slot_id: 'SIM_SLOT_0' },
        key_usage: ['digitalSignature', 'nonRepudiation'],
      },
    ];
  },

  async getCertificate(certificadoId: string): Promise<DigitalCertificate | null> {
    const certs = await this.listCertificates('sim');
    return certs.find(c => c.certificado_id === certificadoId) ?? null;
  },

  validateCertificate(certificate: DigitalCertificate): CertificateValidationResult {
    const expiry = checkCertificateExpiry(certificate);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (expiry.status === 'expired') errors.push('Certificado expirado');
    if (!certificate.is_active) errors.push('Certificado revogado ou inativo');

    const now = new Date();
    if (now < new Date(certificate.valid_from)) errors.push('Certificado ainda não é válido');
    if (expiry.status === 'expiring_soon') warnings.push(expiry.message);

    // Type-specific validations
    if (certificate.type === 'A1' && expiry.days_remaining > 366) {
      warnings.push('Certificado A1 com validade superior a 1 ano — verificar autenticidade');
    }
    if (certificate.type === 'A3' && !certificate.storage.pkcs11_slot_id && !certificate.storage.hsm_endpoint) {
      warnings.push('Certificado A3 sem configuração de token/HSM');
    }

    return {
      valid: errors.length === 0,
      days_until_expiry: expiry.days_remaining,
      is_expired: expiry.status === 'expired',
      is_near_expiry: expiry.status === 'expiring_soon',
      errors,
      warnings,
    };
  },

  canSign(_certificate: DigitalCertificate, _eventType: string): boolean {
    return true; // Simulation accepts all
  },
};
