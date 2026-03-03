/**
 * WhiteLabel & Tenant Personalization Engine — Barrel Export
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

export { createTenantBrandingEngine } from './engine';

export type {
  TenantBrandingProfile,
  CreateBrandingProfileDTO,
  UpdateBrandingProfileDTO,
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
  BrandingArchitectureVersion,
  ArchitectureVersionRegistryAPI,
  TenantBrandingEngineAPI,
} from './types';

export { WHITELABEL_KERNEL_EVENTS } from './whitelabel-events';
export type {
  WhiteLabelKernelEvent,
  BrandingUpdatedPayload,
  BrandingVersionCreatedPayload,
  CustomDomainConfiguredPayload,
  WhiteLabelActivatedPayload,
} from './whitelabel-events';
