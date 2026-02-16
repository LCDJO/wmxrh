/**
 * Edge Function Middleware Pipeline
 *
 * Execution order (mandatory):
 *   1. RequestIdMiddleware      – generates unique request_id
 *   2. TenantResolverMiddleware – resolves tenant from JWT / header
 *   3. AuthMiddleware           – validates JWT, extracts user + roles + scopes
 *   4. ScopeGuardMiddleware     – validates hierarchical scope access
 *   5. RateLimitMiddleware      – per-user request throttling
 *   6. AuditMiddleware          – logs every request to audit_logs
 *   7. ValidationMiddleware     – validates request payloads, blocks invalid financial data
 *
 * Usage:
 *   import { createHandler, v } from "../_shared/middleware.ts";
 *   Deno.serve(createHandler(async (ctx) => {
 *     const body = await validateBody(ctx, salaryContractSchema);
 *     ...
 *   }, { rateLimit: "financial", route: "salary", action: "create" }));
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ═══════════════════════════════════
// Types
// ═══════════════════════════════════

export interface PermissionScope {
  role: string;
  scope_type: string;
  scope_id: string | null;
}

export interface MiddlewareContext {
  requestId: string;
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  roles: string[];
  permissionScopes: PermissionScope[];
  supabase: SupabaseClient;
  request: Request;
  startedAt: number;
}

export type HandlerFn = (ctx: MiddlewareContext) => Promise<Response>;

export interface HandlerOptions {
  skipAuth?: boolean;
  rateLimit?: RateLimitTier;
  route?: string;
  action?: string;
  skipAudit?: boolean;
}

// ═══════════════════════════════════
// CORS
// ═══════════════════════════════════

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id, x-tenant-id, x-company-id, x-group-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

// ═══════════════════════════════════
// Error Handling
// ═══════════════════════════════════

export class MiddlewareError extends Error {
  status: number;
  code: string;
  details?: Record<string, string[]>;
  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function errorResponse(requestId: string, status: number, code: string, message: string, details?: Record<string, string[]>): Response {
  const body: Record<string, unknown> = {
    error: { code, message, ...(details ? { details } : {}) },
    request_id: requestId,
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId },
  });
}

// ═══════════════════════════════════
// 1) RequestIdMiddleware
// ═══════════════════════════════════

function resolveRequestId(req: Request): string {
  const clientId = req.headers.get("x-request-id");
  if (clientId && clientId.length > 0 && clientId.length <= 64) return clientId;
  return crypto.randomUUID();
}

// ═══════════════════════════════════
// 2) TenantResolverMiddleware (from JWT claims)
// ═══════════════════════════════════

interface TenantInfo { tenantId: string; tenantName: string; }

function resolveTenantFromClaims(claims: Record<string, unknown>, req: Request): TenantInfo {
  // Prefer x-tenant-id header for multi-tenant switching, fall back to JWT claim
  const headerTenantId = req.headers.get("x-tenant-id");
  const claimTenantId = claims.tenant_id as string | undefined;
  const tenantId = headerTenantId || claimTenantId;
  if (!tenantId) throw new MiddlewareError(403, "NO_TENANT", "No tenant found in JWT claims or headers");
  return { tenantId, tenantName: "" };
}

// ═══════════════════════════════════
// 3) AuthMiddleware
// ═══════════════════════════════════

interface AuthResult {
  userId: string;
  email: string;
  supabase: SupabaseClient;
  claims: Record<string, unknown>;
}

async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new MiddlewareError(401, "MISSING_TOKEN", "Authorization header is required");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) throw new MiddlewareError(401, "INVALID_TOKEN", "JWT validation failed");
  const claims = claimsData.claims as Record<string, unknown>;
  const userId = claims.sub as string;
  const email = (claims.email as string) || "";
  if (!userId) throw new MiddlewareError(401, "INVALID_TOKEN", "Token missing subject claim");
  const exp = claims.exp as number;
  if (exp && exp < Math.floor(Date.now() / 1000)) throw new MiddlewareError(401, "TOKEN_EXPIRED", "JWT has expired");
  return { userId, email, supabase, claims };
}

/**
 * Extract roles and scopes directly from JWT claims (injected by custom_access_token_hook).
 * Falls back to DB query if claims are missing (e.g. tokens issued before hook was enabled).
 */
