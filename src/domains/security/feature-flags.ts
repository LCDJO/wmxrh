/**
 * Security Feature Flags
 * 
 * Centralized flags for security features and business modules.
 * 
 * Two layers:
 *   1. SECURITY_FEATURES — static config (code-level defaults)
 *   2. feature_flags table — dynamic per tenant/group/company (DB)
 * 
 * The FeatureFlagEngine merges both: DB overrides static.
 */

// ════════════════════════════════════
// STATIC SECURITY FEATURES (code-level defaults)
// ════════════════════════════════════

export const SECURITY_FEATURES = {
  /** Multi-Factor Authentication */
  MFA: {
    enabled: false,
    promptOnLogin: false,
    methods: ['totp'] as const,
  },

  /** Single Sign-On */
  SSO: {
    enabled: false,
    samlEnabled: false,
    oidcEnabled: false,
    providers: [] as string[],
  },

  /** LGPD (Lei Geral de Proteção de Dados) Compliance */
  LGPD: {
    enabled: false,
    requireConsent: false,
    dataExportEnabled: false,
    anonymizeOnDelete: false,
    consentExpiryDays: 365,
  },

  /** Data Masking for sensitive fields */
  DATA_MASKING: {
    enabled: true,
    maskedFields: {
      salary: true,
      cpf: true,
      bankData: true,
    },
  },
} as const;

export type SecurityFeatureKey = keyof typeof SECURITY_FEATURES;

// ════════════════════════════════════
// BUSINESS MODULE FLAGS (dynamic, DB-driven)
// ════════════════════════════════════

/**
 * Known business feature names.
 * These are stored in the feature_flags table and scoped per tenant/group/company.
 */
export const BUSINESS_FEATURES = [
  'payroll_module',
  'advanced_analytics',
  'performance_reviews',
  'time_tracking',
  'benefits_management',
  'recruitment',
  'onboarding_workflow',
  'document_management',
  'labor_compliance',
  'occupational_health',
] as const;

export type BusinessFeatureKey = typeof BUSINESS_FEATURES[number];

/** Union of all feature keys */
export type FeatureKey = SecurityFeatureKey | BusinessFeatureKey;
