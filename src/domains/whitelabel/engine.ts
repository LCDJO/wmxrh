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

// ── Hex color regex & sanitization ──
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const URL_PATTERN = /^https?:\/\/.+/;
const SAFE_CSS_VALUE = /^[a-zA-Z0-9#(),.\-_%\s\/]+$/;

/** Sanitize a CSS value — reject anything that could inject code */
function sanitizeCssValue(value: string): string {
  const trimmed = value.trim();
  if (!SAFE_CSS_VALUE.test(trimmed)) return '';
  // Block url(), expression(), javascript:, @import etc.
  const lower = trimmed.toLowerCase();
  if (lower.includes('url(') || lower.includes('expression(') ||
      lower.includes('javascript:') || lower.includes('@import') ||
      lower.includes('<') || lower.includes('>')) {
    return '';
  }
  return trimmed;
}

/** Convert hex color to HSL string for CSS variables */
function hexToHsl(hex: string): string {
  const sanitized = sanitizeCssValue(hex);
  if (!HEX_COLOR.test(sanitized)) return '';
  let r = 0, g = 0, b = 0;
  const h = sanitized.replace('#', '');
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16) / 255;
    g = parseInt(h[1] + h[1], 16) / 255;
    b = parseInt(h[2] + h[2], 16) / 255;
  } else {
    r = parseInt(h.substring(0, 2), 16) / 255;
    g = parseInt(h.substring(2, 4), 16) / 255;
    b = parseInt(h.substring(4, 6), 16) / 255;
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / d + 2) * 60;
  else hue = ((r - g) / d + 4) * 60;
  return `${Math.round(hue)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Lighten HSL lightness for dark mode */
function lightenHsl(hsl: string, amount: number): string {
  const parts = hsl.split(/\s+/);
  if (parts.length < 3) return hsl;
  const l = parseInt(parts[2]);
  return `${parts[0]} ${parts[1]} ${Math.min(100, l + amount)}%`;
}

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

      const primaryHsl = hexToHsl(p.primary_color) || '160 84% 29%';
      const secondaryHsl = hexToHsl(p.secondary_color) || '215 25% 15%';
      const accentHsl = hexToHsl(p.accent_color) || '160 60% 94%';

      // Light mode variables
      const vars: Record<string, string> = {
        '--brand-primary': primaryHsl,
        '--brand-secondary': secondaryHsl,
        '--brand-accent': accentHsl,
        '--brand-primary-hex': sanitizeCssValue(p.primary_color),
        '--brand-secondary-hex': sanitizeCssValue(p.secondary_color),
        '--brand-accent-hex': sanitizeCssValue(p.accent_color),
      };

      // Dark mode — lighten primary & accent
      const darkVars: Record<string, string> = {
        '--brand-primary': lightenHsl(primaryHsl, 16),
        '--brand-secondary': lightenHsl(secondaryHsl, 8),
        '--brand-accent': lightenHsl(accentHsl, 10),
        '--brand-primary-hex': sanitizeCssValue(p.primary_color),
        '--brand-secondary-hex': sanitizeCssValue(p.secondary_color),
        '--brand-accent-hex': sanitizeCssValue(p.accent_color),
      };

      // Build safe CSS text
      const cssText = Object.entries(vars)
        .map(([k, v]) => `${k}: ${v};`)
        .join('\n  ');
      const darkCssText = Object.entries(darkVars)
        .map(([k, v]) => `${k}: ${v};`)
        .join('\n  ');

      return {
        cssVariables: vars,
        darkCssVariables: darkVars,
        tailwindOverrides: {
          primary: sanitizeCssValue(p.primary_color),
          secondary: sanitizeCssValue(p.secondary_color),
          accent: sanitizeCssValue(p.accent_color),
        },
        source: profiles.get(tenantId) ? 'tenant' : 'default',
        version_id: p.version_id,
        cssText: `:root {\n  ${cssText}\n}`,
        darkCssText: `.dark {\n  ${darkCssText}\n}`,
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
