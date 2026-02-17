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
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    // Verify caller is platform user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!platformUser) {
      return new Response(JSON.stringify({ error: "Platform access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "30", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 50);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // ── Aggregate metrics per landing page ──
    const { data: events, error: eventsError } = await supabase
      .from("landing_metric_events")
      .select("landing_page_id, event_type, revenue_generated, visitor_id")
      .gte("tracked_at", since);

    if (eventsError) throw eventsError;

    // Build per-page aggregation
    const pageMap = new Map<string, {
      pageViews: number;
      ctaClicks: number;
      signupsCompleted: number;
      totalRevenue: number;
      uniqueVisitors: Set<string>;
    }>();

    for (const ev of events || []) {
      const lpId = ev.landing_page_id;
      if (!lpId) continue;

      let entry = pageMap.get(lpId);
      if (!entry) {
        entry = { pageViews: 0, ctaClicks: 0, signupsCompleted: 0, totalRevenue: 0, uniqueVisitors: new Set() };
        pageMap.set(lpId, entry);
      }

      if (ev.visitor_id) entry.uniqueVisitors.add(ev.visitor_id);

      switch (ev.event_type) {
        case "page_view":
          entry.pageViews++;
          break;
        case "cta_click":
          entry.ctaClicks++;
          break;
        case "signup_completed":
          entry.signupsCompleted++;
          break;
        case "revenue_generated":
          entry.totalRevenue += Number(ev.revenue_generated) || 0;
          break;
      }
    }

    // ── Fetch landing page names ──
    const pageIds = Array.from(pageMap.keys());
    let pageNames = new Map<string, string>();
    if (pageIds.length > 0) {
      const { data: pages } = await supabase
        .from("landing_pages")
        .select("id, name")
        .in("id", pageIds);
      for (const p of pages || []) {
        pageNames.set(p.id, p.name);
      }
    }

    // ── Compute KPIs per page ──
    interface PageRanking {
      landing_page_id: string;
      page_name: string;
      page_views: number;
      unique_visitors: number;
      signups_completed: number;
      cta_clicks: number;
      conversion_rate: number;   // %
      ctr: number;               // %
      total_revenue: number;
      revenue_per_visitor: number;
      roi_score: number;         // composite
    }

    const rankings: PageRanking[] = [];

    for (const [lpId, data] of pageMap) {
      const visitors = data.uniqueVisitors.size;
      const conversionRate = data.pageViews > 0
        ? Math.round((data.signupsCompleted / data.pageViews) * 10000) / 100
        : 0;
      const ctr = data.pageViews > 0
        ? Math.round((data.ctaClicks / data.pageViews) * 10000) / 100
        : 0;
      const revenuePerVisitor = visitors > 0
        ? Math.round((data.totalRevenue / visitors) * 100) / 100
        : 0;

      // ROI Score: weighted composite (conversion 35%, revenue 40%, engagement 25%)
      const convScore = Math.min(100, conversionRate * 10);
      const revScore = Math.min(100, revenuePerVisitor * 2);
      const engScore = Math.min(100, ctr * 5);
      const roiScore = Math.round(convScore * 0.35 + revScore * 0.40 + engScore * 0.25);

      rankings.push({
        landing_page_id: lpId,
        page_name: pageNames.get(lpId) || lpId,
        page_views: data.pageViews,
        unique_visitors: visitors,
        signups_completed: data.signupsCompleted,
        cta_clicks: data.ctaClicks,
        conversion_rate: conversionRate,
        ctr,
        total_revenue: Math.round(data.totalRevenue * 100) / 100,
        revenue_per_visitor: revenuePerVisitor,
        roi_score: roiScore,
      });
    }

    // ── Build ranked lists ──
    const topByConversion = [...rankings]
      .sort((a, b) => b.conversion_rate - a.conversion_rate)
      .slice(0, limit);

    const topByRevenue = [...rankings]
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, limit);

    const topByROI = [...rankings]
      .sort((a, b) => b.roi_score - a.roi_score)
      .slice(0, limit);

    return new Response(
      JSON.stringify({
        period_days: days,
        since,
        total_pages_analyzed: rankings.length,
        top_by_conversion: topByConversion,
        top_by_revenue: topByRevenue,
        top_by_roi: topByROI,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
