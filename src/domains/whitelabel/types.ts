/**
 * WhiteLabel & Tenant Personalization Engine — Types
 */

// ── Branding Profile ──

export interface TenantBrandingProfile {
  id: string;
  tenant_id: string;
  system_display_name: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  custom_login_background: string | null;
  report_header_logo: string | null;
  report_footer_text: string | null;
  is_active: boolean;
  version_id: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBrandingProfileDTO {
  tenant_id: string;
  system_display_name?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  favicon_url?: string;
  custom_login_background?: string;
  report_header_logo?: string;
  report_footer_text?: string;
}

export interface UpdateBrandingProfileDTO {
  system_display_name?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  favicon_url?: string;
  custom_login_background?: string;
  report_header_logo?: string;
  report_footer_text?: string;
}

// ── Theme Generation ──

export interface GeneratedTheme {
  cssVariables: Record<string, string>;
  darkCssVariables: Record<string, string>;
  tailwindOverrides: Record<string, string>;
  source: 'tenant' | 'default';
  version_id: number;
  /** Sanitized CSS text for light mode injection */
  cssText: string;
  /** Sanitized CSS text for dark mode injection */
  darkCssText: string;
}

// ── Report Customization ──

export interface ReportBrandingContext {
  header_logo_url: string | null;
  footer_text: string | null;
  primary_color: string;
  system_name: string;
}

// ── Plan Limits (WhiteLabel enablement) ──

export interface WhiteLabelPlanLimits {
  allow_whitelabel: boolean;
  allow_custom_reports: boolean;
  allow_custom_domain: boolean;
}

// ── Validation ──

export interface BrandingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Sub-system APIs ──

export interface BrandingProfileManagerAPI {
  get(tenantId: string): TenantBrandingProfile | null;
  set(tenantId: string, profile: TenantBrandingProfile): void;
  clear(tenantId: string): void;
}

export interface ThemeGeneratorAPI {
  generate(tenantId: string): GeneratedTheme;
}

export interface ReportTemplateCustomizerAPI {
  getContext(tenantId: string): ReportBrandingContext;
}

export interface WhiteLabelValidatorAPI {
  validate(profile: Partial<TenantBrandingProfile>): BrandingValidationResult;
}

export interface BrandingVersionManagerAPI {
  currentVersion(tenantId: string): number;
  bump(tenantId: string): number;
}

export interface DefaultFallbackResolverAPI {
  getDefaults(): TenantBrandingProfile;
  resolve(tenantId: string): TenantBrandingProfile;
}

export interface PlanGateAPI {
  setLimits(tenantId: string, limits: WhiteLabelPlanLimits): void;
  getLimits(tenantId: string): WhiteLabelPlanLimits;
  canWhiteLabel(tenantId: string): boolean;
  canCustomReports(tenantId: string): boolean;
  canCustomDomain(tenantId: string): boolean;
}

export interface TenantBrandingEngineAPI {
  profiles: BrandingProfileManagerAPI;
  theme: ThemeGeneratorAPI;
  reports: ReportTemplateCustomizerAPI;
  validator: WhiteLabelValidatorAPI;
  versioning: BrandingVersionManagerAPI;
  fallback: DefaultFallbackResolverAPI;
  planGate: PlanGateAPI;
}
