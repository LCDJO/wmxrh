/**
 * WhiteLabel Kernel Events — Event Sourcing for branding lifecycle.
 *
 * Events:
 *   BrandingUpdated          → tenant branding profile changed
 *   BrandingVersionCreated   → new branding version snapshot stored
 *   CustomDomainConfigured   → tenant configured a custom domain
 *   WhiteLabelActivated      → tenant activated whitelabel capability
 */

export const WHITELABEL_KERNEL_EVENTS = {
  BrandingUpdated: 'whitelabel:BrandingUpdated',
  BrandingVersionCreated: 'whitelabel:BrandingVersionCreated',
  CustomDomainConfigured: 'whitelabel:CustomDomainConfigured',
  WhiteLabelActivated: 'whitelabel:WhiteLabelActivated',
} as const;

export type WhiteLabelKernelEvent =
  typeof WHITELABEL_KERNEL_EVENTS[keyof typeof WHITELABEL_KERNEL_EVENTS];

// ── Payload types ───────────────────────────────────────────────

export interface BrandingUpdatedPayload {
  tenant_id: string;
  updated_by?: string;
  changed_fields: string[];
  timestamp: string;
}

export interface BrandingVersionCreatedPayload {
  tenant_id: string;
  version_id: string;
  version_number: number;
  created_by?: string;
  timestamp: string;
}

export interface CustomDomainConfiguredPayload {
  tenant_id: string;
  domain: string;
  configured_by?: string;
  timestamp: string;
}

export interface WhiteLabelActivatedPayload {
  tenant_id: string;
  plan_id: string;
  activated_by?: string;
  timestamp: string;
}
