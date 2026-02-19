/**
 * DeveloperPlatformEngine — Core orchestration engine for Developer Portal & API Marketplace.
 *
 * Integrations:
 *  - PAMS (ApiKeyManager, ApiScopeResolver, ApiRateLimiter)
 *  - BillingCore (subscription billing for API plans)
 *  - TenantSandboxEngine (isolated sandbox environments)
 *  - ModuleVersionRegistry (API version resolution)
 *  - Security Kernel (OAuth flows, scope enforcement, audit)
 *  - Unified Graph Engine (developer access analysis)
 *  - Control Plane (developer ecosystem metrics)
 *
 * Subsystems:
 *  ├── DeveloperRegistry        — Developer/partner onboarding & verification
 *  ├── AppRegistrationService   — App lifecycle (draft → published)
 *  ├── OAuthClientManager       — OAuth 2.0 client credentials management
 *  ├── ApiSubscriptionManager   — API product subscription & quota management
 *  ├── MarketplaceCatalog       — Public marketplace listing & discovery
 *  ├── AppReviewWorkflow        — Multi-stage app review (automated + manual + security)
 *  ├── IntegrationSandboxService— Sandbox provisioning & lifecycle
 *  └── DeveloperAnalytics       — Usage, revenue & adoption metrics
 */

// ── Types ──

export type DeveloperTier = 'free' | 'starter' | 'professional' | 'enterprise';
export type VerificationLevel = 'unverified' | 'email_verified' | 'identity_verified' | 'partner_verified';
export type AppStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'published' | 'suspended' | 'rejected';
export type AppType = 'public' | 'private' | 'internal';
export type ReviewStage = 'automated' | 'manual' | 'security';
export type ReviewResult = 'pending' | 'in_progress' | 'passed' | 'failed' | 'waived';
export type PricingModel = 'free' | 'freemium' | 'paid' | 'contact_sales';
export type SandboxStatus = 'provisioning' | 'active' | 'expired' | 'terminated';

export interface DeveloperRegistrationRequest {
  userId: string;
  organizationName: string;
  organizationType: 'individual' | 'company' | 'partner' | 'internal';
  email: string;
  websiteUrl?: string;
  acceptTosVersion: string;
}

export interface DeveloperRegistrationResult {
  developerId: string;
  status: 'pending_verification' | 'active';
  verificationLevel: VerificationLevel;
  tier: DeveloperTier;
  apiKeyPrefix?: string;
}

export interface AppRegistrationRequest {
  developerId: string;
  name: string;
  description: string;
  category: string;
  appType: AppType;
  requiredScopes: string[];
  optionalScopes?: string[];
  redirectUris?: string[];
  webhookUrl?: string;
  homepageUrl?: string;
  privacyPolicyUrl?: string;
}

export interface AppRegistrationResult {
  appId: string;
  slug: string;
  status: AppStatus;
  oauthClientId?: string;
}

export interface OAuthClientCredentials {
  clientId: string;
  clientSecret: string;       // Only returned once at creation
  clientIdHash: string;
  grantTypes: string[];
  tokenLifetimeSeconds: number;
}

export interface OAuthRotationResult {
  newClientId: string;
  newClientSecret: string;    // Only returned once
  oldClientRevokedAt: string;
  gracePeriodEnds?: string;
}

export interface ApiSubscriptionRequest {
  appId: string;
  developerId: string;
  apiProductId: string;
  planTier: string;
}

export interface ApiSubscriptionResult {
  subscriptionId: string;
  status: 'active';
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  quotaRemaining: number;
  billingExternalId?: string;
}

export interface MarketplaceSearchParams {
  query?: string;
  category?: string;
  pricingModel?: PricingModel;
  sortBy?: 'installs' | 'rating' | 'newest';
  page?: number;
  pageSize?: number;
}

