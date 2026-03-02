import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Crypto helpers ──

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Main handler ──

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const signingKey = Deno.env.get("WORKTIME_SIGNING_KEY") || serviceKey.slice(0, 64);

    // Auth client to verify user token
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Invalid token" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // Service-role client for data operations
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    // ═══════════════════════════════════════════════════════
    // POST /worktime/clock  →  action: "clock"
    // ═══════════════════════════════════════════════════════
    if (action === "clock") {
      const { entry } = body;
      if (!entry?.tenant_id || !entry?.employee_id || !entry?.event_type) {
        return json({ error: "Missing required fields: tenant_id, employee_id, event_type" }, 400);
      }

      // Chain linkage — get previous hash
      const { data: lastEntry } = await supabase
        .from("worktime_ledger")
        .select("integrity_hash")
        .eq("tenant_id", entry.tenant_id)
        .eq("employee_id", entry.employee_id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const previousHash = lastEntry?.integrity_hash ?? null;
      const recordedAt = entry.recorded_at || new Date().toISOString();

      const canonicalPayload = [
        entry.tenant_id, entry.employee_id, entry.event_type,
        recordedAt, entry.source || "manual",
        entry.latitude ?? "", entry.longitude ?? "",
        entry.accuracy_meters ?? "", entry.device_fingerprint ?? "",
        entry.ip_address ?? "", previousHash ?? "GENESIS",
      ].join("|");

      const integrityHash = await sha256(canonicalPayload);
      const serverSignature = await hmacSha256(
        signingKey,
        `${integrityHash}|${entry.tenant_id}|${new Date().toISOString()}`,
      );

      const { data: inserted, error: insertError } = await supabase
        .from("worktime_ledger")
        .insert({
          tenant_id: entry.tenant_id,
          employee_id: entry.employee_id,
          event_type: entry.event_type,
          recorded_at: recordedAt,
          server_timestamp: new Date().toISOString(),
          source: entry.source || "manual",
          latitude: entry.latitude ?? null,
          longitude: entry.longitude ?? null,
          accuracy_meters: entry.accuracy_meters ?? null,
          device_fingerprint: entry.device_fingerprint ?? null,
          device_model: entry.device_model ?? null,
          device_os: entry.device_os ?? null,
          app_version: entry.app_version ?? null,
          ip_address: entry.ip_address || req.headers.get("x-forwarded-for") || null,
          geofence_id: entry.geofence_id ?? null,
          geofence_matched: entry.geofence_matched ?? false,
          photo_proof_url: entry.photo_proof_url ?? null,
          integrity_hash: integrityHash,
          previous_hash: previousHash,
          server_signature: serverSignature,
          signature_algorithm: "HMAC-SHA256",
          is_offline_sync: entry.is_offline_sync ?? false,
          offline_recorded_at: entry.offline_recorded_at ?? null,
          status: "valid",
          employee_name: entry.employee_name ?? null,
          employee_cpf_masked: entry.employee_cpf_masked ?? null,
          employee_pis: entry.employee_pis ?? null,
        })
        .select()
        .single();

      if (insertError) return json({ error: `Insert failed: ${insertError.message}` }, 500);

      // Audit trail
      await supabase.from("worktime_audit_trail").insert({
        tenant_id: entry.tenant_id,
        action: "clock_registered",
        entity_type: "worktime_entry",
        entity_id: inserted.id,
        actor_id: userId,
        details: { event_type: entry.event_type, source: entry.source || "manual" },
      }).catch(() => {});

      return json({
        entry: inserted,
        integrity_hash: integrityHash,
        server_signature: serverSignature,
        algorithm: "HMAC-SHA256",
      });
    }

    // ═══════════════════════════════════════════════════════
    // GET /worktime/history  →  action: "history"
    // ═══════════════════════════════════════════════════════
    if (action === "history") {
      const { tenant_id, employee_id, from, to, page = 1, per_page = 50 } = body;
      if (!tenant_id || !employee_id) {
        return json({ error: "Missing tenant_id or employee_id" }, 400);
      }

      let query = supabase
        .from("worktime_ledger")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant_id)
        .eq("employee_id", employee_id)
        .order("recorded_at", { ascending: false });

      if (from) query = query.gte("recorded_at", from);
      if (to) query = query.lte("recorded_at", to);

      const offset = (page - 1) * per_page;
      query = query.range(offset, offset + per_page - 1);

      const { data, error: qErr, count } = await query;
      if (qErr) return json({ error: qErr.message }, 500);

      // Also fetch adjustments for this period
      let adjQuery = supabase
        .from("worktime_ledger_adjustments")
        .select("*")
        .eq("tenant_id", tenant_id);

      if (data && data.length > 0) {
        const entryIds = data.map((e: any) => e.id);
        adjQuery = adjQuery.in("original_entry_id", entryIds);
      }

      const { data: adjustments } = await adjQuery;

      return json({
        entries: data ?? [],
        adjustments: adjustments ?? [],
        pagination: { page, per_page, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / per_page) },
      });
    }

    // ═══════════════════════════════════════════════════════
    // GET /worktime/export  →  action: "export"
    // ═══════════════════════════════════════════════════════
    if (action === "export") {
      const { tenant_id, export_type, period_start, period_end, employee_ids } = body;
      if (!tenant_id || !export_type || !period_start || !period_end) {
        return json({ error: "Missing required: tenant_id, export_type, period_start, period_end" }, 400);
      }

      // Fetch entries
      let query = supabase
        .from("worktime_ledger")
        .select("*")
        .eq("tenant_id", tenant_id)
        .gte("recorded_at", `${period_start}T00:00:00Z`)
        .lte("recorded_at", `${period_end}T23:59:59Z`)
        .order("recorded_at", { ascending: true });

      if (employee_ids?.length) {
        query = query.in("employee_id", employee_ids);
      }

      const { data: entries, error: fetchErr } = await query;
      if (fetchErr) return json({ error: fetchErr.message }, 500);

      const records = entries ?? [];

      // Generate content server-side for official formats
      let file_content: string;

      switch (export_type) {
        case "AFD":
          file_content = generateAFD(records);
          break;
        case "AFDT":
          file_content = generateAFDT(records);
          break;
        case "ACJEF":
          file_content = generateACJEF(records);
          break;
        case "AEJ":
          file_content = generateAEJ(records);
          break;
        case "csv":
          file_content = generateCSV(records);
          break;
        case "espelho_ponto":
          file_content = generateEspelhoPonto(records, period_start, period_end);
          break;
        default:
          file_content = generateCSV(records);
      }

      // 5-year retention
      const retentionUntil = new Date();
      retentionUntil.setFullYear(retentionUntil.getFullYear() + 5);

      // Persist export record
      const { data: exportData, error: expErr } = await supabase
        .from("worktime_exports")
        .insert({
          tenant_id,
          export_type,
          period_start,
          period_end,
          employee_ids: employee_ids ?? null,
          status: "completed",
          record_count: records.length,
          requested_by: userId,
          completed_at: new Date().toISOString(),
          file_content,
          legal_basis: "Portaria 671/2021 Art. 80-84",
          retention_until: retentionUntil.toISOString(),
        })
        .select()
        .single();

      if (expErr) return json({ error: `Export failed: ${expErr.message}` }, 500);

      // Audit
      await supabase.from("worktime_audit_trail").insert({
        tenant_id,
        action: "export_generated",
        entity_type: "worktime_export",
        entity_id: exportData.id,
        actor_id: userId,
        details: { export_type, period: `${period_start} → ${period_end}`, record_count: records.length },
      }).catch(() => {});

      return json({
        export: exportData,
        file_content,
        record_count: records.length,
      });
    }

    // ═══════════════════════════════════════════════════════
    // POST /worktime/adjustment  →  action: "adjustment"
    // ═══════════════════════════════════════════════════════
    if (action === "adjustment") {
      const { adjustment } = body;
      if (!adjustment?.tenant_id || !adjustment?.original_entry_id || !adjustment?.reason) {
        return json({ error: "Missing required: tenant_id, original_entry_id, reason" }, 400);
      }

      // Verify original entry exists
      const { data: origEntry, error: origErr } = await supabase
        .from("worktime_ledger")
        .select("id, tenant_id")
        .eq("id", adjustment.original_entry_id)
        .single();

      if (origErr || !origEntry) return json({ error: "Original entry not found" }, 404);

      const now = new Date().toISOString();
      const canonicalPayload = [
        adjustment.original_entry_id, adjustment.adjustment_type || "correction",
        adjustment.reason, adjustment.new_recorded_at ?? "", now,
      ].join("|");

      const integrityHash = await sha256(canonicalPayload);
      const serverSignature = await hmacSha256(signingKey, integrityHash);

      const { data: inserted, error: insErr } = await supabase
        .from("worktime_ledger_adjustments")
        .insert({
          tenant_id: adjustment.tenant_id,
          original_entry_id: adjustment.original_entry_id,
          adjustment_type: adjustment.adjustment_type || "correction",
          new_recorded_at: adjustment.new_recorded_at ?? null,
          new_event_type: adjustment.new_event_type ?? null,
          reason: adjustment.reason,
          legal_basis: adjustment.legal_basis ?? null,
          requested_by: userId,
          requested_at: now,
          approval_status: "pending",
          integrity_hash: integrityHash,
          server_signature: serverSignature,
        })
        .select()
        .single();

      if (insErr) return json({ error: `Insert failed: ${insErr.message}` }, 500);

      // Audit
      await supabase.from("worktime_audit_trail").insert({
        tenant_id: adjustment.tenant_id,
        action: "adjustment_requested",
        entity_type: "worktime_adjustment",
        entity_id: inserted.id,
        actor_id: userId,
        details: { original_entry_id: adjustment.original_entry_id, reason: adjustment.reason },
      }).catch(() => {});

      return json({ adjustment: inserted, integrity_hash: integrityHash });
    }

    // ═══════════════════════════════════════════════════════
    // POST /worktime/adjustment/approve  →  action: "approve_adjustment"
    // ═══════════════════════════════════════════════════════
    if (action === "approve_adjustment") {
      const { adjustment_id, approved } = body;
      if (!adjustment_id) return json({ error: "Missing adjustment_id" }, 400);

      const { data: adj, error: fetchErr } = await supabase
        .from("worktime_ledger_adjustments")
        .select("*")
        .eq("id", adjustment_id)
        .single();

      if (fetchErr || !adj) return json({ error: "Adjustment not found" }, 404);
      if (adj.approval_status !== "pending") {
        return json({ error: `Adjustment already ${adj.approval_status}` }, 400);
      }

      const newStatus = approved ? "approved" : "rejected";
      const { data: updated, error: updErr } = await supabase
        .from("worktime_ledger_adjustments")
        .update({ approval_status: newStatus, approved_by: userId, approved_at: new Date().toISOString() })
        .eq("id", adjustment_id)
        .select()
        .single();

      if (updErr) return json({ error: updErr.message }, 500);

      await supabase.from("worktime_audit_trail").insert({
        tenant_id: adj.tenant_id,
        action: `adjustment_${newStatus}`,
        entity_type: "worktime_adjustment",
        entity_id: adjustment_id,
        actor_id: userId,
        details: { original_entry_id: adj.original_entry_id, decision: newStatus },
      }).catch(() => {});

      return json({ adjustment: updated, status: newStatus });
    }

    // ═══════════════════════════════════════════════════════
    // POST /worktime/verify  →  action: "verify_entry"
    // ═══════════════════════════════════════════════════════
    if (action === "verify_entry") {
      const { entry_id } = body;
      const { data: entry, error: fetchErr } = await supabase
        .from("worktime_ledger")
        .select("*")
        .eq("id", entry_id)
        .single();

      if (fetchErr || !entry) return json({ error: "Entry not found" }, 404);

      const canonical = [
        entry.tenant_id, entry.employee_id, entry.event_type,
        entry.recorded_at, entry.source,
        entry.latitude ?? "", entry.longitude ?? "",
        entry.accuracy_meters ?? "", entry.device_fingerprint ?? "",
        entry.ip_address ?? "", entry.previous_hash ?? "GENESIS",
      ].join("|");

      const recomputed = await sha256(canonical);

      return json({
        entry_id,
        hash_valid: recomputed === entry.integrity_hash,
        stored_hash: entry.integrity_hash,
        recomputed_hash: recomputed,
        has_signature: !!entry.server_signature,
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// Server-side export generators (Portaria 671/2021)
// ══════════════════════════════════════════════════════════════

const EVT_CODE: Record<string, string> = { clock_in: "1", clock_out: "2", break_start: "3", break_end: "4" };

function generateAFD(entries: any[]): string {
  const lines = [`00000000001|AFD|${new Date().toISOString().slice(0, 10)}|WORKTIME_ENGINE|v1.0`];
  let nsr = 1;
  for (const e of entries) {
    const dt = new Date(e.recorded_at);
    lines.push(`${String(nsr).padStart(9, "0")}|3|${dt.toISOString().slice(0, 10).replace(/-/g, "")}${dt.toISOString().slice(11, 16).replace(":", "")}|${e.employee_pis ?? "00000000000"}|${EVT_CODE[e.event_type] ?? "0"}|${(e.integrity_hash ?? "").slice(0, 16)}`);
    nsr++;
  }
  lines.push(`${String(nsr).padStart(9, "0")}|9|${entries.length}`);
  return lines.join("\n");
}

function generateAFDT(entries: any[]): string {
  const lines = ["NSR;TIPO;DATA;HORA;PIS;NOME;CPF;TIPO_EVENTO;LAT;LON;HASH"];
  let nsr = 1;
  for (const e of entries) {
    const dt = new Date(e.recorded_at);
    lines.push([String(nsr).padStart(9, "0"), "3", dt.toISOString().slice(0, 10), dt.toISOString().slice(11, 19), e.employee_pis ?? "", e.employee_name ?? "", e.employee_cpf_masked ?? "", e.event_type, e.latitude?.toFixed(6) ?? "", e.longitude?.toFixed(6) ?? "", e.integrity_hash ?? ""].join(";"));
    nsr++;
  }
  return lines.join("\n");
}

function generateACJEF(entries: any[]): string {
  const lines = ["NSR;DATA;PIS;NOME;ENTRADA;SAIDA_INT;RET_INT;SAIDA;H_NORM;H_EXTRA"];
  const grouped = new Map<string, any[]>();
  for (const e of entries) {
    const k = `${e.employee_id}|${e.recorded_at.slice(0, 10)}`;
    (grouped.get(k) ?? (grouped.set(k, []), grouped.get(k))!).push(e);
  }
  let nsr = 1;
  for (const [, day] of grouped) {
    const ci = day.find((x: any) => x.event_type === "clock_in");
    const co = day.find((x: any) => x.event_type === "clock_out");
    const bs = day.find((x: any) => x.event_type === "break_start");
    const be = day.find((x: any) => x.event_type === "break_end");
    if (!ci) continue;
    const fmt = (x: any) => x ? new Date(x.recorded_at).toISOString().slice(11, 16) : "";
    let norm = 0, extra = 0;
    if (ci && co) {
      const total = (new Date(co.recorded_at).getTime() - new Date(ci.recorded_at).getTime()) / 60000;
      const brk = bs && be ? (new Date(be.recorded_at).getTime() - new Date(bs.recorded_at).getTime()) / 60000 : 0;
      const worked = total - brk;
      norm = Math.min(worked, 480);
      extra = Math.max(0, worked - 480);
    }
    const fmtM = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;
    lines.push([String(nsr).padStart(9, "0"), ci.recorded_at.slice(0, 10), ci.employee_pis ?? "", ci.employee_name ?? "", fmt(ci), fmt(bs), fmt(be), fmt(co), fmtM(norm), fmtM(extra)].join(";"));
    nsr++;
  }
  return lines.join("\n");
}

function generateAEJ(entries: any[]): string {
  const lines = ["TIPO;NSR;DATA;HORA;PIS;NOME;CPF;EVENTO;FONTE;DEVICE;LAT;LON;HASH;SIG"];
  let nsr = 1;
  for (const e of entries) {
    const dt = new Date(e.recorded_at);
    lines.push(["3", String(nsr).padStart(9, "0"), dt.toISOString().slice(0, 10), dt.toISOString().slice(11, 19), e.employee_pis ?? "", e.employee_name ?? "", e.employee_cpf_masked ?? "", e.event_type, e.source, e.device_fingerprint ?? "", e.latitude?.toFixed(6) ?? "", e.longitude?.toFixed(6) ?? "", e.integrity_hash ?? "", e.server_signature ? "HMAC-SHA256" : "N/A"].join(";"));
    nsr++;
  }
  return lines.join("\n");
}

function generateCSV(entries: any[]): string {
  const lines = ["id;employee_id;employee_name;cpf;pis;event_type;recorded_at;source;lat;lon;device;status;hash"];
  for (const e of entries) {
    lines.push([e.id, e.employee_id, e.employee_name ?? "", e.employee_cpf_masked ?? "", e.employee_pis ?? "", e.event_type, e.recorded_at, e.source, e.latitude?.toFixed(6) ?? "", e.longitude?.toFixed(6) ?? "", e.device_fingerprint ?? "", e.status, e.integrity_hash].join(";"));
  }
  return lines.join("\n");
}

function generateEspelhoPonto(entries: any[], periodStart: string, periodEnd: string): string {
  const lines: string[] = [];
  lines.push("ESPELHO DE PONTO ELETRÔNICO");
  lines.push(`Período: ${periodStart} a ${periodEnd}`);
  lines.push(`Gerado em: ${new Date().toISOString()}`);
  lines.push("=".repeat(100));

  const grouped = new Map<string, any[]>();
  for (const e of entries) {
    const k = `${e.employee_id}|${e.recorded_at.slice(0, 10)}`;
    (grouped.get(k) ?? (grouped.set(k, []), grouped.get(k))!).push(e);
  }

  const byEmp = new Map<string, { name: string; cpf: string; pis: string; days: Map<string, any[]> }>();
  for (const [k, day] of grouped) {
    const [empId, date] = k.split("|");
    if (!byEmp.has(empId)) {
      byEmp.set(empId, { name: day[0].employee_name ?? empId, cpf: day[0].employee_cpf_masked ?? "", pis: day[0].employee_pis ?? "", days: new Map() });
    }
    byEmp.get(empId)!.days.set(date, day);
  }

  for (const [, emp] of byEmp) {
    lines.push("");
    lines.push(`Colaborador: ${emp.name}`);
    lines.push(`CPF: ${emp.cpf}  |  PIS: ${emp.pis}`);
    lines.push("-".repeat(100));
    lines.push("Data        Entrada   Saída Int.  Ret. Int.   Saída     Trabalhado  Normal    Extra");
    lines.push("-".repeat(100));

    let tw = 0, tn = 0, te = 0;
    for (const [date, day] of emp.days) {
      const ci = day.find((x: any) => x.event_type === "clock_in");
      const co = day.find((x: any) => x.event_type === "clock_out");
      const bs = day.find((x: any) => x.event_type === "break_start");
      const be = day.find((x: any) => x.event_type === "break_end");
      const fmt = (x: any) => x ? new Date(x.recorded_at).toISOString().slice(11, 16) : "--:--";
      let worked = 0;
      if (ci && co) {
        const total = (new Date(co.recorded_at).getTime() - new Date(ci.recorded_at).getTime()) / 60000;
        const brk = bs && be ? (new Date(be.recorded_at).getTime() - new Date(bs.recorded_at).getTime()) / 60000 : 0;
        worked = total - brk;
      }
      const norm = Math.min(worked, 480);
      const extra = Math.max(0, worked - 480);
      tw += worked; tn += norm; te += extra;
      const fmtM = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;
      lines.push(`${date.padEnd(12)}${fmt(ci).padEnd(10)}${fmt(bs).padEnd(12)}${fmt(be).padEnd(12)}${fmt(co).padEnd(10)}${fmtM(worked).padEnd(12)}${fmtM(norm).padEnd(10)}${fmtM(extra)}`);
    }
    const fmtM = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;
    lines.push("-".repeat(100));
    lines.push(`${"TOTAL".padEnd(56)}${fmtM(tw).padEnd(12)}${fmtM(tn).padEnd(10)}${fmtM(te)}`);
    lines.push("=".repeat(100));
  }

  lines.push("");
  lines.push("Documento gerado eletronicamente — Retenção: 5 anos (CLT Art. 11)");
  return lines.join("\n");
}
