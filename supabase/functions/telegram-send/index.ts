import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TELEGRAM_API = "https://api.telegram.org/bot";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { action, tenant_id, chat_id, message, bot_token } = await req.json();

    // ── Test connection: verify bot token ──
    if (action === "test_connection") {
      if (!bot_token) {
        return json({ success: false, error: "Bot token is required" }, 400);
      }

      const res = await fetch(`${TELEGRAM_API}${bot_token}/getMe`);
      const data = await res.json();

      if (!data.ok) {
        return json({ success: false, error: data.description || "Invalid token" }, 400);
      }

      // Store encrypted token and update config
      await supabase
        .from("telegram_bot_configs")
        .upsert({
          tenant_id,
          bot_token: bot_token,
          bot_username: data.result.username,
          is_active: true,
          connection_status: "connected",
          last_verified_at: new Date().toISOString(),
          error_message: null,
        }, { onConflict: "tenant_id" });

      return json({
        success: true,
        bot: { username: data.result.username, first_name: data.result.first_name },
      });
    }

    // ── Test send: send a single message directly ──
    if (action === "test_send") {
      const config = await getBotConfig(supabase, tenant_id);
      if (!config) return json({ success: false, error: "Bot not configured" }, 400);

      const res = await fetch(`${TELEGRAM_API}${config.bot_token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id,
          text: message || "✅ Teste de integração Telegram - PeopleX",
          parse_mode: "HTML",
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        return json({ success: false, error: data.description }, 400);
      }

      return json({ success: true, message_id: data.result.message_id });
    }

    // ── Process queue: batch process pending messages ──
    if (action === "process_queue") {
      const batchSize = 10;

      // Claim pending messages
      const { data: messages, error: fetchErr } = await supabase
        .from("telegram_message_queue")
        .select("*")
        .eq("status", "pending")
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(batchSize);

      if (fetchErr) return json({ success: false, error: fetchErr.message }, 500);
      if (!messages || messages.length === 0) return json({ success: true, processed: 0 });

      // Group by tenant
      const byTenant = new Map<string, typeof messages>();
      for (const msg of messages) {
        const arr = byTenant.get(msg.tenant_id) || [];
        arr.push(msg);
        byTenant.set(msg.tenant_id, arr);
      }

      let processed = 0;
      let failed = 0;

      for (const [tid, msgs] of byTenant) {
        const config = await getBotConfig(supabase, tid);
        if (!config) {
          // Mark all as failed
          await supabase
            .from("telegram_message_queue")
            .update({ status: "failed", error_message: "Bot not configured", processed_at: new Date().toISOString() })
            .in("id", msgs.map(m => m.id));
          failed += msgs.length;
          continue;
        }

        for (const msg of msgs) {
          // Mark as processing
          await supabase
            .from("telegram_message_queue")
            .update({ status: "processing", attempts: msg.attempts + 1 })
            .eq("id", msg.id);

          try {
            const res = await fetch(`${TELEGRAM_API}${config.bot_token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: msg.chat_id,
                text: msg.message_text,
                parse_mode: msg.parse_mode || "HTML",
              }),
            });

            const data = await res.json();

            if (data.ok) {
              await supabase
                .from("telegram_message_queue")
                .update({ status: "sent", processed_at: new Date().toISOString() })
                .eq("id", msg.id);
              processed++;
            } else {
              const newStatus = msg.attempts + 1 >= msg.max_attempts ? "failed" : "pending";
              await supabase
                .from("telegram_message_queue")
                .update({ status: newStatus, error_message: data.description, processed_at: new Date().toISOString() })
                .eq("id", msg.id);
              failed++;
            }
          } catch (sendErr: unknown) {
            const errMsg = sendErr instanceof Error ? sendErr.message : "Unknown error";
            const newStatus = msg.attempts + 1 >= msg.max_attempts ? "failed" : "pending";
            await supabase
              .from("telegram_message_queue")
              .update({ status: newStatus, error_message: errMsg, processed_at: new Date().toISOString() })
              .eq("id", msg.id);
            failed++;
          }
        }
      }

      return json({ success: true, processed, failed });
    }

    // ── Disconnect bot ──
    if (action === "disconnect") {
      await supabase
        .from("telegram_bot_configs")
        .update({
          is_active: false,
          connection_status: "disconnected",
          bot_token_encrypted: null,
          bot_username: null,
        })
        .eq("tenant_id", tenant_id);

      return json({ success: true });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (err: unknown) {
    console.error("telegram-send error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return json({ success: false, error: message }, 500);
  }
});

async function getBotConfig(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await supabase
    .from("telegram_bot_configs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();
  return data;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
