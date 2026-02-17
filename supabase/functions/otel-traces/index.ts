import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * GET  /otel-traces → OTLP-compatible trace spans
 * POST /otel-traces → Ingest trace spans
 *
 * W3C Trace Context compatible.
 */

interface TraceSpan {
  trace_id: string;
  span_id: string;
  parent_span_id?: string | null;
  module_name: string;
  gateway_action: string;
  kind: "internal" | "server" | "client" | "producer" | "consumer";
  status: "ok" | "error" | "unset";
  start_ms: number;
  end_ms: number | null;
  duration_ms: number;
  attributes: Record<string, string | number | boolean>;
  events: Array<{ name: string; timestamp_ms: number; attributes?: Record<string, string | number | boolean> }>;
}

const SPAN_BUFFER_MAX = 500;
const spanBuffer: TraceSpan[] = [];

function generateHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── POST: Ingest spans ───────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json();
      const spans: Partial<TraceSpan>[] = body.spans ?? [];

      let ingested = 0;
      for (const s of spans) {
        const span: TraceSpan = {
          trace_id: s.trace_id ?? generateHex(16),
          span_id: s.span_id ?? generateHex(8),
          parent_span_id: s.parent_span_id ?? null,
          module_name: s.module_name ?? "unknown",
          gateway_action: s.gateway_action ?? "unknown",
          kind: s.kind ?? "internal",
          status: s.status ?? "unset",
          start_ms: s.start_ms ?? Date.now(),
          end_ms: s.end_ms ?? null,
          duration_ms: s.duration_ms ?? (s.end_ms && s.start_ms ? s.end_ms - s.start_ms : 0),
          attributes: s.attributes ?? {},
          events: s.events ?? [],
        };
        spanBuffer.push(span);
        ingested++;
      }

      if (spanBuffer.length > SPAN_BUFFER_MAX) {
        spanBuffer.splice(0, spanBuffer.length - SPAN_BUFFER_MAX);
      }

      return new Response(JSON.stringify({ ingested }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET: Export OTLP-compatible ──────────────────────────
    const url = new URL(req.url);
    const since = Number(url.searchParams.get("since") ?? 0);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
    const traceId = url.searchParams.get("trace_id");
    const moduleFilter = url.searchParams.get("module");

    let filtered = spanBuffer.filter(s => s.start_ms >= since);
    if (traceId) filtered = filtered.filter(s => s.trace_id === traceId);
    if (moduleFilter) filtered = filtered.filter(s => s.module_name === moduleFilter);
    filtered.sort((a, b) => b.start_ms - a.start_ms);
    filtered = filtered.slice(0, limit);

    const traceIds = new Set(filtered.map(s => s.trace_id));

    return new Response(JSON.stringify({
      resource_spans: [{
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "platform_observability" } },
            { key: "service.version", value: { stringValue: "1.0.0" } },
          ],
        },
        scope_spans: [{
          scope: { name: "platform.gateway" },
          spans: filtered.map(s => ({
            traceId: s.trace_id,
            spanId: s.span_id,
            parentSpanId: s.parent_span_id ?? "",
            name: `${s.module_name}.${s.gateway_action}`,
            kind: spanKindToOtlp(s.kind),
            startTimeUnixNano: `${s.start_ms}000000`,
            endTimeUnixNano: s.end_ms ? `${s.end_ms}000000` : `${s.start_ms}000000`,
            status: { code: s.status === "ok" ? 1 : s.status === "error" ? 2 : 0 },
            attributes: Object.entries(s.attributes).map(([k, v]) => ({
              key: k,
              value: typeof v === "number" ? { intValue: v } : typeof v === "boolean" ? { boolValue: v } : { stringValue: String(v) },
            })),
            events: s.events.map(e => ({
              timeUnixNano: `${e.timestamp_ms}000000`,
              name: e.name,
              attributes: Object.entries(e.attributes ?? {}).map(([k, v]) => ({
                key: k,
                value: { stringValue: String(v) },
              })),
            })),
          })),
        }],
      }],
      total_traces: traceIds.size,
      total_spans: filtered.length,
      exported_at: Date.now(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("otel-traces error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function spanKindToOtlp(kind: string): number {
  switch (kind) {
    case "internal": return 1;
    case "server": return 2;
    case "client": return 3;
    case "producer": return 4;
    case "consumer": return 5;
    default: return 0;
  }
}