async function resolvePermissionScopes(
  supabase: SupabaseClient, userId: string, tenantId: string, claims: Record<string, unknown>
): Promise<{ roles: string[]; scopes: PermissionScope[] }> {
  // Try JWT claims first
  const claimRoles = claims.roles as string[] | undefined;
  const claimScopes = claims.scopes as Array<{ type: string; id: string }> | undefined;

  if (Array.isArray(claimRoles) && claimRoles.length > 0 && Array.isArray(claimScopes)) {
    const scopes: PermissionScope[] = claimScopes.map(s => ({
      role: "", // not needed per-scope since roles are flat
      scope_type: s.type,
      scope_id: s.id || null,
    }));
    return { roles: claimRoles, scopes };
  }

  // Fallback: query DB (for tokens issued before the hook)
  const { data: userRoles, error } = await supabase
    .from("user_roles").select("role, scope_type, scope_id")
    .eq("user_id", userId).eq("tenant_id", tenantId);
  if (error) { console.error("[AuthMiddleware] Failed to fetch user_roles:", error.message); return { roles: [], scopes: [] }; }
  const roles = [...new Set((userRoles || []).map((r: any) => r.role))];
  const scopes: PermissionScope[] = (userRoles || []).map((r: any) => ({
    role: r.role, scope_type: r.scope_type, scope_id: r.scope_id,
  }));
  return { roles, scopes };
}

// ═══════════════════════════════════
// 4) ScopeGuardMiddleware
// ═══════════════════════════════════

function validateScopeAccess(ctx: MiddlewareContext): void {
  const requestedCompanyId = ctx.request.headers.get("x-company-id");
  const requestedGroupId = ctx.request.headers.get("x-group-id");
  if (!requestedCompanyId && !requestedGroupId) return;
  const hasTenantScope = ctx.permissionScopes.some(s => s.scope_type === "tenant");
  if (hasTenantScope) return;
  if (requestedGroupId) {
    const hasGroupAccess = ctx.permissionScopes.some(s => s.scope_type === "company_group" && s.scope_id === requestedGroupId);
    if (!hasGroupAccess) {
      logSecurityEvent(ctx, "ScopeViolationDetected", `Cross-group access attempt: group ${requestedGroupId}`, { requested_group_id: requestedGroupId });
      throw new MiddlewareError(403, "SCOPE_CROSS_GROUP", `Access denied to group ${requestedGroupId}`);
    }
  }
  if (requestedCompanyId) {
    const hasCompanyAccess = ctx.permissionScopes.some(s =>
      (s.scope_type === "company" && s.scope_id === requestedCompanyId) ||
      (s.scope_type === "company_group")
    );
    if (!hasCompanyAccess) {
      logSecurityEvent(ctx, "ScopeViolationDetected", `Cross-company access attempt: company ${requestedCompanyId}`, { requested_company_id: requestedCompanyId });
      throw new MiddlewareError(403, "SCOPE_CROSS_COMPANY", `Access denied to company ${requestedCompanyId}`);
    }
  }
}

// ═══════════════════════════════════
// 5) RateLimitMiddleware
// ═══════════════════════════════════

export type RateLimitTier = "standard" | "sensitive" | "financial";

const RATE_LIMIT_CONFIGS: Record<RateLimitTier, { maxRequests: number; windowMs: number }> = {
  standard:  { maxRequests: 100, windowMs: 60_000 },
  sensitive: { maxRequests: 30,  windowMs: 60_000 },
  financial: { maxRequests: 10,  windowMs: 60_000 },
};

const rateLimitStore = new Map<string, { timestamps: number[] }>();

