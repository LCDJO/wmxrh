import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * GET  /loki-logs → Loki-compatible JSON log streams
 * POST /loki-logs → Ingest structured logs
 *
 * Loki push API format: { streams: [{ stream: {labels}, values: [[ts_ns, line]] }] }
 */

interface LogEntry {
  level: string;
  module: string;
  tenant_id?: string;
  user_id?: string;
  message: string;
  trace_id?: string;
  timestamp: number;
}

const LOG_BUFFER_MAX = 1000;
const logBuffer: LogEntry[] = [];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── POST: Ingest logs ────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json();
      const entries: LogEntry[] = body.entries ?? body.logs ?? [];

      for (const entry of entries) {
        logBuffer.push({
          level: entry.level ?? "info",
          module: entry.module ?? "unknown",
          tenant_id: entry.tenant_id,
          user_id: entry.user_id,
          message: entry.message ?? "",
          trace_id: entry.trace_id,
          timestamp: entry.timestamp ?? Date.now(),
        });
      }

      // Trim buffer
      if (logBuffer.length > LOG_BUFFER_MAX) {
        logBuffer.splice(0, logBuffer.length - LOG_BUFFER_MAX);
      }

      return new Response(JSON.stringify({ ingested: entries.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET: Export as Loki streams ──────────────────────────
    const url = new URL(req.url);
    const since = Number(url.searchParams.get("since") ?? 0);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 1000);
    const moduleFilter = url.searchParams.get("module");
    const levelFilter = url.searchParams.get("level");

    let filtered = logBuffer.filter(e => e.timestamp >= since);
    if (moduleFilter) filtered = filtered.filter(e => e.module === moduleFilter);
    if (levelFilter) filtered = filtered.filter(e => e.level === levelFilter);
    filtered = filtered.slice(-limit);

    // Group by module+level → Loki streams
    const groups = new Map<string, LogEntry[]>();
    for (const log of filtered) {
      const key = `${log.module}|${log.level}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    }

    const streams = Array.from(groups.entries()).map(([key, entries]) => {
      const [module, level] = key.split("|");
      return {
        stream: { module, level, job: "platform_observability" },
        values: entries.map(e => [
          `${e.timestamp}000000`, // ms → ns
          JSON.stringify({
            message: e.message,
            trace_id: e.trace_id ?? "",
            tenant_id: e.tenant_id ?? "",
            user_id: e.user_id ?? "",
          }),
        ]),
      };
    });

    return new Response(JSON.stringify({ streams, total: filtered.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("loki-logs error:", e);
    return new Response(JSON.stringify({ error: "Failed to process logs" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
