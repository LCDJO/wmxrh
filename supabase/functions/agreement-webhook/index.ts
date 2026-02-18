/**
 * agreement-webhook — Edge Function
 *
 * Receives signature confirmation webhooks from external providers:
 *   - Clicksign
 *   - Autentique
 *   - ZapSign
 *   - OpenSign
 *   - DocuSign (futuro)
 *
 * Fluxo:
 *   1. Identifica o provider pelo header ou body
 *   2. Normaliza o payload em WebhookPayload
 *   3. Atualiza status do agreement para SIGNED
 *   4. Baixa o PDF assinado e salva no DocumentVault (Storage)
 *   5. Registra auditoria em audit_logs
 *   6. Emite evento AgreementSigned
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-provider, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Normalized payload from any provider ──

interface WebhookPayload {
  provider: string;
  external_document_id: string;
  status: "signed" | "rejected" | "expired";
  signed_document_url?: string;
  signed_document_hash?: string;
  signer_ip?: string;
  signer_user_agent?: string;
  rejection_reason?: string;
  raw: Record<string, unknown>;
}

// ── Provider-specific normalizers ──

function normalizeClicksign(body: Record<string, unknown>): WebhookPayload {
  const event = body.event as Record<string, unknown> | undefined;
  const doc = (event?.document || body.document) as Record<string, unknown> | undefined;
  const status = mapProviderStatus(String(body.event_type || event?.type || ""));

  return {
    provider: "clicksign",
    external_document_id: String(doc?.key || body.document_key || ""),
    status,
    signed_document_url: doc?.downloads?.signed_file_url as string | undefined,
    signer_ip: body.ip as string | undefined,
    raw: body,
  };
}

function normalizeAutentique(body: Record<string, unknown>): WebhookPayload {
  const doc = body.document as Record<string, unknown> | undefined;
  const status = mapProviderStatus(String(body.action || body.event || ""));

  return {
    provider: "autentique",
    external_document_id: String(doc?.id || body.document_id || ""),
    status,
    signed_document_url: doc?.file?.signed as string | undefined,
    raw: body,
  };
}

function normalizeZapSign(body: Record<string, unknown>): WebhookPayload {
  const status = mapProviderStatus(String(body.event_type || body.status || ""));

  return {
    provider: "zapsign",
    external_document_id: String(body.doc_token || body.token || ""),
    status,
    signed_document_url: body.signed_file as string | undefined,
    raw: body,
  };
}

function normalizeOpenSign(body: Record<string, unknown>): WebhookPayload {
  return {
    provider: "opensign",
    external_document_id: String(body.document_id || ""),
    status: mapProviderStatus(String(body.status || "")),
    signed_document_url: body.signed_document_url as string | undefined,
    signed_document_hash: body.signed_document_hash as string | undefined,
    signer_ip: body.ip_address as string | undefined,
    signer_user_agent: body.user_agent as string | undefined,
    raw: body,
  };
}

function normalizeGeneric(body: Record<string, unknown>, provider: string): WebhookPayload {
  return {
    provider,
    external_document_id: String(body.external_document_id || body.document_id || ""),
    status: mapProviderStatus(String(body.status || "")),
    signed_document_url: body.signed_document_url as string | undefined,
    signed_document_hash: body.signed_document_hash as string | undefined,
    rejection_reason: body.rejection_reason as string | undefined,
    raw: body,
  };
}

function mapProviderStatus(raw: string): "signed" | "rejected" | "expired" {
  const lower = raw.toLowerCase();
  if (lower.includes("sign") || lower.includes("completed") || lower.includes("closed")) return "signed";
  if (lower.includes("refus") || lower.includes("reject") || lower.includes("declined")) return "rejected";
  if (lower.includes("expir") || lower.includes("cancel")) return "expired";
  return "signed"; // default optimistic
}

function detectProvider(req: Request, body: Record<string, unknown>): string {
  const header = req.headers.get("x-webhook-provider");
  if (header) return header.toLowerCase();
  if (body.event_type && (body.document_key || (body.event as any)?.document)) return "clicksign";
  if (body.action && body.document && (body.document as any)?.id) return "autentique";
  if (body.doc_token || body.token) return "zapsign";
  if (body.provider === "opensign") return "opensign";
  return "unknown";
}

function normalizePayload(provider: string, body: Record<string, unknown>): WebhookPayload {
  switch (provider) {
    case "clicksign": return normalizeClicksign(body);
    case "autentique": return normalizeAutentique(body);
    case "zapsign": return normalizeZapSign(body);
    case "opensign": return normalizeOpenSign(body);
    default: return normalizeGeneric(body, provider);
  }
}

// ── Main handler ──

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Webhook Secret Validation (DB → env var fallback) ──
  let expectedSecret = Deno.env.get("AGREEMENT_WEBHOOK_SECRET") || null;

  // Try to load from webhook_configurations table (overrides env var)
  try {
    const { data: dbConfig } = await supabase
      .from("webhook_configurations")
      .select("secret_value, is_active")
      .eq("webhook_name", "agreement_webhook")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (dbConfig?.secret_value) {
      expectedSecret = dbConfig.secret_value;
    }
  } catch {
    // If DB lookup fails, fall back to env var silently
    console.warn("[agreement-webhook] Could not read webhook_configurations, using env var fallback");
  }

  if (expectedSecret) {
    const providedSecret = req.headers.get("x-webhook-secret");
    if (providedSecret !== expectedSecret) {
      console.warn("[agreement-webhook] Invalid or missing webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const body = await req.json();
    const provider = detectProvider(req, body);
    const payload = normalizePayload(provider, body);

    console.log(`[agreement-webhook] Provider: ${provider}, DocID: ${payload.external_document_id}, Status: ${payload.status}`);

    if (!payload.external_document_id) {
      return new Response(JSON.stringify({ error: "Missing external_document_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Find the agreement by external_document_id ──

    const { data: agreement, error: findError } = await supabase
      .from("employee_agreements")
      .select("id, tenant_id, employee_id, template_id, status, signature_provider")
      .eq("external_document_id", payload.external_document_id)
      .single();

    if (findError || !agreement) {
      console.error("[agreement-webhook] Agreement not found:", payload.external_document_id);
      return new Response(JSON.stringify({ error: "Agreement not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if already in final state
    if (agreement.status === "signed") {
      return new Response(JSON.stringify({ ok: true, message: "Already signed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Update agreement status ──

    const update: Record<string, unknown> = {
      status: payload.status === "signed" ? "signed" : payload.status === "rejected" ? "refused" : "expired",
    };

    if (payload.status === "signed") {
      update.signed_at = new Date().toISOString();
      update.signed_document_hash = payload.signed_document_hash || null;
      update.ip_address = payload.signer_ip || req.headers.get("x-forwarded-for") || null;
      update.user_agent = payload.signer_user_agent || req.headers.get("user-agent") || null;

      // ── 3. Store signed PDF in DocumentVault ──
      if (payload.signed_document_url) {
        try {
          const pdfResponse = await fetch(payload.signed_document_url);
          if (pdfResponse.ok) {
            const pdfBlob = await pdfResponse.blob();
            const storagePath = `${agreement.tenant_id}/${agreement.id}/signed_${agreement.id}.pdf`;

            const { error: uploadError } = await supabase.storage
              .from("signed-documents")
              .upload(storagePath, pdfBlob, {
                contentType: "application/pdf",
                upsert: true,
              });

            if (!uploadError) {
              update.signed_document_url = storagePath;
              console.log(`[agreement-webhook] PDF stored: ${storagePath}`);
            } else {
              console.error("[agreement-webhook] PDF upload failed:", uploadError.message);
            }
          }
        } catch (downloadErr) {
          console.error("[agreement-webhook] PDF download failed:", downloadErr);
        }
      }
    } else if (payload.status === "rejected") {
      update.refused_at = new Date().toISOString();
      update.refusal_reason = payload.rejection_reason || null;
    }

    const { error: updateError } = await supabase
      .from("employee_agreements")
      .update(update)
      .eq("id", agreement.id);

    if (updateError) {
      console.error("[agreement-webhook] Update failed:", updateError.message);
      return new Response(JSON.stringify({ error: "Failed to update agreement" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Register audit log (AgreementSigned event) ──

    const eventType = payload.status === "signed"
      ? "agreement.signed"
      : payload.status === "rejected"
        ? "agreement.rejected"
        : "agreement.expired";

    await supabase.from("audit_logs").insert({
      tenant_id: agreement.tenant_id,
      entity_type: "employee_agreement",
      entity_id: agreement.id,
      action: eventType,
      new_value: {
        status: payload.status,
        provider: payload.provider,
        external_document_id: payload.external_document_id,
        signed_document_url: update.signed_document_url || null,
        signed_at: update.signed_at || null,
        ip_address: update.ip_address || null,
      },
      metadata: {
        employee_id: agreement.employee_id,
        template_id: agreement.template_id,
        webhook_provider: payload.provider,
        webhook_received_at: new Date().toISOString(),
        raw_payload_keys: Object.keys(payload.raw),
      },
    });

    console.log(`[agreement-webhook] ✅ ${eventType} — Agreement ${agreement.id}`);

    return new Response(JSON.stringify({
      ok: true,
      event: eventType,
      agreement_id: agreement.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[agreement-webhook] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