function checkRateLimit(userId: string, tier: RateLimitTier, ctx?: MiddlewareContext): void {
  const config = RATE_LIMIT_CONFIGS[tier];
  const key = `${userId}:${tier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  let entry = rateLimitStore.get(key);
  if (!entry) { entry = { timestamps: [] }; rateLimitStore.set(key, entry); }
  entry.timestamps = entry.timestamps.filter(t => t > windowStart);
  if (entry.timestamps.length >= config.maxRequests) {
    const retryAfterMs = entry.timestamps[0] + config.windowMs - now;
    if (ctx) {
      logSecurityEvent(ctx, "RateLimitTriggered", `Rate limit exceeded (${tier}: ${config.maxRequests}/${config.windowMs / 1000}s)`, { tier, retryAfterMs });
    }
    throw new MiddlewareError(429, "RATE_LIMITED",
      `Rate limit exceeded (${tier}: ${config.maxRequests}/${config.windowMs / 1000}s). Retry after ${Math.ceil(retryAfterMs / 1000)}s`);
  }
  entry.timestamps.push(now);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter(t => t > now - 120_000);
    if (entry.timestamps.length === 0) rateLimitStore.delete(key);
  }
}, 300_000);

// ═══════════════════════════════════
// Security Event Logger (backend)
// ═══════════════════════════════════

type SecurityEventType = "UnauthorizedAccessAttempt" | "ScopeViolationDetected" | "RateLimitTriggered";

function logSecurityEvent(
  ctx: MiddlewareContext,
  eventType: SecurityEventType,
  description: string,
  metadata?: Record<string, unknown>
): void {
  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) return;
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const result = eventType === "RateLimitTriggered" ? "blocked" : "blocked";
    supabaseAdmin.from("security_logs").insert({
      request_id: ctx.requestId,
      user_id: ctx.userId || null,
      tenant_id: ctx.tenantId || null,
      action: eventType,
      resource: `${ctx.request.method} ${new URL(ctx.request.url).pathname}`,
      result,
      ip_address: ctx.request.headers.get("x-forwarded-for") || ctx.request.headers.get("cf-connecting-ip") || null,
      user_agent: ctx.request.headers.get("user-agent") || null,
    }).then(({ error }) => {
      if (error) console.error(`[SecurityLog] Failed to log ${eventType}:`, error.message);
    });
  } catch (err) {
    console.error(`[SecurityLog] Error logging ${eventType}:`, err);
  }
}

// ═══════════════════════════════════
// 6) AuditMiddleware
// ═══════════════════════════════════

async function auditLog(ctx: MiddlewareContext, options: HandlerOptions, responseStatus: number): Promise<void> {
  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) { console.warn("[AuditMiddleware] Missing service role key, skipping audit"); return; }
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const url = new URL(ctx.request.url);
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: ctx.tenantId, user_id: ctx.userId,
      company_id: ctx.request.headers.get("x-company-id") || null,
      company_group_id: ctx.request.headers.get("x-group-id") || null,
      action: options.action || ctx.request.method,
      entity_type: options.route || url.pathname, entity_id: null,
      metadata: {
        request_id: ctx.requestId, method: ctx.request.method, path: url.pathname,
        response_status: responseStatus, elapsed_ms: Date.now() - ctx.startedAt,
        roles: ctx.roles,
        ip: ctx.request.headers.get("x-forwarded-for") || ctx.request.headers.get("cf-connecting-ip") || null,
        user_agent: ctx.request.headers.get("user-agent") || null,
      },
    });
  } catch (err) {
    console.error("[AuditMiddleware] Failed to write audit log:", err);
  }
}

// ═══════════════════════════════════
// 7) ValidationMiddleware
// ═══════════════════════════════════

/**
 * Lightweight schema validation (no external deps).
 * Provides type-safe validation with detailed field-level errors.
 */

type FieldRule = {
  type: "string" | "number" | "boolean" | "uuid" | "date" | "email" | "enum" | "array" | "object";
  required?: boolean;
  min?: number;       // string: minLength, number: min value
  max?: number;       // string: maxLength, number: max value
  precision?: number; // max decimal places for numbers
  positive?: boolean; // number must be > 0
  enumValues?: string[];
  pattern?: RegExp;
  maxBytes?: number;  // max payload size for strings
  sanitize?: boolean; // strip HTML tags
  items?: ValidationSchema; // for arrays
  custom?: (value: unknown, field: string) => string | null; // custom validator
};

export type ValidationSchema = Record<string, FieldRule>;

interface ValidationResult<T = Record<string, unknown>> {
  valid: boolean;
  data: T;
  errors: Record<string, string[]>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HTML_TAG_RE = /<[^>]*>/g;

function sanitizeString(val: string): string {
  return val.replace(HTML_TAG_RE, "").trim();
}

function validateField(field: string, value: unknown, rule: FieldRule, errors: Record<string, string[]>): unknown {
  const addError = (msg: string) => {
    if (!errors[field]) errors[field] = [];
    errors[field].push(msg);
  };

  // Required check
  if (value === undefined || value === null || value === "") {
    if (rule.required) addError(`${field} is required`);
    return value;
  }

  let processed = value;

  switch (rule.type) {
    case "string": {
      if (typeof value !== "string") { addError(`${field} must be a string`); return value; }
      processed = rule.sanitize ? sanitizeString(value) : value.trim();
      const str = processed as string;
      if (rule.min !== undefined && str.length < rule.min) addError(`${field} must be at least ${rule.min} characters`);
      if (rule.max !== undefined && str.length > rule.max) addError(`${field} must be at most ${rule.max} characters`);
      if (rule.maxBytes !== undefined && new TextEncoder().encode(str).length > rule.maxBytes) addError(`${field} exceeds max byte size`);
      if (rule.pattern && !rule.pattern.test(str)) addError(`${field} has invalid format`);
      break;
    }
    case "number": {
      const num = typeof value === "string" ? Number(value) : value;
      if (typeof num !== "number" || isNaN(num)) { addError(`${field} must be a valid number`); return value; }
      if (!isFinite(num)) { addError(`${field} must be a finite number`); return value; }
      if (rule.positive && num <= 0) addError(`${field} must be positive`);
      if (rule.min !== undefined && num < rule.min) addError(`${field} must be >= ${rule.min}`);
      if (rule.max !== undefined && num > rule.max) addError(`${field} must be <= ${rule.max}`);
      if (rule.precision !== undefined) {
        const parts = String(num).split(".");
        if (parts[1] && parts[1].length > rule.precision) addError(`${field} must have at most ${rule.precision} decimal places`);
      }
      processed = num;
      break;
    }
    case "boolean": {
      if (typeof value !== "boolean") { addError(`${field} must be a boolean`); return value; }
      break;
    }
    case "uuid": {
      if (typeof value !== "string" || !UUID_RE.test(value)) addError(`${field} must be a valid UUID`);
      break;
    }
    case "date": {
      if (typeof value !== "string" || !DATE_RE.test(value)) { addError(`${field} must be a valid date (YYYY-MM-DD)`); return value; }
      const d = new Date(value);
      if (isNaN(d.getTime())) addError(`${field} is not a valid date`);
      break;
    }
    case "email": {
      if (typeof value !== "string" || !EMAIL_RE.test(value)) addError(`${field} must be a valid email`);
      if (typeof value === "string" && value.length > 255) addError(`${field} email too long`);
      break;
    }
    case "enum": {
      if (!rule.enumValues?.includes(String(value))) addError(`${field} must be one of: ${rule.enumValues?.join(", ")}`);
      break;
    }
    case "array": {
      if (!Array.isArray(value)) { addError(`${field} must be an array`); return value; }
      if (rule.min !== undefined && value.length < rule.min) addError(`${field} must have at least ${rule.min} items`);
      if (rule.max !== undefined && value.length > rule.max) addError(`${field} must have at most ${rule.max} items`);
      break;
    }
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) addError(`${field} must be an object`);
      break;
    }
  }

  // Custom validator
  if (rule.custom) {
    const customErr = rule.custom(processed, field);
    if (customErr) addError(customErr);
  }

  return processed;
}

/**
 * Fields that MUST NEVER come from the frontend.
 * These are server-derived from the authenticated context.
 */
const FORBIDDEN_FIELDS = new Set([
  "tenant_id",    // ALWAYS derived from JWT token
  "user_id",      // ALWAYS derived from JWT token
  "created_by",   // ALWAYS derived from JWT token
  "performed_by", // ALWAYS derived from JWT token
]);

function validatePayload<T = Record<string, unknown>>(
  payload: Record<string, unknown>,
  schema: ValidationSchema,
  ctx?: MiddlewareContext
): ValidationResult<T> {
  const errors: Record<string, string[]> = {};
  const data: Record<string, unknown> = {};

  // ── CRITICAL: Block forbidden fields from frontend ──
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      if (!errors[key]) errors[key] = [];
      errors[key].push(`Field '${key}' cannot be set by the client. It is derived from your authentication token.`);
    }
  }

  for (const [field, rule] of Object.entries(schema)) {
    // Skip forbidden fields in schema validation (they'll be injected server-side)
    if (FORBIDDEN_FIELDS.has(field)) continue;
    data[field] = validateField(field, payload[field], rule, errors);
  }

  // Reject unknown fields (allowlist approach), excluding forbidden fields already flagged
  for (const key of Object.keys(payload)) {
    if (!(key in schema) && !FORBIDDEN_FIELDS.has(key)) {
      if (!errors[key]) errors[key] = [];
      errors[key].push(`Unknown field: ${key}`);
    }
  }

  // ── CRITICAL: Validate company_id against user's scopes ──
  if (ctx && payload.company_id && typeof payload.company_id === "string") {
    const companyId = payload.company_id;
    const hasTenantScope = ctx.permissionScopes.some(s => s.scope_type === "tenant");
    if (!hasTenantScope) {
      const hasCompanyAccess = ctx.permissionScopes.some(s =>
        (s.scope_type === "company" && s.scope_id === companyId) ||
        (s.scope_type === "company_group") // group admins can access companies in their group (RLS double-checks)
      );
      if (!hasCompanyAccess) {
        if (!errors["company_id"]) errors["company_id"] = [];
        errors["company_id"].push("You do not have access to this company");
      }
    }
  }

  // ── CRITICAL: Validate company_group_id against user's scopes ──
  if (ctx && payload.company_group_id && typeof payload.company_group_id === "string") {
    const groupId = payload.company_group_id;
    const hasTenantScope = ctx.permissionScopes.some(s => s.scope_type === "tenant");
    if (!hasTenantScope) {
      const hasGroupAccess = ctx.permissionScopes.some(s =>
        s.scope_type === "company_group" && s.scope_id === groupId
      );
      if (!hasGroupAccess) {
        if (!errors["company_group_id"]) errors["company_group_id"] = [];
        errors["company_group_id"].push("You do not have access to this company group");
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    data: data as T,
    errors,
  };
}

// ─── Max payload size guard ───

const MAX_PAYLOAD_BYTES = 1_048_576; // 1MB

async function parseAndLimitBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new MiddlewareError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json");
  }

  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_PAYLOAD_BYTES) {
    throw new MiddlewareError(413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${MAX_PAYLOAD_BYTES} bytes`);
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new MiddlewareError(400, "INVALID_PAYLOAD", "Request body must be a JSON object");
    }
    return parsed;
  } catch (err) {
    if (err instanceof MiddlewareError) throw err;
    throw new MiddlewareError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
}

