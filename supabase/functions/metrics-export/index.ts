import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * metrics-export — Prometheus/OpenTelemetry compatible metrics endpoint.
 *
 * Accepts POST with metrics payload and returns Prometheus text format.
 * GET returns current metrics in Prometheus exposition format.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method === "POST") {
      const body = await req.json();
      const { metrics, format } = body;

      if (format === 'prometheus' || !format) {
        // Convert metrics to Prometheus text exposition format
        const lines: string[] = [];

        for (const metric of (metrics ?? [])) {
          const name = (metric.name ?? '').replace(/[.-]/g, '_');
          lines.push(`# HELP ${name} ${metric.help ?? name}`);
          lines.push(`# TYPE ${name} ${metric.type ?? 'gauge'}`);

          for (const sample of (metric.samples ?? [])) {
            const labels = Object.entries(sample.labels ?? {})
              .map(([k, v]) => `${k}="${v}"`)
              .join(',');
            const labelStr = labels ? `{${labels}}` : '';
            lines.push(`${name}${labelStr} ${sample.value}${sample.timestamp ? ` ${sample.timestamp}` : ''}`);
          }
        }

        return new Response(lines.join('\n') + '\n', {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
          },
        });
      }

      // JSON format (OpenTelemetry compatible)
      return new Response(JSON.stringify({
        resource_metrics: [{
          scope_metrics: [{
            metrics: metrics ?? [],
          }],
        }],
        exported_at: Date.now(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET — return a health check / discovery endpoint
    return new Response(JSON.stringify({
      service: "platform-observability",
      endpoints: {
        metrics: "POST /metrics-export (format: prometheus|otlp)",
        health: "GET /metrics-export",
      },
      supported_formats: ["prometheus", "otlp"],
      version: "1.0.0",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("metrics-export error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
