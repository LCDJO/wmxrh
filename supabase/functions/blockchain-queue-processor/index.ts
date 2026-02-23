import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Blockchain Queue Processor
 *
 * Processes pending items from blockchain_anchor_queue with:
 *   - Batch processing (up to 10 items per invocation)
 *   - Exponential backoff retry (30s, 2m, 8m, 32m, 2h)
 *   - Dead-letter after max_attempts
 *   - SECURITY: Only hashes are sent — NEVER document content
 *
 * Designed to be called by a cron job or manual trigger.
 * Uses service_role_key for full DB access.
 */

const BATCH_SIZE = 10;
const BASE_RETRY_DELAY_MS = 30_000; // 30 seconds

function calculateNextRetry(attemptCount: number): string {
  // Exponential backoff: 30s, 2m, 8m, 32m, 2h
  const delayMs = BASE_RETRY_DELAY_MS * Math.pow(4, attemptCount);
  const capped = Math.min(delayMs, 2 * 60 * 60 * 1000); // max 2 hours
  return new Date(Date.now() + capped).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // ─── 1. Fetch pending queue items ───
    const now = new Date().toISOString();
    const { data: items, error: fetchError } = await supabase
      .from("blockchain_anchor_queue")
      .select("*")
      .in("status", ["queued", "failed"])
      .lte("next_retry_at", now)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Queue fetch error:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending items" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    // ─── 2. Process each item ───
    for (const item of items) {
      // Mark as processing
      await supabase
        .from("blockchain_anchor_queue")
        .update({ status: "processing" })
        .eq("id", item.id);

      try {
        // ─── SECURITY: Only send hash, never document content ───
        // Call the blockchain-anchor edge function internally
        const anchorResponse = await fetch(
          `${supabaseUrl}/functions/v1/blockchain-anchor`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              tenant_id: item.tenant_id,
              signed_document_id: item.signed_document_id,
              document_hash: item.hash_sha256, // ONLY the hash
              created_by: item.created_by,
            }),
          }
        );

        const anchorData = await anchorResponse.json();

        if (anchorData.success && anchorData.record) {
          // ─── Success: mark completed ───
          await supabase
            .from("blockchain_anchor_queue")
            .update({
              status: "completed",
              proof_id: anchorData.record.id,
              attempt_count: item.attempt_count + 1,
              last_error: null,
            })
            .eq("id", item.id);

          results.push({ id: item.id, status: "completed" });
        } else {
          throw new Error(anchorData.error || "Anchor returned failure");
        }
      } catch (err) {
        const newAttempt = item.attempt_count + 1;
        const errorMsg = String(err);

        if (newAttempt >= item.max_attempts) {
          // ─── Dead letter: max retries exceeded ───
          await supabase
            .from("blockchain_anchor_queue")
            .update({
              status: "dead_letter",
              attempt_count: newAttempt,
              last_error: `Max attempts (${item.max_attempts}) exceeded. Last: ${errorMsg}`,
            })
            .eq("id", item.id);

          results.push({ id: item.id, status: "dead_letter", error: errorMsg });
        } else {
          // ─── Retry with exponential backoff ───
          const nextRetry = calculateNextRetry(newAttempt);
          await supabase
            .from("blockchain_anchor_queue")
            .update({
              status: "failed",
              attempt_count: newAttempt,
              next_retry_at: nextRetry,
              last_error: errorMsg,
            })
            .eq("id", item.id);

          results.push({ id: item.id, status: "retry_scheduled", error: errorMsg });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Queue processor error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
