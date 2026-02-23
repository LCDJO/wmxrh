import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Public Blockchain Verification API
 *
 * Allows external systems to verify document hash proofs
 * WITHOUT authentication. Read-only, no PII exposed.
 *
 * Endpoints:
 *   GET  ?hash=<sha256>          — Verify by hash
 *   GET  ?document_id=<uuid>     — Verify by document ID
 *   POST { hashes: [...] }       — Batch verify (max 50)
 *
 * Response:
 *   {
 *     verified: boolean,
 *     proof?: {
 *       hash_sha256, blockchain_network, transaction_hash,
 *       block_number, timestamp_blockchain, verification_url, status
 *     }
 *   }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // ─── GET: Single verification ───
    if (req.method === "GET") {
      const url = new URL(req.url);
      const hash = url.searchParams.get("hash");
      const documentId = url.searchParams.get("document_id");

      if (!hash && !documentId) {
        return jsonResponse(
          { error: "Provide ?hash=<sha256> or ?document_id=<uuid>" },
          400,
        );
      }

      let query = supabase
        .from("blockchain_hash_registry")
        .select(
          "hash_sha256, blockchain_network, transaction_hash, block_number, timestamp_blockchain, verification_url, status",
        );

      if (hash) {
        query = query.eq("hash_sha256", hash);
      } else {
        query = query.eq("signed_document_id", documentId!);
      }

      const { data, error } = await query
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Verification query error:", error);
        return jsonResponse({ error: "Internal error" }, 500);
      }

      if (!data) {
        return jsonResponse({
          verified: false,
          message: "No confirmed blockchain proof found for this hash",
        });
      }

      return jsonResponse({
        verified: true,
        proof: {
          hash_sha256: data.hash_sha256,
          blockchain_network: data.blockchain_network,
          transaction_hash: data.transaction_hash,
          block_number: data.block_number,
          timestamp_blockchain: data.timestamp_blockchain,
          verification_url: data.verification_url,
          status: data.status,
        },
      });
    }

    // ─── POST: Batch verification ───
    if (req.method === "POST") {
      const body = await req.json();
      const hashes: string[] = body.hashes;

      if (!Array.isArray(hashes) || hashes.length === 0) {
        return jsonResponse(
          { error: "Provide { hashes: ['hash1', 'hash2', ...] }" },
          400,
        );
      }

      if (hashes.length > 50) {
        return jsonResponse(
          { error: "Maximum 50 hashes per batch request" },
          400,
        );
      }

      const { data, error } = await supabase
        .from("blockchain_hash_registry")
        .select(
          "hash_sha256, blockchain_network, transaction_hash, block_number, timestamp_blockchain, verification_url, status",
        )
        .in("hash_sha256", hashes)
        .eq("status", "confirmed");

      if (error) {
        console.error("Batch verification error:", error);
        return jsonResponse({ error: "Internal error" }, 500);
      }

      const proofMap = new Map(
        (data || []).map((p: any) => [p.hash_sha256, p]),
      );

      const results = hashes.map((h) => ({
        hash: h,
        verified: proofMap.has(h),
        proof: proofMap.get(h) || null,
      }));

      return jsonResponse({
        total: hashes.length,
        verified_count: results.filter((r) => r.verified).length,
        results,
      });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("Public verify error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
