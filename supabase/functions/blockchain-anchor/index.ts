import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Simulated blockchain anchor for document hashes.
 *
 * Generates a deterministic pseudo-tx-hash from the document hash
 * and current timestamp, simulating what a real Ethereum/Polygon
 * anchor would return. When a real provider is connected, replace
 * the simulation block with actual chain interaction.
 *
 * POST body: { tenant_id, signed_document_id, document_hash, created_by? }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Parse body
    const body = await req.json();
    const { tenant_id, signed_document_id, document_hash, created_by } = body;

    if (!tenant_id || !signed_document_id || !document_hash) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: tenant_id, signed_document_id, document_hash" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: not a tenant member" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from("blockchain_hash_registry")
      .select("id, status, transaction_hash")
      .eq("hash_sha256", document_hash)
      .eq("tenant_id", tenant_id)
      .eq("status", "confirmed")
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          record: existing,
          message: "Hash already anchored",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════
    // SIMULATED BLOCKCHAIN ANCHOR
    // Replace this section with real chain interaction when ready
    // ═══════════════════════════════════════════════════════
    const now = new Date();
    const timestampHex = now.getTime().toString(16);

    // Generate deterministic pseudo-tx-hash
    const encoder = new TextEncoder();
    const hashData = encoder.encode(document_hash + timestampHex);
    const hashBuffer = await crypto.subtle.digest("SHA-256", hashData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const txHash = "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const simulatedBlockNumber = Math.floor(now.getTime() / 12000); // ~12s block time
    const chain = "simulated-polygon";
    const verificationUrl = `https://polygonscan.com/tx/${txHash}`;
    // ═══════════════════════════════════════════════════════

    // Insert record
    const { data: record, error: insertError } = await supabase
      .from("blockchain_hash_registry")
      .insert({
        tenant_id,
        signed_document_id,
        hash_sha256: document_hash,
        blockchain_network: chain,
        transaction_hash: txHash,
        block_number: simulatedBlockNumber,
        timestamp_blockchain: now.toISOString(),
        status: "confirmed",
        verification_url: verificationUrl,
        metadata: {
          simulation: true,
          algorithm: "SHA-256",
          anchored_by: created_by || userId,
        },
        created_by: created_by || userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Audit log — blockchain proof confirmed
    await supabase.from("audit_logs").insert({
      tenant_id,
      user_id: created_by || userId,
      entity_type: "blockchain_proof",
      entity_id: record.id,
      action: "blockchain.confirmed",
      metadata: {
        hash_sha256: document_hash,
        transaction_hash: txHash,
        block_number: simulatedBlockNumber,
        blockchain_network: chain,
        signed_document_id,
      },
    });

    return new Response(
      JSON.stringify({ success: true, record }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Blockchain anchor error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
