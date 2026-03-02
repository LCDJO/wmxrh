import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * WorkTime Sign Entry — Server-side SHA-256 + HMAC signing
 *
 * Receives a time entry payload, computes:
 *   1. SHA-256 hash of canonical payload (integrity_hash)
 *   2. HMAC-SHA256 signature using server secret key (server_signature)
 *   3. Chain link to previous entry hash
 *
 * The signing key is a server-only secret (WORKTIME_SIGNING_KEY),
 * never exposed to the client.
 */

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message)
  );
  const sigArray = Array.from(new Uint8Array(signature));
  return sigArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const signingKey = Deno.env.get("WORKTIME_SIGNING_KEY") || supabaseKey.slice(0, 64);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === "sign_entry") {
      const { entry } = body;

      // 1. Build canonical payload for SHA-256
      const canonicalPayload = [
        entry.tenant_id,
        entry.employee_id,
        entry.event_type,
        entry.recorded_at,
        entry.source,
        entry.latitude ?? "",
        entry.longitude ?? "",
        entry.accuracy_meters ?? "",
        entry.device_fingerprint ?? "",
        entry.ip_address ?? "",
        entry.previous_hash ?? "GENESIS",
      ].join("|");

      // 2. Compute SHA-256 integrity hash
      const integrityHash = await sha256(canonicalPayload);

      // 3. Compute HMAC-SHA256 server signature
      const signaturePayload = `${integrityHash}|${entry.tenant_id}|${new Date().toISOString()}`;
      const serverSignature = await hmacSha256(signingKey, signaturePayload);

      // 4. Insert into ledger with service_role (bypasses RLS)
      const { data: inserted, error: insertError } = await supabase
        .from("worktime_ledger")
        .insert({
          tenant_id: entry.tenant_id,
          employee_id: entry.employee_id,
          event_type: entry.event_type,
          recorded_at: entry.recorded_at,
          server_timestamp: new Date().toISOString(),
          source: entry.source || "manual",
          latitude: entry.latitude ?? null,
          longitude: entry.longitude ?? null,
          accuracy_meters: entry.accuracy_meters ?? null,
          device_fingerprint: entry.device_fingerprint ?? null,
          device_model: entry.device_model ?? null,
          device_os: entry.device_os ?? null,
          app_version: entry.app_version ?? null,
          ip_address: entry.ip_address || req.headers.get("x-forwarded-for") || null,
          geofence_id: entry.geofence_id ?? null,
          geofence_matched: entry.geofence_matched ?? false,
          photo_proof_url: entry.photo_proof_url ?? null,
          integrity_hash: integrityHash,
          previous_hash: entry.previous_hash ?? null,
          server_signature: serverSignature,
          signature_algorithm: "HMAC-SHA256",
          is_offline_sync: entry.is_offline_sync ?? false,
          offline_recorded_at: entry.offline_recorded_at ?? null,
          status: "valid",
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: `Insert failed: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          entry: inserted,
          integrity_hash: integrityHash,
          server_signature: serverSignature,
          algorithm: "HMAC-SHA256",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify_entry") {
      const { entry_id } = body;

      const { data: entry, error: fetchError } = await supabase
        .from("worktime_ledger")
        .select("*")
        .eq("id", entry_id)
        .single();

      if (fetchError || !entry) {
        return new Response(
          JSON.stringify({ error: "Entry not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Recompute hash
      const canonicalPayload = [
        entry.tenant_id,
        entry.employee_id,
        entry.event_type,
        entry.recorded_at,
        entry.source,
        entry.latitude ?? "",
        entry.longitude ?? "",
        entry.accuracy_meters ?? "",
        entry.device_fingerprint ?? "",
        entry.ip_address ?? "",
        entry.previous_hash ?? "GENESIS",
      ].join("|");

      const recomputedHash = await sha256(canonicalPayload);
      const hashValid = recomputedHash === entry.integrity_hash;

      return new Response(
        JSON.stringify({
          entry_id,
          hash_valid: hashValid,
          stored_hash: entry.integrity_hash,
          recomputed_hash: recomputedHash,
          has_signature: !!entry.server_signature,
          algorithm: entry.signature_algorithm,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sign_adjustment") {
      const { adjustment } = body;

      const canonicalPayload = [
        adjustment.original_entry_id,
        adjustment.adjustment_type,
        adjustment.reason,
        adjustment.new_recorded_at ?? "",
        new Date().toISOString(),
      ].join("|");

      const integrityHash = await sha256(canonicalPayload);
      const serverSignature = await hmacSha256(signingKey, integrityHash);

      const { data: inserted, error: insertError } = await supabase
        .from("worktime_ledger_adjustments")
        .insert({
          tenant_id: adjustment.tenant_id,
          original_entry_id: adjustment.original_entry_id,
          adjustment_type: adjustment.adjustment_type,
          new_recorded_at: adjustment.new_recorded_at ?? null,
          new_event_type: adjustment.new_event_type ?? null,
          reason: adjustment.reason,
          legal_basis: adjustment.legal_basis ?? null,
          approval_status: "pending",
          integrity_hash: integrityHash,
          server_signature: serverSignature,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: `Insert failed: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ adjustment: inserted, integrity_hash: integrityHash, server_signature: serverSignature }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