/**
 * Parse, validate, and secure the request body.
 *
 * SECURITY RULES ENFORCED:
 *   1. tenant_id NEVER accepted from frontend → always injected from ctx.tenantId
 *   2. user_id / created_by NEVER accepted → injected from ctx.userId
 *   3. company_id validated against user's permission scopes → blocks cross-company injection
 *   4. company_group_id validated against user's permission scopes → blocks cross-group injection
 *
 * Returns sanitized data WITH server-injected fields ready for DB insert.
 */
export async function validateBody<T = Record<string, unknown>>(
  ctx: MiddlewareContext,
  schema: ValidationSchema
): Promise<T> {
  const payload = await parseAndLimitBody(ctx.request);
  const result = validatePayload<T>(payload, schema, ctx);

  if (!result.valid) {
    throw new MiddlewareError(
      422,
      "VALIDATION_FAILED",
      `Validation failed for ${Object.keys(result.errors).length} field(s)`,
      result.errors
    );
  }

  // ── Server-side injection: NEVER trust frontend for these ──
  const secured = result.data as Record<string, unknown>;
  secured.tenant_id = ctx.tenantId;
  secured.created_by = ctx.userId;

  return secured as T;
}

/**
 * Convenience: inject server-derived fields into any data object.
 * Use when you don't need full schema validation but still need security injection.
 */
