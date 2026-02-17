import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is platform super admin (using role_id → platform_roles join)
    const { data: callerPlatform } = await adminClient
      .from("platform_users")
      .select("role_id, platform_roles(slug)")
      .eq("user_id", caller.id)
      .eq("status", "active")
      .single();

    const callerSlug = (callerPlatform as any)?.platform_roles?.slug;
    if (!callerPlatform || callerSlug !== "platform_super_admin") {
      return new Response(JSON.stringify({ error: "Only super admins can manage platform users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password, display_name, role, role_id } = body;

      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email and password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve role_id if not provided (fallback from slug)
      let resolvedRoleId = role_id;
      let resolvedSlug = role || "platform_read_only";
      if (!resolvedRoleId) {
        const { data: roleData } = await adminClient
          .from("platform_roles")
          .select("id, slug")
          .eq("slug", resolvedSlug)
          .single();
        if (!roleData) {
          return new Response(JSON.stringify({ error: "Invalid role" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        resolvedRoleId = roleData.id;
      }

      // Create auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: display_name || email, user_type: "platform" },
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert into platform_users with both role (enum) and role_id (FK)
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
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: authData.user.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
