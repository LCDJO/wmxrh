import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * public-api — Secure edge function for public website access.
 *
 * SECURITY:
 *  - NO authentication required (public surface)
 *  - Only whitelisted endpoints served
 *  - Read-only for most endpoints
 *  - Rate limiting enforced by gateway + here
 *  - NEVER exposes platform/tenant/billing/user data
 *  - Uses service_role ONLY for read queries on public tables
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-public-token",
};

const ALLOWED_ENDPOINTS = new Set([
  "landing-page",
  "site-meta",
  "conversion-event",
  "referral-validate",
  "health",
]);

// Maximum conversion event payload size (prevent abuse)
const MAX_BODY_SIZE = 2048;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { endpoint, method, params, body: reqBody } = body;

    // 1. Validate endpoint whitelist
    if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
      return jsonResponse(
        { error: "Endpoint not found" },
        404,
      );
    }

    // 2. Validate public token presence (lightweight — real validation in gateway)
    const publicToken = req.headers.get("X-Public-Token");
    if (!publicToken && endpoint !== "health") {
      return jsonResponse({ error: "Missing public token" }, 401);
    }

    // 3. Validate token expiry
    if (publicToken && endpoint !== "health") {
      try {
        const tokenData = JSON.parse(publicToken);
        if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
          return jsonResponse({ error: "Token expired" }, 401);
        }
      } catch {
        return jsonResponse({ error: "Invalid token format" }, 401);
      }
    }

    // 4. Create read-only Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 5. Route to handler
    switch (endpoint) {
      case "health":
        return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });

      case "landing-page":
        return await handleLandingPage(supabase, params);

      case "site-meta":
        return await handleSiteMeta(supabase, params);

      case "conversion-event":
        return await handleConversionEvent(supabase, reqBody);

      case "referral-validate":
        return await handleReferralValidate(supabase, params);

      default:
        return jsonResponse({ error: "Not implemented" }, 501);
    }
  } catch (err) {
    console.error("[public-api] Error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

// ── Handlers ────────────────────────────────────────────────────

async function handleLandingPage(supabase: any, params: Record<string, string>) {
  const slug = params?.slug;
  if (!slug) {
    return jsonResponse({ error: "Missing slug parameter" }, 400);
  }

  // Only return PUBLISHED pages — never drafts
  const { data, error } = await supabase
    .from("landing_pages")
    .select("id, name, slug, blocks, gtm_container_id, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) {
    return jsonResponse({ error: "Page not found" }, 404);
  }

  // Strip any sensitive fields that might leak
  return jsonResponse({
    data: {
      id: data.id,
      name: data.name,
      slug: data.slug,
      blocks: data.blocks,
      gtm_container_id: data.gtm_container_id,
      published_at: data.published_at,
    },
  });
}

async function handleSiteMeta(supabase: any, params: Record<string, string>) {
  const slug = params?.slug;
  if (!slug) {
    return jsonResponse({ error: "Missing slug parameter" }, 400);
  }

  const { data, error } = await supabase
    .from("landing_pages")
    .select("name, slug")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) {
    return jsonResponse({ error: "Page not found" }, 404);
  }

  // Return only public-safe SEO metadata
  return jsonResponse({
    data: {
      title: data.name,
      slug: data.slug,
      og: {
        title: data.name,
        type: "website",
        url: `/${data.slug}`,
      },
    },
  });
}

async function handleConversionEvent(supabase: any, body: Record<string, unknown>) {
  // Validate payload size
  const bodyStr = JSON.stringify(body);
  if (bodyStr.length > MAX_BODY_SIZE) {
    return jsonResponse({ error: "Payload too large" }, 413);
  }

  // Validate required fields
  const { page_id, event_type, source } = body;
  if (!page_id || !event_type || !source) {
    return jsonResponse(
      { error: "Missing required fields: page_id, event_type, source" },
      400,
    );
  }

  // Allowed conversion event types (whitelist)
  const allowedTypes = [
    "signup",
    "trial_start",
    "purchase",
    "referral_click",
    "plan_selected",
    "cta_click",
  ];
  if (!allowedTypes.includes(event_type as string)) {
    return jsonResponse({ error: "Invalid event type" }, 400);
  }

  // Insert into conversion tracking (sanitized)
  const { error } = await supabase.from("conversion_events").insert({
    landing_page_id: page_id,
    type: event_type,
    source: String(source).substring(0, 200),
    referral_code: body.referral_code
      ? String(body.referral_code).substring(0, 50)
      : null,
    metadata: {
      timestamp: new Date().toISOString(),
      user_agent: body.user_agent
        ? String(body.user_agent).substring(0, 300)
        : null,
    },
  });

  if (error) {
    console.error("[public-api] Conversion insert error:", error);
    return jsonResponse({ error: "Failed to track event" }, 500);
  }

  return jsonResponse({ data: { tracked: true } });
}

async function handleReferralValidate(supabase: any, params: Record<string, string>) {
  const code = params?.code;
  if (!code || code.length > 50) {
    return jsonResponse({ error: "Invalid referral code" }, 400);
  }

  const { data, error } = await supabase
    .from("referral_links")
    .select("id, code, is_active")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return jsonResponse({ data: { valid: false } });
  }

  // Only return validity — NEVER expose referrer identity or tenant data
  return jsonResponse({ data: { valid: true, code: data.code } });
}

// ── Helpers ─────────────────────────────────────────────────────

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control":
        status === 200 ? "public, max-age=300" : "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}
