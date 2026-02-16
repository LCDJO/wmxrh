/**
 * eSocial Digital Signer — Port (Adapter Pattern)
 *
 * Defines the contract for digital signature of eSocial XML documents.
 * Brazilian eSocial requires ICP-Brasil A1 or A3 certificates.
 *
 * This is a PORT — the actual crypto implementation is injected as an adapter.
 * In production, this would connect to a certificate service or HSM.
 * Currently provides a simulation adapter for development/testing.
 */

import type { ESocialEnvelope } from './types';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export type CertificateType = 'A1' | 'A3';

export interface DigitalCertificate {
  id: string;
  type: CertificateType;
  subject_cn: string;        // Common name (e.g. company name)
  issuer_cn: string;         // Certificate authority
  serial_number: string;
  valid_from: string;
  valid_until: string;
  /** CNPJ/CPF associated */
  document: string;
  /** Whether the cert is currently valid and not revoked */
  is_active: boolean;
}

export interface SignatureResult {
  signed_xml: string;
  signature_value: string;
  certificate_serial: string;
  signed_at: string;
  digest_algorithm: 'SHA-256';
  signature_algorithm: 'RSA-SHA256';
}

export interface SignatureValidation {
  valid: boolean;
  certificate_valid: boolean;
  certificate_expired: boolean;
  errors: string[];
}

// ════════════════════════════════════
// PORT INTERFACE
// ════════════════════════════════════

export interface IDigitalSigner {
  /** Sign an XML document with the active certificate */
  sign(xml: string, certificate: DigitalCertificate): Promise<SignatureResult>;
  /** Verify a signed XML's signature integrity */
  verify(signedXml: string): Promise<SignatureValidation>;
  /** List available certificates */
  listCertificates(tenantId: string): Promise<DigitalCertificate[]>;
  /** Check if a certificate is valid and not expired */
  validateCertificate(certificate: DigitalCertificate): CertificateValidationResult;
}

export interface CertificateValidationResult {
  valid: boolean;
  days_until_expiry: number;
  errors: string[];
  warnings: string[];
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

    // Simulated signature — in production, use WebCrypto or external HSM
    const signatureValue = `SIM_SIG_${Date.now()}_${certificate.serial_number}`;
    const signatureBlock = [
      '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">',
      '  <SignedInfo>',
      '    <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
      '    <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>',
      '  </SignedInfo>',
      `  <SignatureValue>${signatureValue}</SignatureValue>`,
      '  <KeyInfo>',
      `    <X509Data><X509Certificate>${certificate.serial_number}</X509Certificate></X509Data>`,
      '  </KeyInfo>',
      '</Signature>',
    ].join('\n');

    const closingTag = '</eSocial>';
    const signedXml = xml.replace(closingTag, `${signatureBlock}\n${closingTag}`);

    return {
      signed_xml: signedXml,
      signature_value: signatureValue,
      certificate_serial: certificate.serial_number,
      signed_at: new Date().toISOString(),
      digest_algorithm: 'SHA-256',
      signature_algorithm: 'RSA-SHA256',
    };
  },

  async verify(signedXml: string): Promise<SignatureValidation> {
    const hasSignature = signedXml.includes('<Signature');
    const hasSignatureValue = signedXml.includes('<SignatureValue>');
    const hasCert = signedXml.includes('<X509Certificate>');

    const errors: string[] = [];
    if (!hasSignature) errors.push('Assinatura digital não encontrada');
    if (!hasSignatureValue) errors.push('Valor da assinatura ausente');
    if (!hasCert) errors.push('Certificado X509 ausente');

    return {
      valid: errors.length === 0,
      certificate_valid: hasCert,
      certificate_expired: false,
      errors,
    };
  },

  async listCertificates(tenantId: string): Promise<DigitalCertificate[]> {
    // Simulated — in production, query certificate store
    return [{
      id: `cert-sim-${tenantId}`,
      type: 'A1',
      subject_cn: 'Empresa Simulação LTDA',
      issuer_cn: 'AC Simulação',
      serial_number: `SIM${Date.now()}`,
      valid_from: new Date().toISOString(),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      document: '00.000.000/0001-00',
      is_active: true,
    }];
  },

  validateCertificate(certificate: DigitalCertificate): CertificateValidationResult {
    const now = new Date();
    const expiry = new Date(certificate.valid_until);
    const start = new Date(certificate.valid_from);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    const errors: string[] = [];
    const warnings: string[] = [];

    if (now < start) errors.push('Certificado ainda não é válido');
    if (now > expiry) errors.push('Certificado expirado');
    if (!certificate.is_active) errors.push('Certificado revogado ou inativo');
    if (daysUntilExpiry > 0 && daysUntilExpiry <= 30) {
      warnings.push(`Certificado expira em ${daysUntilExpiry} dias`);
    }

    return {
      valid: errors.length === 0,
      days_until_expiry: Math.max(daysUntilExpiry, 0),
      errors,
      warnings,
    };
  },
};
