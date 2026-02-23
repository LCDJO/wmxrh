import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Security constants
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;
const MAX_FAILED_BEFORE_BLOCK = 5;
const BLOCK_DURATION_MS = 15 * 60_000; // 15 minutes
const TOKEN_MAX_LENGTH = 64;
const FIELD_MAX_LENGTH = 200;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeString(val: unknown, maxLen = FIELD_MAX_LENGTH): string | null {
  if (typeof val !== "string") return null;
  return val.trim().slice(0, maxLen) || null;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const ip = getClientIp(req);
  const ua = sanitizeString(req.headers.get("user-agent"), 500);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // ─── 1. Rate Limiting by IP ───
    const now = new Date();
    const { data: rlRow } = await supabase
      .from("validation_rate_limits")
      .select("*")
      .eq("ip_address", ip)
      .maybeSingle();

    if (rlRow) {
      // Check if blocked
      if (rlRow.blocked_until && new Date(rlRow.blocked_until) > now) {
        const retryAfter = Math.ceil(
          (new Date(rlRow.blocked_until).getTime() - now.getTime()) / 1000
        );
        return new Response(
          JSON.stringify({
            valid: false,
            status: "rate_limited",
            hash_verified: false,
            retry_after_seconds: retryAfter,
          }),
          { status: 429, headers: { ...jsonHeaders, "Retry-After": String(retryAfter) } }
        );
      }

      const windowAge = now.getTime() - new Date(rlRow.window_start).getTime();

      if (windowAge > RATE_LIMIT_WINDOW_MS) {
        // Reset window
        await supabase
          .from("validation_rate_limits")
          .update({
            attempt_count: 1,
            failed_count: 0,
            window_start: now.toISOString(),
            blocked_until: null,
            updated_at: now.toISOString(),
          })
          .eq("ip_address", ip);
      } else if (rlRow.attempt_count >= MAX_REQUESTS_PER_WINDOW) {
        return new Response(
          JSON.stringify({
            valid: false,
            status: "rate_limited",
            hash_verified: false,
            retry_after_seconds: Math.ceil((RATE_LIMIT_WINDOW_MS - windowAge) / 1000),
          }),
          { status: 429, headers: jsonHeaders }
        );
      } else {
        await supabase
          .from("validation_rate_limits")
          .update({
            attempt_count: rlRow.attempt_count + 1,
            updated_at: now.toISOString(),
          })
          .eq("ip_address", ip);
      }
    } else {
      await supabase.from("validation_rate_limits").insert({
        ip_address: ip,
        attempt_count: 1,
        failed_count: 0,
        window_start: now.toISOString(),
      });
    }

    // ─── 2. Parse & sanitize input ───
    let token: string | null = null;
    let requesterName: string | null = null;
    let requesterEmail: string | null = null;
    let requesterPurpose: string | null = null;
    let privacyAccepted = false;

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = sanitizeString(url.searchParams.get("token"), TOKEN_MAX_LENGTH);
    } else if (req.method === "POST") {
      const body = await req.json();
      token = sanitizeString(body.token, TOKEN_MAX_LENGTH);
      requesterName = sanitizeString(body.requester_name);
      requesterEmail = sanitizeString(body.requester_email, 255);
      requesterPurpose = sanitizeString(body.requester_purpose);
      privacyAccepted = body.privacy_accepted === true;
    }

    // Validate token format (UUID v4 only)
    if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
      return new Response(
        JSON.stringify({ valid: false, status: "invalid_token", hash_verified: false }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // ─── 3. POST: validate mandatory LGPD fields ───
    if (req.method === "POST") {
      const missing: string[] = [];
      if (!requesterName) missing.push("requester_name");
      if (!requesterEmail || !EMAIL_REGEX.test(requesterEmail)) missing.push("requester_email");
      if (!requesterPurpose) missing.push("requester_purpose");
      if (!privacyAccepted) missing.push("privacy_accepted");

      if (missing.length > 0) {
        return new Response(
          JSON.stringify({
            valid: false,
            status: "lgpd_fields_required",
            hash_verified: false,
            missing_fields: missing,
          }),
          { status: 422, headers: jsonHeaders }
        );
      }
    }

    // ─── 4. Lookup token ───
    const { data: tokenRow, error: tokenError } = await supabase
      .from("document_validation_tokens")
      .select("id, tenant_id, document_vault_id, document_hash, status, expires_at")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRow) {
      // Increment failed count — potential brute force
      await incrementFailed(supabase, ip, now);
      return new Response(
        JSON.stringify({ valid: false, status: "invalid_token", hash_verified: false }),
        { status: 404, headers: jsonHeaders }
      );
    }

    // ─── 5. Check token status & expiration ───
    let accessResult = "success";

    if (tokenRow.status === "revoked") {
      accessResult = "revoked";
    } else if (tokenRow.status === "expired") {
      accessResult = "expired";
    } else if (tokenRow.expires_at && new Date(tokenRow.expires_at) < now) {
      accessResult = "expired";
      await supabase
        .from("document_validation_tokens")
        .update({ status: "expired" })
        .eq("id", tokenRow.id);
    }

    // ─── 6. Verify hash (never expose employee data) ───
    let hashVerified = false;
    let documentName: string | null = null;
    let signedAt: string | null = null;
    let documentHash: string | null = null;
    let versao: number | null = null;

    if (accessResult === "success") {
      const { data: vaultRow } = await supabase
        .from("document_vault")
        .select("nome_documento, hash_documento, created_at, versao")
        .eq("id", tokenRow.document_vault_id)
        .single();

      if (vaultRow) {
        hashVerified = vaultRow.hash_documento === tokenRow.document_hash;
        // Safe fields only — no employee PII
        documentName = vaultRow.nome_documento;
        signedAt = vaultRow.created_at;
        documentHash = vaultRow.hash_documento;
        versao = vaultRow.versao;

        if (!hashVerified) accessResult = "hash_mismatch";
      } else {
        const { data: signedRow } = await supabase
          .from("signed_documents")
          .select("hash_sha256, data_assinatura, versao")
          .eq("validation_token", token)
          .eq("ativo", true)
          .single();

        if (signedRow) {
          hashVerified = true;
          documentHash = signedRow.hash_sha256;
          signedAt = signedRow.data_assinatura;
          versao = signedRow.versao;
          documentName = `Documento assinado v${signedRow.versao}`;
        } else {
          accessResult = "invalid_token";
        }
      }
    }

    // ─── 7. Resolve signed_document_id ───
    let signedDocumentId: string | null = null;
    if (accessResult === "success") {
      const { data: sdRow } = await supabase
        .from("signed_documents")
        .select("id")
        .eq("validation_token", token)
        .eq("ativo", true)
        .maybeSingle();
      signedDocumentId = sdRow?.id ?? null;
    }

    // ─── 8. LGPD: Log access (all attempts) ───
    await supabase.from("document_access_logs").insert({
      token_id: tokenRow.id,
      tenant_id: tokenRow.tenant_id,
      signed_document_id: signedDocumentId,
      ip_address: ip,
      user_agent: ua,
      requester_name: requesterName,
      requester_email: requesterEmail,
      requester_document: requesterEmail,
      requester_purpose: requesterPurpose,
      access_result: accessResult,
      metadata: {
        privacy_accepted: privacyAccepted,
        privacy_accepted_at: now.toISOString(),
      },
    });

    // Track failures for lockout
    if (accessResult !== "success") {
      await incrementFailed(supabase, ip, now);
    }

    const isValid = accessResult === "success" && hashVerified;

    // ─── 9. Response: NEVER expose employee PII ───
    return new Response(
      JSON.stringify({
        valid: isValid,
        status: accessResult,
        hash_verified: hashVerified,
        ...(isValid && {
          document_name: documentName,
          signed_at: signedAt,
          document_hash: documentHash,
          versao,
        }),
      }),
      { status: isValid ? 200 : 400, headers: jsonHeaders }
    );
  } catch (err) {
    console.error("[validate-document] Error:", err);
    return new Response(
      JSON.stringify({ valid: false, status: "error", hash_verified: false }),
      { status: 500, headers: jsonHeaders }
    );
  }
});

/** Increment failed attempts; block IP after threshold */
async function incrementFailed(
  supabase: ReturnType<typeof createClient>,
  ip: string,
  now: Date
) {
  const { data: rl } = await supabase
    .from("validation_rate_limits")
    .select("failed_count")
    .eq("ip_address", ip)
    .maybeSingle();

  const newFailed = (rl?.failed_count ?? 0) + 1;
  const blocked =
    newFailed >= MAX_FAILED_BEFORE_BLOCK
      ? new Date(now.getTime() + BLOCK_DURATION_MS).toISOString()
      : null;

  await supabase
    .from("validation_rate_limits")
    .upsert(
      {
        ip_address: ip,
        failed_count: newFailed,
        blocked_until: blocked,
        updated_at: now.toISOString(),
        ...(rl ? {} : { attempt_count: 1, window_start: now.toISOString() }),
      },
      { onConflict: "ip_address" }
    );
}
