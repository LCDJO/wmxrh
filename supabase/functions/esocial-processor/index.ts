import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * eSocial Event Processor
 *
 * Processes pending eSocial events:
 *   1. Authenticates caller via JWT
 *   2. Validates tenant membership
 *   3. Loads 'pending' events from DB
 *   4. Validates payload structure
 *   5. Marks as 'processing' → simulates transmission → marks 'accepted' or 'rejected'
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Authentication ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // ── Parse request body ──
    let tenantId: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      tenantId = body.tenant_id ?? null;
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Authorization: verify tenant membership ──
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: membership } = await adminClient
      .from("tenant_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Access denied: not a member of this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Process events (using admin client for service-level operations) ──
    let query = adminClient
      .from("esocial_events")
      .select("*")
      .eq("status", "pending")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(50);

    const { data: events, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending events" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accepted = 0;
    let rejected = 0;
    let errors = 0;

    for (const event of events) {
      try {
        // Mark as processing
        await adminClient
          .from("esocial_events")
          .update({ status: "processing", sent_at: new Date().toISOString() })
          .eq("id", event.id);

        // Validate payload
        const validationResult = validatePayload(event);

        if (validationResult.valid) {
          const receipt = `REC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          await adminClient
            .from("esocial_events")
            .update({
              status: "accepted",
              receipt_number: receipt,
              processed_at: new Date().toISOString(),
              response_payload: {
                receipt_number: receipt,
                protocol: `PROT-${event.event_type}-${Date.now()}`,
                accepted_at: new Date().toISOString(),
              },
            })
            .eq("id", event.id);
          accepted++;
        } else {
          await adminClient
            .from("esocial_events")
            .update({
              status: "rejected",
              error_message: validationResult.errors.join("; "),
              retry_count: (event.retry_count || 0) + 1,
              processed_at: new Date().toISOString(),
            })
            .eq("id", event.id);
          rejected++;
        }
      } catch (eventError: any) {
        console.error(`[esocial-processor] event ${event.id}:`, eventError);
        await adminClient
          .from("esocial_events")
          .update({
            status: "error",
            error_message: eventError.message,
            retry_count: (event.retry_count || 0) + 1,
          })
          .eq("id", event.id);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ processed: events.length, accepted, rejected, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[esocial-processor] error:", e);
    return new Response(
      JSON.stringify({ error: "Failed to process eSocial event" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Inline payload validator ──
function validatePayload(event: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const payload = event.payload;

  if (!payload || typeof payload !== "object") {
    errors.push("Payload ausente ou inválido");
    return { valid: false, errors };
  }

  const eSocial = (payload as any)?.eSocial;
  if (!eSocial) {
    errors.push("Estrutura eSocial raiz ausente");
    return { valid: false, errors };
  }

  switch (event.event_type) {
    case "S-2200": {
      const evt = eSocial.evtAdmissao;
      if (!evt) { errors.push("evtAdmissao ausente"); break; }
      if (!evt.trabalhador?.cpfTrab) errors.push("CPF do trabalhador obrigatório");
      if (!evt.vinculo?.dtAdm) errors.push("Data de admissão obrigatória");
      if (!evt.vinculo?.infoContrato?.vrSalFx || evt.vinculo.infoContrato.vrSalFx <= 0)
        errors.push("Salário deve ser maior que zero");
      break;
    }
    case "S-2206": {
      const evt = eSocial.evtAltContratual;
      if (!evt) { errors.push("evtAltContratual ausente"); break; }
      if (!evt.altContratual?.dtAlteracao) errors.push("Data de alteração obrigatória");
      if (!evt.altContratual?.infoContrato?.vrSalFx || evt.altContratual.infoContrato.vrSalFx <= 0)
        errors.push("Novo salário deve ser maior que zero");
      break;
    }
    case "S-2220": {
      const evt = eSocial.evtMonit;
      if (!evt) { errors.push("evtMonit ausente"); break; }
      if (!evt.exMedOcup?.aso?.dtAso) errors.push("Data do ASO obrigatória");
      if (!evt.exMedOcup?.aso?.medico?.nmMed) errors.push("Nome do médico obrigatório");
      break;
    }
    default:
      break;
  }

  return { valid: errors.length === 0, errors };
}
