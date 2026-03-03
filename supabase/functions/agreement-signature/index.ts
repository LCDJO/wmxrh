/**
 * agreement-signature — Edge Function
 *
 * Proxy for digital signature provider APIs.
 * Routes operations (send, status, cancel, download) to the configured provider.
 *
 * Supported providers:
 *   - simulation (built-in, for dev/test)
 *   - opensign, clicksign, autentique, zapsign (require API keys as secrets)
 *
 * Security: JWT required (tenant-scoped operations)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory simulation store (per cold-start instance)
const simulatedDocs = new Map<
  string,
  {
    status: "pending" | "signed" | "rejected" | "expired";
    created_at: number;
    employee_nome: string;
    employee_email: string;
  }
>();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, provider } = body;

    if (!action || !provider) {
      return new Response(
        JSON.stringify({ error: "Missing 'action' or 'provider'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Route to provider ──
    switch (provider) {
      case "simulation":
        return handleSimulation(action, body);

      case "opensign":
        return await handleExternalProvider(action, body, provider, "OPENSIGN_API_KEY");

      case "clicksign":
        return await handleExternalProvider(action, body, provider, "CLICKSIGN_API_KEY");

      case "autentique":
        return await handleExternalProvider(action, body, provider, "AUTENTIQUE_API_KEY");

      case "zapsign":
        return await handleExternalProvider(action, body, provider, "ZAPSIGN_API_KEY");

      default:
        return jsonResponse({ error: `Unsupported provider: ${provider}` }, 400);
    }
  } catch (err) {
    console.error("[agreement-signature] Error:", err);
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// SIMULATION PROVIDER (built-in, no API key needed)
// ═══════════════════════════════════════════════════════════

function handleSimulation(action: string, body: Record<string, unknown>): Response {
  switch (action) {
    case "send": {
      const id = `sim_${crypto.randomUUID().slice(0, 8)}`;
      simulatedDocs.set(id, {
        status: "pending",
        created_at: Date.now(),
        employee_nome: (body.employee_nome as string) || "",
        employee_email: (body.employee_email as string) || "",
      });

      return jsonResponse({
        document_id: id,
        signing_url: `https://simulation.local/sign/${id}`,
        status: "sent",
      });
    }

    case "status": {
      const docId = body.document_id as string;
      const doc = simulatedDocs.get(docId);
      if (!doc) {
        return jsonResponse({
          external_document_id: docId,
          status: "expired",
        });
      }

      // Auto-sign after 5 seconds
      const elapsed = Date.now() - doc.created_at;
      if (elapsed > 5000 && doc.status === "pending") {
        doc.status = "signed";
      }

      return jsonResponse({
        external_document_id: docId,
        status: doc.status,
        signed_at: doc.status === "signed" ? new Date().toISOString() : undefined,
        signed_document_url:
          doc.status === "signed"
            ? `https://simulation.local/docs/${docId}.pdf`
            : undefined,
        signed_document_hash:
          doc.status === "signed" ? `sha256:sim_${docId}` : undefined,
      });
    }

    case "cancel": {
      const docId = body.document_id as string;
      const doc = simulatedDocs.get(docId);
      if (doc && doc.status === "pending") {
        doc.status = "expired";
        return jsonResponse({ cancelled: true });
      }
      return jsonResponse({ cancelled: false });
    }

    case "download": {
      return jsonResponse({
        content_base64: btoa("%PDF-1.4 Simulated Signed Document"),
        content_type: "application/pdf",
      });
    }

    default:
      return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  }
}

// ═══════════════════════════════════════════════════════════
// EXTERNAL PROVIDERS (stub — returns clear error until API key configured)
// ═══════════════════════════════════════════════════════════

async function handleExternalProvider(
  action: string,
  body: Record<string, unknown>,
  provider: string,
  secretName: string,
): Promise<Response> {
  const apiKey = Deno.env.get(secretName);

  if (!apiKey) {
    return jsonResponse(
      {
        error: `Provider '${provider}' requires secret '${secretName}'. Configure it in Lovable Cloud secrets.`,
        provider,
        status: "error",
        configuration_required: true,
      },
      422,
    );
  }

  // Provider-specific API calls would go here.
  // For now, return a structured stub that indicates the provider is configured
  // but the actual API integration is pending implementation.
  switch (action) {
    case "send":
      return jsonResponse({
        document_id: `${provider}_${crypto.randomUUID().slice(0, 8)}`,
        signing_url: "",
        status: "created",
        message: `Provider '${provider}' API key found. Full API integration pending.`,
      });

    case "status":
      return jsonResponse({
        external_document_id: body.document_id,
        status: "pending",
        message: `Provider '${provider}' status check — full integration pending.`,
      });

    case "cancel":
      return jsonResponse({ cancelled: false, message: "Full integration pending." });

    case "download":
      return jsonResponse({ content_base64: null, message: "Full integration pending." });

    default:
      return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  }
}

// ── Helpers ──

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
