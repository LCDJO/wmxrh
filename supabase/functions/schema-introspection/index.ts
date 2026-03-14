import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is authenticated
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify platform user role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: platformUser } = await adminClient
      .from("platform_users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!platformUser || !["platform_super_admin", "platform_operations", "platform_architect"].includes(platformUser.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: platform admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tables
    const { data: tables, error: tablesErr } = await adminClient.rpc("get_schema_tables");
    if (tablesErr) {
      // Fallback: query information_schema directly
      const { data: rawTables } = await adminClient
        .from("information_schema.tables" as any)
        .select("table_name, table_type")
        .eq("table_schema", "public");
    }

    // Use raw SQL via service role for schema introspection
    const { data: schemaData, error: schemaErr } = await adminClient.rpc("introspect_public_schema");

    if (schemaErr) {
      return new Response(JSON.stringify({ error: "Schema introspection failed", details: schemaErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(schemaData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