export interface MarketplaceSearchResult {
  apps: MarketplaceAppCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MarketplaceAppCard {
  appId: string;
  name: string;
  slug: string;
  description: string;
  logoUrl?: string;
  category: string;
  pricingModel: PricingModel;
  priceMonthlyBrl?: number;
  installCount: number;
  ratingAvg?: number;
  ratingCount: number;
  developerName: string;
  verified: boolean;
}

export interface ReviewChecklistItem {
  id: string;
  label: string;
  stage: ReviewStage;
  required: boolean;
  autoCheck?: boolean;
}

export interface AppReviewResult {
  reviewId: string;
  stage: ReviewStage;
  result: ReviewResult;
  findings: string[];
  checklist: Record<string, boolean>;
}

export interface SandboxProvisionRequest {
  developerId: string;
  appId: string;
  seedDataTemplate?: string;
  ttlHours?: number;
}

export interface SandboxProvisionResult {
  sessionId: string;
  environmentId: string;
  apiBaseUrl: string;
  status: SandboxStatus;
  expiresAt: string;
  credentials: {
    apiKey: string;
    tenantId: string;
  };
}

export interface DeveloperDashboardMetrics {
  totalApps: number;
  publishedApps: number;
  totalInstalls: number;
  totalApiCalls: number;
  errorRate: number;
  avgLatencyMs: number;
  revenue30dBrl: number;
  activeSandboxes: number;
  topEndpoints: Array<{ endpoint: string; calls: number }>;
}

// ══════════════════════════════════════════════
//  DeveloperRegistry
// ══════════════════════════════════════════════

export class DeveloperRegistry {
  private readonly TIER_LIMITS: Record<DeveloperTier, { maxApps: number; maxSandboxes: number; apiCallsPerDay: number }> = {
    free:         { maxApps: 2,  maxSandboxes: 1,  apiCallsPerDay: 1_000 },
    starter:      { maxApps: 5,  maxSandboxes: 3,  apiCallsPerDay: 10_000 },
    professional: { maxApps: 20, maxSandboxes: 10, apiCallsPerDay: 100_000 },
    enterprise:   { maxApps: -1, maxSandboxes: -1, apiCallsPerDay: -1 },
  };

  register(request: DeveloperRegistrationRequest): DeveloperRegistrationResult {
    const developerId = crypto.randomUUID();

    console.info(`[DevPortal] Developer registered: ${request.organizationName} (${request.organizationType})`);

    return {
      developerId,
      status: 'pending_verification',
      verificationLevel: 'unverified',
      tier: 'free',
    };
  }

  verify(developerId: string, level: VerificationLevel): { verified: boolean; newTier?: DeveloperTier } {
    console.info(`[DevPortal] Developer ${developerId} verified at level: ${level}`);

    const tierUpgrade: Record<VerificationLevel, DeveloperTier | undefined> = {
      unverified: undefined,
      email_verified: undefined,
      identity_verified: 'starter',
      partner_verified: 'professional',
    };

    return { verified: true, newTier: tierUpgrade[level] };
  }

  getTierLimits(tier: DeveloperTier) {
    return this.TIER_LIMITS[tier];
  }

  canCreateApp(tier: DeveloperTier, currentAppCount: number): boolean {
    const limits = this.TIER_LIMITS[tier];
    return limits.maxApps === -1 || currentAppCount < limits.maxApps;
  }
}

// ══════════════════════════════════════════════
//  AppRegistrationService
// ══════════════════════════════════════════════

export class AppRegistrationService {
  private readonly RESERVED_SLUGS = new Set(['api', 'admin', 'platform', 'system', 'internal', 'marketplace', 'docs']);

  register(request: AppRegistrationRequest): AppRegistrationResult {
    const slug = this.generateSlug(request.name);

    if (this.RESERVED_SLUGS.has(slug)) {
      throw new Error(`App slug "${slug}" is reserved.`);
    }

    const appId = crypto.randomUUID();
    console.info(`[DevPortal] App registered: ${request.name} (${appId})`);

    return {
      appId,
      slug,
      status: 'draft',
    };
  }

  submitForReview(appId: string): { submitted: boolean; missingFields: string[] } {
    // In production, validate required fields before submission
    console.info(`[DevPortal] App ${appId} submitted for review`);
    return { submitted: true, missingFields: [] };
  }

