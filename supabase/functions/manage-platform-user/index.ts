import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is a platform super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const { data: callerPlatform } = await adminClient
      .from("platform_users")
      .select("role_id, platform_roles(slug)")
      .eq("user_id", caller.id)
      .eq("status", "active")
      .single();

    const callerSlug = (callerPlatform as any)?.platform_roles?.slug;
    if (!callerPlatform || callerSlug !== "platform_super_admin") {
      return jsonResponse({ error: "Only super admins can manage platform users" }, 403);
    }

    const body = await req.json();
    const { action } = body;

    // ── CREATE ──
    if (action === "create") {
      const { email, password, display_name, role, role_id } = body;
      if (!email || !password) {
        return jsonResponse({ error: "Email and password required" }, 400);
      }

      let resolvedRoleId = role_id;
      let resolvedSlug = role || "platform_read_only";
      if (!resolvedRoleId) {
        const { data: roleData } = await adminClient
          .from("platform_roles")
          .select("id, slug")
          .eq("slug", resolvedSlug)
          .single();
        if (!roleData) return jsonResponse({ error: "Invalid role" }, 400);
        resolvedRoleId = roleData.id;
      }

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: display_name || email, user_type: "platform" },
      });

      if (authError) return jsonResponse({ error: authError.message }, 400);

      const { error: insertError } = await adminClient
        .from("platform_users")
        .insert({
          user_id: authData.user.id,
          email,
          display_name: display_name || null,
          role: resolvedSlug,
          role_id: resolvedRoleId,
          status: "active",
        });

      if (insertError) {
        await adminClient.auth.admin.deleteUser(authData.user.id);
        return jsonResponse({ error: insertError.message }, 400);
      }

      return jsonResponse({ success: true, user_id: authData.user.id });
    }

    // ── UPDATE ──
    if (action === "update") {
      const { platform_user_id, display_name, role_id, status } = body;
      if (!platform_user_id) return jsonResponse({ error: "platform_user_id required" }, 400);

      // Fetch current user
      const { data: targetUser, error: fetchErr } = await adminClient
        .from("platform_users")
        .select("id, user_id, role_id, status")
        .eq("id", platform_user_id)
        .single();

      if (fetchErr || !targetUser) return jsonResponse({ error: "User not found" }, 404);

      // Prevent self-demotion
      if (targetUser.user_id === caller.id && role_id && role_id !== targetUser.role_id) {
        return jsonResponse({ error: "Cannot change your own role" }, 400);
      }

      const updates: Record<string, unknown> = {};
      if (display_name !== undefined) updates.display_name = display_name;
      if (status !== undefined) updates.status = status;

      if (role_id && role_id !== targetUser.role_id) {
        const { data: roleData } = await adminClient
          .from("platform_roles")
          .select("id, slug")
          .eq("id", role_id)
          .single();
        if (!roleData) return jsonResponse({ error: "Invalid role_id" }, 400);
        updates.role_id = role_id;
        updates.role = roleData.slug;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await adminClient
          .from("platform_users")
          .update(updates)
          .eq("id", platform_user_id);
        if (updateErr) return jsonResponse({ error: updateErr.message }, 400);
      }

      // Update auth user metadata if display_name changed
      if (display_name !== undefined) {
        await adminClient.auth.admin.updateUserById(targetUser.user_id, {
          user_metadata: { display_name },
        });
      }

      return jsonResponse({ success: true });
    }

    // ── DELETE ──
    if (action === "delete") {
      const { platform_user_id } = body;
      if (!platform_user_id) return jsonResponse({ error: "platform_user_id required" }, 400);

      const { data: targetUser, error: fetchErr } = await adminClient
        .from("platform_users")
        .select("id, user_id")
        .eq("id", platform_user_id)
        .single();

      if (fetchErr || !targetUser) return jsonResponse({ error: "User not found" }, 404);

      if (targetUser.user_id === caller.id) {
        return jsonResponse({ error: "Cannot delete yourself" }, 400);
      }

      // Remove platform_users row
      const { error: deleteErr } = await adminClient
        .from("platform_users")
        .delete()
        .eq("id", platform_user_id);

      if (deleteErr) return jsonResponse({ error: deleteErr.message }, 400);

      // Also delete auth user
      await adminClient.auth.admin.deleteUser(targetUser.user_id);

      return jsonResponse({ success: true });
    }

    // ── NOTIFY ──
    if (action === "notify") {
      const { platform_user_id, subject, message } = body;
      if (!platform_user_id || !message) {
        return jsonResponse({ error: "platform_user_id and message required" }, 400);
      }

      const { data: targetUser } = await adminClient
        .from("platform_users")
        .select("email, display_name")
        .eq("id", platform_user_id)
        .single();

      if (!targetUser) return jsonResponse({ error: "User not found" }, 404);

      // Store notification in platform_notifications table (best-effort)
      await adminClient.from("platform_notifications").insert({
        user_email: targetUser.email,
        subject: subject || "Notificação da Plataforma",
        message,
        sent_by: caller.id,
        created_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {});

      return jsonResponse({ success: true, sent_to: targetUser.email });
    }

    // ── RESET PASSWORD ──
    if (action === "reset_password") {
      const { platform_user_id, new_password } = body;
      if (!platform_user_id || !new_password) {
        return jsonResponse({ error: "platform_user_id and new_password required" }, 400);
      }

      const { data: targetUser } = await adminClient
        .from("platform_users")
        .select("user_id")
        .eq("id", platform_user_id)
        .single();

      if (!targetUser) return jsonResponse({ error: "User not found" }, 404);

      const { error: pwErr } = await adminClient.auth.admin.updateUserById(
        targetUser.user_id,
        { password: new_password }
      );

      if (pwErr) return jsonResponse({ error: pwErr.message }, 400);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});
