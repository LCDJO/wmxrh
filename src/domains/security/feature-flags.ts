/**
 * Security Feature Flags
 * 
 * Centralized flags for security features that are "ready" but not yet active.
 * Flip these when the backend infrastructure is in place.
 */

export const SECURITY_FEATURES = {
  /** Multi-Factor Authentication */
  MFA: {
    enabled: false,
    /** When true, MFA enrollment is prompted after login */
    promptOnLogin: false,
    /** Supported MFA methods */
    methods: ['totp'] as const, // Ready for 'sms', 'webauthn' in future
  },

  /** Single Sign-On */
  SSO: {
    enabled: false,
    /** SAML 2.0 ready */
    samlEnabled: false,
    /** OIDC ready */
    oidcEnabled: false,
    /** Allowed identity providers (configured per-tenant) */
    providers: [] as string[],
  },

  /** LGPD (Lei Geral de Proteção de Dados) Compliance */
  LGPD: {
    enabled: false,
    /** Require consent before processing personal data */
    requireConsent: false,
    /** Enable data export (portability) */
    dataExportEnabled: false,
    /** Enable data anonymization on deletion */
    anonymizeOnDelete: false,
    /** Consent expiry in days (0 = never) */
    consentExpiryDays: 365,
  },

  /** Data Masking for sensitive fields */
  DATA_MASKING: {
    enabled: true, // Can be activated immediately
    /** Fields that are masked based on role */
    maskedFields: {
      salary: true,
      cpf: true,
      bankData: true,
    },
  },
} as const;

export type SecurityFeatureKey = keyof typeof SECURITY_FEATURES;