  transitionStatus(appId: string, from: AppStatus, to: AppStatus): boolean {
    const VALID_TRANSITIONS: Record<AppStatus, AppStatus[]> = {
      draft:      ['submitted'],
      submitted:  ['in_review', 'rejected'],
      in_review:  ['approved', 'rejected'],
      approved:   ['published'],
      published:  ['suspended'],
      suspended:  ['published', 'rejected'],
      rejected:   ['draft'],
    };

    const allowed = VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      console.warn(`[DevPortal] Invalid app transition: ${from} → ${to}`);
      return false;
    }

    console.info(`[DevPortal] App ${appId}: ${from} → ${to}`);
    return true;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
  }
}

// ══════════════════════════════════════════════
//  OAuthClientManager
// ══════════════════════════════════════════════

export class OAuthClientManager {
  private readonly SUPPORTED_GRANT_TYPES = ['client_credentials', 'authorization_code', 'refresh_token'] as const;
  private readonly DEFAULT_TOKEN_LIFETIME = 3600;        // 1 hour
  private readonly DEFAULT_REFRESH_LIFETIME = 2_592_000; // 30 days

  createCredentials(appId: string, scopes: string[], redirectUris: string[]): OAuthClientCredentials {
    const clientId = `app_${appId.substring(0, 8)}_${this.generateRandomHex(16)}`;
    const clientSecret = `secret_${this.generateRandomHex(48)}`;

    // In production, store only hashes
    const encoder = new TextEncoder();
    const clientIdHash = this.simpleHash(encoder.encode(clientId));
    
    console.info(`[DevPortal] OAuth client created for app ${appId}`);

    return {
      clientId,
      clientSecret,
      clientIdHash,
      grantTypes: [...this.SUPPORTED_GRANT_TYPES],
      tokenLifetimeSeconds: this.DEFAULT_TOKEN_LIFETIME,
    };
  }

  rotate(appId: string, oldClientId: string): OAuthRotationResult {
    const newCreds = this.createCredentials(appId, [], []);
    const now = new Date();
    const gracePeriodEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h grace

    console.info(`[DevPortal] OAuth client rotated for app ${appId}. Grace period ends: ${gracePeriodEnd.toISOString()}`);

    return {
      newClientId: newCreds.clientId,
      newClientSecret: newCreds.clientSecret,
      oldClientRevokedAt: gracePeriodEnd.toISOString(),
      gracePeriodEnds: gracePeriodEnd.toISOString(),
    };
  }

  validateScopes(requestedScopes: string[], allowedScopes: string[]): { valid: boolean; denied: string[] } {
    const denied = requestedScopes.filter(s => !allowedScopes.includes(s));
    return { valid: denied.length === 0, denied };
  }

