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
 *   1. Loads 'pending' events from DB
 *   2. Validates payload structure
 *   3. Marks as 'processing' → simulates transmission → marks 'accepted' or 'rejected'
 *
 * In production, step 3 would call the government eSocial WebService.
 * Currently uses a simulation adapter for development.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let tenantId: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      tenantId = body.tenant_id ?? null;
    }

    // Load pending events
    let query = supabase
      .from("esocial_events")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (tenantId) query = query.eq("tenant_id", tenantId);

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
        await supabase
          .from("esocial_events")
          .update({ status: "processing", sent_at: new Date().toISOString() })
          .eq("id", event.id);

        // Validate payload
        const validationResult = validatePayload(event);

        if (validationResult.valid) {
          // Simulate government acceptance
          const receipt = `REC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          await supabase
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
          // Reject with validation errors
          await supabase
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
        await supabase
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
      JSON.stringify({
        processed: events.length,
        accepted,
        rejected,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[esocial-processor] error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
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

  // Event-specific validations
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
      // Unknown event types pass validation (no schema yet)
      break;
  }

  return { valid: errors.length === 0, errors };
}
