import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Blockchain Webhook — Receives async confirmations from blockchain providers.
 *
 * When the real smart contract confirms a transaction, the provider
 * calls this endpoint to update the registry status.
 *
 * POST body: {
 *   proof_id: string,          — ID of the blockchain_hash_registry row
 *   transaction_hash: string,  — on-chain tx hash
 *   block_number: number,
 *   status: "confirmed" | "failed",
 *   timestamp: string,         — ISO timestamp from chain
 *   verification_url?: string,
 *   webhook_secret: string     — shared secret for auth
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      proof_id,
      transaction_hash,
      block_number,
      status,
      timestamp,
      verification_url,
      webhook_secret,
    } = body;

    // Validate webhook secret
    const expectedSecret = Deno.env.get("BLOCKCHAIN_WEBHOOK_SECRET");
    if (expectedSecret && webhook_secret !== expectedSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid webhook secret" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!proof_id || !status) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing proof_id or status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["confirmed", "failed"].includes(status)) {
      return new Response(
        JSON.stringify({ success: false, error: "Status must be 'confirmed' or 'failed'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to update regardless of RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const updateData: Record<string, unknown> = { status };
    if (transaction_hash) updateData.transaction_hash = transaction_hash;
    if (block_number) updateData.block_number = block_number;
    if (timestamp) updateData.timestamp_blockchain = timestamp;
    if (verification_url) updateData.verification_url = verification_url;

    const { data, error } = await supabase
      .from("blockchain_hash_registry")
      .update(updateData)
      .eq("id", proof_id)
      .eq("status", "pending") // Only update pending records
      .select()
      .single();

    if (error) {
      console.error("Webhook update error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ success: false, error: "No pending proof found with that ID" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, record: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Blockchain webhook error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