  private generateRandomHex(length: number): string {
    const chars = '0123456789abcdef';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private simpleHash(data: Uint8Array): string {
    let hash = 0;
    for (const byte of data) {
      hash = ((hash << 5) - hash + byte) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

// ══════════════════════════════════════════════
//  ApiSubscriptionManager
// ══════════════════════════════════════════════

export class ApiSubscriptionManager {
  private readonly PLAN_QUOTAS: Record<string, { rpm: number; rpd: number; monthlyBrl: number }> = {
    free:         { rpm: 10,    rpd: 1_000,    monthlyBrl: 0 },
    starter:      { rpm: 60,    rpd: 10_000,   monthlyBrl: 49 },
    professional: { rpm: 300,   rpd: 100_000,  monthlyBrl: 199 },
    enterprise:   { rpm: 1_000, rpd: 1_000_000, monthlyBrl: 999 },
  };

  subscribe(request: ApiSubscriptionRequest): ApiSubscriptionResult {
    const quota = this.PLAN_QUOTAS[request.planTier] || this.PLAN_QUOTAS.free;
    const subscriptionId = crypto.randomUUID();

    console.info(`[DevPortal] API subscription created: ${request.appId} → ${request.apiProductId} (${request.planTier})`);

    return {
      subscriptionId,
      status: 'active',
      rateLimitPerMinute: quota.rpm,
      rateLimitPerDay: quota.rpd,
      quotaRemaining: quota.rpd,
    };
  }

  getQuota(planTier: string) {
    return this.PLAN_QUOTAS[planTier] || this.PLAN_QUOTAS.free;
  }

  checkUsageThreshold(currentUsage: number, dailyLimit: number): { threshold: number; warning: boolean; blocked: boolean } {
    const threshold = dailyLimit > 0 ? currentUsage / dailyLimit : 0;
    return {
      threshold: Math.round(threshold * 100),
      warning: threshold >= 0.8,
      blocked: threshold >= 1.0,
    };
  }
}

// ══════════════════════════════════════════════
//  MarketplaceCatalog
// ══════════════════════════════════════════════

export class MarketplaceCatalog {
  private readonly CATEGORIES = [
    'analytics', 'automation', 'communication', 'compliance',
    'crm', 'finance', 'hr', 'integration', 'productivity',
    'reporting', 'security', 'utilities',
  ] as const;

  getCategories(): readonly string[] {
    return this.CATEGORIES;
  }

  search(params: MarketplaceSearchParams): MarketplaceSearchResult {
    // Engine-level search logic (actual data comes from gateway)
    console.info(`[DevPortal] Marketplace search: ${JSON.stringify(params)}`);
    return {
      apps: [],
      total: 0,
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    };
  }

  calculateListingScore(app: { installCount: number; ratingAvg?: number; ratingCount: number; publishedDaysAgo: number }): number {
    const installScore = Math.min(app.installCount / 100, 1) * 30;
    const ratingScore = (app.ratingAvg || 0) / 5 * 30;
    const reviewScore = Math.min(app.ratingCount / 20, 1) * 20;
    const freshnessScore = Math.max(0, 1 - app.publishedDaysAgo / 365) * 20;

    return Math.round(installScore + ratingScore + reviewScore + freshnessScore);
  }
}

// ══════════════════════════════════════════════
//  AppReviewWorkflow
// ══════════════════════════════════════════════

export class AppReviewWorkflow {
  private readonly REVIEW_STAGES: ReviewStage[] = ['automated', 'manual', 'security'];

  private readonly AUTOMATED_CHECKS: ReviewChecklistItem[] = [
    { id: 'valid_manifest', label: 'Valid app manifest', stage: 'automated', required: true, autoCheck: true },
    { id: 'valid_scopes', label: 'All requested scopes exist', stage: 'automated', required: true, autoCheck: true },
    { id: 'redirect_uri_https', label: 'Redirect URIs use HTTPS', stage: 'automated', required: true, autoCheck: true },
    { id: 'privacy_policy', label: 'Privacy policy URL provided', stage: 'automated', required: true, autoCheck: true },
    { id: 'logo_provided', label: 'App logo uploaded', stage: 'automated', required: false, autoCheck: true },
    { id: 'description_length', label: 'Description ≥ 50 chars', stage: 'automated', required: true, autoCheck: true },
  ];

  private readonly SECURITY_CHECKS: ReviewChecklistItem[] = [
    { id: 'no_excessive_scopes', label: 'No excessive scope requests', stage: 'security', required: true },
    { id: 'webhook_validated', label: 'Webhook endpoint validated', stage: 'security', required: false },
    { id: 'rate_limit_appropriate', label: 'Rate limit tier appropriate', stage: 'security', required: true },
    { id: 'data_handling_reviewed', label: 'Data handling practices reviewed', stage: 'security', required: true },
  ];

  getChecklist(): ReviewChecklistItem[] {
    return [...this.AUTOMATED_CHECKS, ...this.SECURITY_CHECKS];
  }

  runAutomatedReview(app: { description?: string; privacyPolicyUrl?: string; logoUrl?: string; requiredScopes: string[]; redirectUris?: string[] }): AppReviewResult {
    const findings: string[] = [];
    const checklist: Record<string, boolean> = {};

    // Valid manifest
    checklist['valid_manifest'] = true;

    // Description length
    checklist['description_length'] = (app.description?.length || 0) >= 50;
    if (!checklist['description_length']) findings.push('Description must be at least 50 characters.');

    // Privacy policy
    checklist['privacy_policy'] = !!app.privacyPolicyUrl;
    if (!checklist['privacy_policy']) findings.push('Privacy policy URL is required.');

    // Redirect URIs use HTTPS
    const uris = app.redirectUris || [];
    checklist['redirect_uri_https'] = uris.length === 0 || uris.every(u => u.startsWith('https://') || u.startsWith('http://localhost'));
    if (!checklist['redirect_uri_https']) findings.push('All redirect URIs must use HTTPS (localhost exceptions allowed).');

    // Logo
    checklist['logo_provided'] = !!app.logoUrl;

    // Scopes exist (simplified — in production checks against ApiScopeResolver)
    checklist['valid_scopes'] = app.requiredScopes.length > 0;
    if (!checklist['valid_scopes']) findings.push('At least one scope must be requested.');

    const allRequiredPassed = this.AUTOMATED_CHECKS
      .filter(c => c.required)
      .every(c => checklist[c.id]);

    return {
      reviewId: crypto.randomUUID(),
      stage: 'automated',
      result: allRequiredPassed ? 'passed' : 'failed',
      findings,
      checklist,
    };
  }

  getNextStage(currentStage: ReviewStage): ReviewStage | null {
    const idx = this.REVIEW_STAGES.indexOf(currentStage);
    return idx < this.REVIEW_STAGES.length - 1 ? this.REVIEW_STAGES[idx + 1] : null;
  }
}

// ══════════════════════════════════════════════
//  IntegrationSandboxService
// ══════════════════════════════════════════════

export class IntegrationSandboxService {
  private readonly DEFAULT_TTL_HOURS = 24;
  private readonly MAX_TTL_HOURS = 168; // 7 days

  provision(request: SandboxProvisionRequest): SandboxProvisionResult {
    const ttl = Math.min(request.ttlHours || this.DEFAULT_TTL_HOURS, this.MAX_TTL_HOURS);
    const sessionId = crypto.randomUUID();
    const environmentId = `sandbox_${sessionId.substring(0, 8)}`;
    const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000);

    console.info(`[DevPortal] Sandbox provisioned: ${environmentId} (TTL: ${ttl}h)`);

    return {
      sessionId,
      environmentId,
      apiBaseUrl: `/api/sandbox/${environmentId}`,
      status: 'active',
      expiresAt: expiresAt.toISOString(),
      credentials: {
        apiKey: `sbx_${this.generateRandomHex(32)}`,
        tenantId: `tenant_sandbox_${sessionId.substring(0, 8)}`,
      },
    };
  }

  isExpired(expiresAt: string): boolean {
    return new Date(expiresAt).getTime() < Date.now();
  }

  getRemainingTime(expiresAt: string): { hours: number; minutes: number; expired: boolean } {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return { hours: 0, minutes: 0, expired: true };
    return {
      hours: Math.floor(remaining / 3_600_000),
      minutes: Math.floor((remaining % 3_600_000) / 60_000),
      expired: false,
    };
  }

  private generateRandomHex(length: number): string {
    const chars = '0123456789abcdef';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}

// ══════════════════════════════════════════════
//  DeveloperAnalytics
// ══════════════════════════════════════════════

export class DeveloperAnalytics {
  computeDashboard(snapshots: Array<{ total_api_calls: number; error_calls: number; avg_latency_ms?: number; active_installs: number; revenue_brl?: number }>): DeveloperDashboardMetrics {
    const totalCalls = snapshots.reduce((sum, s) => sum + s.total_api_calls, 0);
    const totalErrors = snapshots.reduce((sum, s) => sum + s.error_calls, 0);
    const totalInstalls = snapshots.reduce((max, s) => Math.max(max, s.active_installs), 0);
    const revenue = snapshots.reduce((sum, s) => sum + (s.revenue_brl || 0), 0);
    const latencies = snapshots.filter(s => s.avg_latency_ms != null).map(s => s.avg_latency_ms!);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    return {
      totalApps: 0,        // filled by caller
      publishedApps: 0,    // filled by caller
      totalInstalls,
      totalApiCalls: totalCalls,
      errorRate: totalCalls > 0 ? Math.round((totalErrors / totalCalls) * 10000) / 100 : 0,
      avgLatencyMs: Math.round(avgLatency),
      revenue30dBrl: Math.round(revenue * 100) / 100,
      activeSandboxes: 0,  // filled by caller
      topEndpoints: [],     // filled by caller
    };
  }
}
