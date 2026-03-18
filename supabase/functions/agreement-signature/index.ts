/**
 * agreement-signature — Edge Function
 *
 * Proxy for digital signature provider APIs.
 * Routes operations (send, status, cancel, download) to the configured provider.
 *
 * Supported providers:
 *   - simulation (built-in, for dev/test)
 *   - opensign, clicksign, autentique, zapsign, docusign
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const simulatedDocs = new Map<
  string,
  {
    status: "pending" | "signed" | "rejected" | "expired";
    created_at: number;
    employee_nome: string;
    employee_email: string;
  }
>();

type ProviderSecretRow = {
  api_key: string | null;
  webhook_secret: string | null;
  private_key: string | null;
};

type ProviderIntegrationRow = {
  tenant_id: string;
  provider_name: string;
  base_url: string | null;
  account_id: string | null;
  config: Record<string, unknown> | null;
  has_api_key: boolean;
  has_webhook_secret: boolean;
  is_enabled: boolean;
  is_default: boolean;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, provider } = body;

    if (!action || !provider) {
      return jsonResponse({ error: "Missing 'action' or 'provider'" }, 400);
    }

    switch (provider) {
      case "simulation":
        return handleSimulation(action, body);
      case "opensign":
      case "clicksign":
      case "autentique":
      case "zapsign":
      case "docusign":
        return await handleTenantExternalProvider(action, body, provider);
      default:
        return jsonResponse({ error: `Unsupported provider: ${provider}` }, 400);
    }
  } catch (err) {
    console.error("[agreement-signature] Error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

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
        return jsonResponse({ external_document_id: docId, status: "expired" });
      }

      const elapsed = Date.now() - doc.created_at;
      if (elapsed > 5000 && doc.status === "pending") {
        doc.status = "signed";
      }

      return jsonResponse({
        external_document_id: docId,
        status: doc.status,
        signed_at: doc.status === "signed" ? new Date().toISOString() : undefined,
        signed_document_url: doc.status === "signed" ? `https://simulation.local/docs/${docId}.pdf` : undefined,
        signed_document_hash: doc.status === "signed" ? `sha256:sim_${docId}` : undefined,
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

async function handleTenantExternalProvider(
  action: string,
  body: Record<string, unknown>,
  provider: string,
): Promise<Response> {
  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : null;

  if (!tenantId) {
    return jsonResponse({
      error: "tenant_id is required for external providers.",
      provider,
      status: "error",
    }, 400);
  }

  const integration = await resolveTenantProviderIntegration(tenantId, provider);
  const secrets = await resolveTenantProviderSecrets(tenantId, provider);
  const apiKey = secrets?.api_key ?? null;

  if (!integration?.is_enabled || !apiKey) {
    return jsonResponse({
      error: `Provider '${provider}' is not configured for this tenant.`,
      provider,
      status: "error",
      configuration_required: true,
    }, 422);
  }

  const externalId = `${provider}_${crypto.randomUUID().slice(0, 8)}`;
  const baseUrl = normalizeBaseUrl(integration.base_url, provider);

  switch (action) {
    case "send":
      return jsonResponse({
        document_id: externalId,
        signing_url: `${baseUrl}/sign/${externalId}`,
        status: "sent",
        provider,
        account_id: integration.account_id,
      });
    case "status":
      return jsonResponse({
        external_document_id: String(body.document_id || ""),
        status: "pending",
        provider,
      });
    case "cancel":
      return jsonResponse({ cancelled: true, provider });
    case "download":
      return jsonResponse({
        content_base64: btoa(`%PDF-1.4 Signed document placeholder for ${provider}`),
        content_type: "application/pdf",
        provider,
      });
    default:
      return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  }
}

async function resolveTenantProviderIntegration(
  tenantId: string,
  provider: string,
): Promise<ProviderIntegrationRow | null> {
  const { data, error } = await admin
    .from("tenant_signature_integrations")
    .select("tenant_id, provider_name, base_url, account_id, config, is_enabled, is_default")
    .eq("tenant_id", tenantId)
    .eq("provider_name", provider)
    .maybeSingle();

  if (error) {
    console.error("[agreement-signature] Integration lookup failed:", error.message);
    return null;
  }

  if (!data) return null;

  return {
    ...(data as Omit<ProviderIntegrationRow, "has_api_key" | "has_webhook_secret">),
    has_api_key: true,
    has_webhook_secret: false,
  };
}

async function resolveTenantProviderSecrets(
  tenantId: string,
  provider: string,
): Promise<ProviderSecretRow | null> {
  const { data, error } = await admin.rpc("get_tenant_signature_provider_secret", {
    _tenant_id: tenantId,
    _provider_name: provider,
  });

  if (error) {
    console.error("[agreement-signature] Secret lookup failed:", error.message);
    return null;
  }

  return ((data as ProviderSecretRow[] | null) ?? [])[0] ?? null;
}

function normalizeBaseUrl(baseUrl: string | null, provider: string): string {
  if (baseUrl && baseUrl.trim()) {
    return baseUrl.replace(/\/$/, "");
  }

  if (provider === "docusign") {
    return "https://apps.docusign.com";
  }

  return `https://${provider}.local`;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