export function injectServerFields<T extends Record<string, unknown>>(ctx: MiddlewareContext, data: T): T & { tenant_id: string; created_by: string } {
  // Strip any client-supplied forbidden fields
  for (const field of FORBIDDEN_FIELDS) {
    if (field in data) {
      console.warn(`[Security] Stripped forbidden field '${field}' from payload (req=${ctx.requestId})`);
      delete data[field];
    }
  }
  return { ...data, tenant_id: ctx.tenantId, created_by: ctx.userId };
}

// ═══════════════════════════════════
// Pre-built Financial Schemas
// ═══════════════════════════════════

/**
 * Reusable field rules for financial data.
 *
 * NOTE: tenant_id, user_id, created_by are NEVER in schemas.
 * They are injected server-side by validateBody() from the auth context.
 */
export const v = {
  // ── Identifiers (client-provided, validated against scopes) ──
  uuid: (required = true): FieldRule => ({ type: "uuid", required }),
  // NO tenantId builder — tenant_id is FORBIDDEN from frontend
  employeeId: (): FieldRule => ({ type: "uuid", required: true }),
  companyId: (): FieldRule => ({ type: "uuid", required: false }),  // validated against scopes
  groupId: (): FieldRule => ({ type: "uuid", required: false }),    // validated against scopes

  // ── Financial ──
  salary: (opts?: { min?: number; max?: number }): FieldRule => ({
    type: "number", required: true, positive: true, precision: 2,
    min: opts?.min ?? 0.01,
    max: opts?.max ?? 999_999_999.99,
    custom: (val) => {
      if (typeof val === "number" && val > 999_999_999.99) return "Salary exceeds maximum allowed value";
      return null;
    },
  }),
  percentage: (): FieldRule => ({
    type: "number", required: false, min: -100, max: 1000, precision: 2,
  }),
  amount: (required = true): FieldRule => ({
    type: "number", required, positive: true, precision: 2, min: 0.01, max: 999_999_999.99,
  }),

  // ── Strings ──
  name: (max = 200): FieldRule => ({ type: "string", required: true, min: 1, max, sanitize: true }),
  description: (max = 1000): FieldRule => ({ type: "string", required: false, max, sanitize: true }),
  reason: (max = 500): FieldRule => ({ type: "string", required: false, max, sanitize: true }),
  email: (): FieldRule => ({ type: "email", required: false }),

  // ── Dates ──
  date: (required = true): FieldRule => ({ type: "date", required }),
  dateOptional: (): FieldRule => ({ type: "date", required: false }),

  // ── Enums ──
  adjustmentType: (): FieldRule => ({
    type: "enum", required: true,
    enumValues: ["annual", "promotion", "adjustment", "merit", "correction"],
  }),
  additionalType: (): FieldRule => ({
    type: "enum", required: true,
    enumValues: ["bonus", "commission", "allowance", "hazard_pay", "overtime", "other"],
  }),
  employeeStatus: (): FieldRule => ({
    type: "enum", required: true,
    enumValues: ["active", "inactive", "on_leave"],
  }),

  // ── Boolean ──
  boolean: (required = false): FieldRule => ({ type: "boolean", required }),
} as const;

