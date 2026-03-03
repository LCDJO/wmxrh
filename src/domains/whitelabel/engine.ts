/**
 * WhiteLabel & Tenant Personalization Engine
 *
 * ╔════════════════════════════════════════════════════════════╗
 * ║  TenantBrandingEngine                                     ║
 * ║   ├── BrandingProfileManager   ← CRUD in-memory cache     ║
 * ║   ├── ThemeGenerator           ← CSS variables from brand  ║
 * ║   ├── ReportTemplateCustomizer ← Report header/footer ctx  ║
 * ║   ├── WhiteLabelValidator      ← Color/URL validation      ║
 * ║   ├── BrandingVersionManager   ← Version tracking          ║
 * ║   └── DefaultFallbackResolver  ← Platform defaults         ║
 * ╚════════════════════════════════════════════════════════════╝
 */

import type {
  TenantBrandingProfile,
  GeneratedTheme,
  ReportBrandingContext,
  BrandingValidationResult,
  WhiteLabelPlanLimits,
  BrandingProfileManagerAPI,
  ThemeGeneratorAPI,
  ReportTemplateCustomizerAPI,
  WhiteLabelValidatorAPI,
  BrandingVersionManagerAPI,
  DefaultFallbackResolverAPI,
  PlanGateAPI,
  TenantBrandingEngineAPI,
} from './types';

// ── Platform Defaults ──

const PLATFORM_DEFAULTS: TenantBrandingProfile = {
  id: '__default__',
  tenant_id: '__default__',
  system_display_name: 'Plataforma RH',
  primary_color: '#0D9668',
  secondary_color: '#1E293B',
  accent_color: '#10B981',
  logo_url: null,
  favicon_url: null,
  custom_login_background: null,
  report_header_logo: null,
  report_footer_text: null,
  is_active: true,
  version_id: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── Hex color regex ──
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const URL_PATTERN = /^https?:\/\/.+/;

// ── Sub-system factories ──

function createBrandingProfileManager(): BrandingProfileManagerAPI {
  const cache = new Map<string, TenantBrandingProfile>();
  return {
    get: (tid) => cache.get(tid) ?? null,
    set: (tid, p) => { cache.set(tid, p); },
    clear: (tid) => { cache.delete(tid); },
  };
}

function createThemeGenerator(
  profiles: BrandingProfileManagerAPI,
  fallback: DefaultFallbackResolverAPI,
): ThemeGeneratorAPI {
  return {
    generate(tenantId) {
      const p = fallback.resolve(tenantId);
      const vars: Record<string, string> = {
        '--brand-primary': p.primary_color,
        '--brand-secondary': p.secondary_color,
        '--brand-accent': p.accent_color,
      };
      return {
        cssVariables: vars,
        tailwindOverrides: {
          primary: p.primary_color,
          secondary: p.secondary_color,
          accent: p.accent_color,
        },
        source: profiles.get(tenantId) ? 'tenant' : 'default',
        version_id: p.version_id,
      } satisfies GeneratedTheme;
    },
  };
}

function createReportTemplateCustomizer(
  fallback: DefaultFallbackResolverAPI,
): ReportTemplateCustomizerAPI {
  return {
    getContext(tenantId): ReportBrandingContext {
      const p = fallback.resolve(tenantId);
      return {
        header_logo_url: p.report_header_logo ?? p.logo_url,
        footer_text: p.report_footer_text,
        primary_color: p.primary_color,
        system_name: p.system_display_name ?? PLATFORM_DEFAULTS.system_display_name!,
      };
    },
  };
}

function createWhiteLabelValidator(): WhiteLabelValidatorAPI {
  return {
    validate(profile) {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (profile.primary_color && !HEX_COLOR.test(profile.primary_color))
        errors.push('primary_color must be a valid hex color');
      if (profile.secondary_color && !HEX_COLOR.test(profile.secondary_color))
        errors.push('secondary_color must be a valid hex color');
      if (profile.accent_color && !HEX_COLOR.test(profile.accent_color))
        errors.push('accent_color must be a valid hex color');

      if (profile.logo_url && !URL_PATTERN.test(profile.logo_url))
        errors.push('logo_url must be a valid URL');
      if (profile.favicon_url && !URL_PATTERN.test(profile.favicon_url))
        errors.push('favicon_url must be a valid URL');

      if (!profile.system_display_name)
        warnings.push('system_display_name not set — platform default will be used');

      return { valid: errors.length === 0, errors, warnings };
    },
  };
}

function createBrandingVersionManager(
  profiles: BrandingProfileManagerAPI,
): BrandingVersionManagerAPI {
  return {
    currentVersion(tenantId) {
      return profiles.get(tenantId)?.version_id ?? 0;
    },
    bump(tenantId) {
      const p = profiles.get(tenantId);
      if (!p) return 1;
      const next = p.version_id + 1;
      profiles.set(tenantId, { ...p, version_id: next, updated_at: new Date().toISOString() });
      return next;
    },
  };
}

function createDefaultFallbackResolver(
  profiles: BrandingProfileManagerAPI,
): DefaultFallbackResolverAPI {
  return {
    getDefaults: () => ({ ...PLATFORM_DEFAULTS }),
    resolve(tenantId) {
      const custom = profiles.get(tenantId);
      if (custom && custom.is_active) return custom;
      return { ...PLATFORM_DEFAULTS, tenant_id: tenantId };
    },
  };
}

// ── Plan Gate ──

const DEFAULT_LIMITS: WhiteLabelPlanLimits = {
  allow_whitelabel: false,
  allow_custom_reports: false,
  allow_custom_domain: false,
};

function createPlanGate(): PlanGateAPI {
  const limitsMap = new Map<string, WhiteLabelPlanLimits>();
  return {
    setLimits: (tid, l) => limitsMap.set(tid, l),
    getLimits: (tid) => limitsMap.get(tid) ?? { ...DEFAULT_LIMITS },
    canWhiteLabel: (tid) => (limitsMap.get(tid)?.allow_whitelabel ?? false),
    canCustomReports: (tid) => (limitsMap.get(tid)?.allow_custom_reports ?? false),
    canCustomDomain: (tid) => (limitsMap.get(tid)?.allow_custom_domain ?? false),
  };
}

// ── Aggregate Factory ──

export function createTenantBrandingEngine(): TenantBrandingEngineAPI {
  const profiles = createBrandingProfileManager();
  const fallback = createDefaultFallbackResolver(profiles);
  const theme = createThemeGenerator(profiles, fallback);
  const reports = createReportTemplateCustomizer(fallback);
  const validator = createWhiteLabelValidator();
  const versioning = createBrandingVersionManager(profiles);
  const planGate = createPlanGate();

  return { profiles, theme, reports, validator, versioning, fallback, planGate };
}
