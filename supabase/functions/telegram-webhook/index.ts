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
    // Extract tenant_id from URL query params
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");
    const secret = url.searchParams.get("secret");

    if (!tenantId) {
      return new Response("Missing tenant_id", { status: 400 });
    }

    // Verify webhook secret
    const { data: config } = await supabase
      .from("telegram_bot_configs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (!config) {
      return new Response("Bot not configured", { status: 404 });
    }

    if (secret && config.webhook_secret !== secret) {
      return new Response("Invalid secret", { status: 403 });
    }

    const update = await req.json();

    // Extract message info
    const message = update.message || update.edited_message;
    if (!message) {
      return new Response("OK", { status: 200 });
    }

    const chatId = String(message.chat.id);
    const fromUsername = message.from?.username || message.from?.first_name || "unknown";
    const text = message.text || "";
    const command = text.startsWith("/") ? text.split(" ")[0].split("@")[0] : null;

    // Log the webhook
    await supabase.from("telegram_webhook_logs").insert({
      tenant_id: tenantId,
      update_id: update.update_id,
      chat_id: chatId,
      from_username: fromUsername,
      command,
      message_text: text,
      raw_payload: update,
      processed: true,
    });

    // Handle commands
    let responseText: string | null = null;

    switch (command) {
      case "/start":
        responseText = `🤖 Olá! Sou o bot de RH.\n\nSeu Chat ID é: <code>${chatId}</code>\n\nUse este ID para configurar notificações.`;
        break;
      case "/help":
        responseText = "📋 <b>Comandos disponíveis:</b>\n\n/start - Iniciar e obter Chat ID\n/status - Status do sistema\n/help - Ajuda";
        break;
      case "/status":
        responseText = "✅ Sistema operacional.\n📡 Integração ativa.";
        break;
      default:
        if (command) {
          responseText = `❓ Comando <code>${command}</code> não reconhecido.\nUse /help para ver os comandos disponíveis.`;
        }
        break;
    }

    // Send response if applicable
    if (responseText && config.bot_token) {
      await fetch(`${TELEGRAM_API}${config.bot_token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: "HTML",
        }),
      });

      // Update log with response
      await supabase
        .from("telegram_webhook_logs")
        .update({ response_sent: responseText })
        .eq("update_id", update.update_id)
        .eq("tenant_id", tenantId);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (err: unknown) {
    console.error("telegram-webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