/**
 * Salary contract creation schema.
 * tenant_id + created_by are auto-injected by validateBody().
 * company_id is validated against user's permission scopes.
 */
export const salaryContractSchema: ValidationSchema = {
  employee_id:  v.employeeId(),
  base_salary:  v.salary(),
  start_date:   v.date(),
  end_date:     v.dateOptional(),
  company_id:   v.companyId(),
  company_group_id: v.groupId(),
};

/** Salary adjustment schema */
export const salaryAdjustmentSchema: ValidationSchema = {
  employee_id:      v.employeeId(),
  contract_id:      v.uuid(),
  adjustment_type:  v.adjustmentType(),
  previous_salary:  v.salary(),
  new_salary:       v.salary(),
  percentage:       v.percentage(),
  reason:           v.reason(),
  company_id:       v.companyId(),
  company_group_id: v.groupId(),
};

/** Salary additional schema */
export const salaryAdditionalSchema: ValidationSchema = {
  employee_id:      v.employeeId(),
  additional_type:  v.additionalType(),
  amount:           v.amount(),
  description:      v.description(),
  start_date:       v.date(),
  end_date:         v.dateOptional(),
  is_recurring:     v.boolean(true),
  company_id:       v.companyId(),
  company_group_id: v.groupId(),
};

/** Employee creation schema */
export const employeeSchema: ValidationSchema = {
  name:           v.name(200),
  email:          v.email(),
  cpf:            { type: "string", required: false, pattern: /^\d{11}$/, max: 11 },
  phone:          { type: "string", required: false, max: 20, sanitize: true },
  company_id:     v.uuid(),
  department_id:  v.uuid(false),
  position_id:    v.uuid(false),
  manager_id:     v.uuid(false),
  hire_date:      v.dateOptional(),
  base_salary:    { type: "number", required: false, positive: true, precision: 2, max: 999_999_999.99 },
  status:         v.employeeStatus(),
  company_group_id: v.groupId(),
};

