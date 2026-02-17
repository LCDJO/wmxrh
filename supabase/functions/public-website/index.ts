// deno-lint-ignore-file

/**
 * public-website — Dedicated edge function for the institutional website.
 *
 * SECURITY:
 *  - Isolated from all platform/tenant/IAM APIs
 *  - Only serves published website content
 *  - Validates X-Website-Token header
 *  - Read-only: no mutations
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-website-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate token header
    const tokenHeader = req.headers.get("x-website-token");
    if (!tokenHeader) {
      return new Response(
        JSON.stringify({ error: "Missing website token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let tokenData: { fingerprint: string; expiresAt: number; type: string };
    try {
      tokenData = JSON.parse(tokenHeader);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid token format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (tokenData.type !== "website_public" || Date.now() > tokenData.expiresAt) {
      return new Response(
        JSON.stringify({ error: "Token expired or invalid type" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { endpoint, params } = body;

    // Create a read-only Supabase client (service role for read access to published content)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let data: unknown = null;

    switch (endpoint) {
      case "website-page": {
        const slug = params?.slug;
        if (!slug) {
          return new Response(
            JSON.stringify({ error: "Missing slug parameter" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Only return published pages — never drafts/submitted/approved
        const { data: page, error } = await supabase
          .from("landing_pages")
          .select("id, name, slug, content, seo_config, published_at, updated_at")
          .eq("slug", slug)
          .eq("status", "published")
          .eq("page_type", "website")
          .single();

        if (error || !page) {
          return new Response(
            JSON.stringify({ error: "Page not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        data = page;
        break;
      }

      case "website-structure": {
        // Return published website pages for navigation
        const { data: pages } = await supabase
          .from("landing_pages")
          .select("id, name, slug, parent_slug, sort_order")
          .eq("status", "published")
          .eq("page_type", "website")
          .order("sort_order", { ascending: true });

        data = pages ?? [];
        break;
      }

      case "website-seo": {
        const slug = params?.slug;
        if (!slug) {
          return new Response(
            JSON.stringify({ error: "Missing slug parameter" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const { data: seo } = await supabase
          .from("landing_pages")
          .select("slug, name, seo_config")
          .eq("slug", slug)
          .eq("status", "published")
          .eq("page_type", "website")
          .single();

        data = seo ?? null;
        break;
      }

      case "sitemap": {
        const { data: pages } = await supabase
          .from("landing_pages")
          .select("slug, updated_at")
          .eq("status", "published")
          .eq("page_type", "website")
          .order("sort_order", { ascending: true });

        data = (pages ?? []).map((p: { slug: string; updated_at: string }) => ({
          slug: p.slug,
          lastmod: p.updated_at,
        }));
        break;
      }

      case "robots": {
        data = {
          rules: [
            { userAgent: "*", allow: ["/"], disallow: ["/platform", "/admin", "/auth", "/api"] },
          ],
        };
        break;
      }

      case "health": {
        data = { status: "ok", timestamp: new Date().toISOString() };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown endpoint" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