// ═══════════════════════════════════
// Pipeline Orchestrator
// ═══════════════════════════════════

export function createHandler(handler: HandlerFn, options: HandlerOptions = {}): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const requestId = resolveRequestId(req);
    const startedAt = Date.now();

    try {
      if (options.skipAuth) {
        const ctx: MiddlewareContext = {
          requestId, userId: "", email: "", tenantId: "", tenantName: "",
          roles: [], permissionScopes: [],
          supabase: createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!),
          request: req, startedAt,
        };
        const response = await handler(ctx);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      // 3) Auth
      const { userId, email, supabase, claims } = await authenticateRequest(req);
      // 2) Tenant (from JWT claims)
      const { tenantId, tenantName } = resolveTenantFromClaims(claims, req);
      // 3 cont.) Scopes (from JWT claims, fallback to DB)
      const { roles, scopes } = await resolvePermissionScopes(supabase, userId, tenantId, claims);

      const ctx: MiddlewareContext = {
        requestId, userId, email, tenantId, tenantName,
        roles, permissionScopes: scopes, supabase, request: req, startedAt,
      };

      // 4) ScopeGuard
      validateScopeAccess(ctx);
      // 5) RateLimit
      checkRateLimit(userId, options.rateLimit || "standard", ctx);

      console.log(`[Middleware] req=${requestId} user=${userId} tenant=${tenantId} roles=[${roles.join(",")}]`);

      // 7) Validation happens inside the handler via validateBody()

      const response = await handler(ctx);
      response.headers.set("x-request-id", requestId);
      response.headers.set("x-tenant-id", tenantId);

      const elapsed = Date.now() - startedAt;
      console.log(`[Middleware] req=${requestId} completed in ${elapsed}ms status=${response.status}`);

      // 6) Audit
      if (!options.skipAudit) auditLog(ctx, options, response.status).catch(() => {});

      return response;
    } catch (err) {
      if (err instanceof MiddlewareError) {
        console.warn(`[Middleware] req=${requestId} error=${err.code}: ${err.message}`);
        return errorResponse(requestId, err.status, err.code, err.message, err.details);
      }
      console.error(`[Middleware] req=${requestId} unhandled:`, err);
      return errorResponse(requestId, 500, "INTERNAL_ERROR", "An unexpected error occurred");
    }
  };
}

// ═══════════════════════════════════
// Guards (exported)
// ═══════════════════════════════════

export function requireRoles(ctx: MiddlewareContext, ...requiredRoles: string[]): void {
  if (!ctx.roles.some(r => requiredRoles.includes(r))) {
    logSecurityEvent(ctx, "UnauthorizedAccessAttempt", `Missing required roles: ${requiredRoles.join(", ")}`, { required_roles: requiredRoles, user_roles: ctx.roles });
    throw new MiddlewareError(403, "INSUFFICIENT_PERMISSIONS", `Requires one of: ${requiredRoles.join(", ")}`);
  }
}

export function requireScopedAccess(
  ctx: MiddlewareContext, entityType: "company_group" | "company", entityId: string, requiredRoles: string[]
): void {
  const hasAccess = ctx.permissionScopes.some(scope => {
    if (!requiredRoles.includes(scope.role)) return false;
    if (scope.scope_type === "tenant") return true;
    if (scope.scope_type === entityType && scope.scope_id === entityId) return true;
    if (entityType === "company" && scope.scope_type === "company_group") return true;
    return false;
  });
  if (!hasAccess) {
    logSecurityEvent(ctx, "ScopeViolationDetected", `No ${entityType} access for entity ${entityId}`, { entity_type: entityType, entity_id: entityId, required_roles: requiredRoles });
    throw new MiddlewareError(403, "SCOPE_ACCESS_DENIED", `No ${entityType} access for entity ${entityId}`);
  }
}

export function jsonResponse(ctx: MiddlewareContext, data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ data, request_id: ctx.requestId, timestamp: new Date().toISOString() }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": ctx.requestId } },
  );
}
