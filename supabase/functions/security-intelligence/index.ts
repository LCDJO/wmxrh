import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Haversine distance
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface RiskReason { rule: string; points: number; description: string; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const url = new URL(req.url);
    const path = url.pathname.replace('/security-intelligence', '');

    // POST /analyze-session
    if (req.method === 'POST' && path === '/analyze-session') {
      const { session_id } = await req.json();
      if (!session_id) {
        return new Response(JSON.stringify({ error: 'session_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: session, error: sessionError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch history
      const { data: history } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', session.user_id)
        .neq('id', session_id)
        .order('login_at', { ascending: false })
        .limit(50);

      const reasons: RiskReason[] = [];
      const h = history ?? [];

      // Rule 1: Impossible travel
      if (session.latitude && session.longitude && h.length > 0) {
        const recent = h.filter((s: any) => s.latitude && s.longitude)
          .sort((a: any, b: any) => new Date(b.login_at).getTime() - new Date(a.login_at).getTime());
        if (recent.length > 0) {
          const last = recent[0];
          const dist = haversineKm(session.latitude, session.longitude, last.latitude, last.longitude);
          const timeDiffMin = (new Date(session.login_at).getTime() - new Date(last.login_at).getTime()) / 60000;
          if (dist > 4000 && timeDiffMin > 0 && timeDiffMin < 60) {
            reasons.push({ rule: 'impossible_travel', points: 50, description: `Impossible travel: ${Math.round(dist)}km in ${Math.round(timeDiffMin)}min` });
          }
        }
      }

      // Rule 2: New country
      if (session.country) {
        const countries = new Set(h.map((s: any) => s.country).filter(Boolean));
        if (countries.size > 0 && !countries.has(session.country)) {
          reasons.push({ rule: 'new_country', points: 30, description: `New country: ${session.country}` });
        }
      }

      // Rule 3: New device
      if (session.device_fingerprint) {
        const fps = new Set(h.map((s: any) => s.device_fingerprint).filter(Boolean));
        if (fps.size > 0 && !fps.has(session.device_fingerprint)) {
          reasons.push({ rule: 'unknown_device', points: 20, description: 'Unknown device' });
        }
      }

      // Rule 4: VPN/Proxy
      if (session.is_vpn) reasons.push({ rule: 'vpn_detected', points: 30, description: 'VPN detected' });
      if (session.is_proxy) reasons.push({ rule: 'proxy_detected', points: 20, description: 'Proxy detected' });

      // Rule 5: Multiple sessions
      const { count } = await supabase
        .from('user_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user_id)
        .eq('status', 'online');
      if (count && count > 5) {
        reasons.push({ rule: 'too_many_sessions', points: 20, description: `${count} concurrent sessions` });
      }

      // Rule 6: Unusual time
      if (h.length >= 5) {
        const currentHour = new Date(session.login_at).getHours();
        const hours = h.map((s: any) => new Date(s.login_at).getHours());
        const mean = hours.reduce((a: number, b: number) => a + b, 0) / hours.length;
        const variance = hours.reduce((sum: number, hr: number) => sum + (hr - mean) ** 2, 0) / hours.length;
        const stdDev = Math.sqrt(variance);
        if (Math.abs(currentHour - mean) > Math.max(stdDev * 2, 4)) {
          reasons.push({ rule: 'unusual_login_time', points: 10, description: `Unusual time: ${currentHour}:00` });
        }
      }

      const risk_score = Math.min(100, reasons.reduce((sum, r) => sum + r.points, 0));
      const risk_level = risk_score >= 61 ? 'HIGH' : risk_score >= 31 ? 'MEDIUM' : 'LOW';

      // Store analysis
      await supabase.from('session_risk_analysis').insert({
        session_id, tenant_id: session.tenant_id, user_id: session.user_id,
        risk_score, risk_level, reasons,
      });

      // Create alert if needed
      if (risk_level === 'HIGH' || risk_level === 'MEDIUM') {
        await supabase.from('security_alerts').insert({
          tenant_id: session.tenant_id, user_id: session.user_id, session_id,
          alert_type: `${risk_level.toLowerCase()}_risk_login`, risk_score, risk_level,
          location: [session.city, session.country].filter(Boolean).join(', '),
          ip_address: session.ip_address,
          title: `${risk_level} risk login (score: ${risk_score})`,
          description: reasons.map((r: RiskReason) => r.description).join('; '),
          metadata: { reasons },
        });
      }

      // Auto action
      let auto_action = null;
      if (risk_score >= 60) {
        auto_action = 'block_session';
      }

      return new Response(JSON.stringify({ risk_score, risk_level, reasons, auto_action }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /alerts
    if (req.method === 'GET' && path === '/alerts') {
      const status = url.searchParams.get('status');
      let query = supabase.from('security_alerts').select('*').order('created_at', { ascending: false }).limit(200);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /risk-score/:session_id
    if (req.method === 'GET' && path.startsWith('/risk-score/')) {
      const sessionId = path.replace('/risk-score/', '');
      const { data, error } = await supabase
        .from('session_risk_analysis')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /block-session
    if (req.method === 'POST' && path === '/block-session') {
      const { session_id, reason } = await req.json();
      const { error } = await supabase.from('user_sessions').update({
        status: 'offline', blocked_at: new Date().toISOString(),
        blocked_reason: reason ?? 'Blocked via API', logout_at: new Date().toISOString(),
      }).eq('id', session_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /mark-device-trusted
    if (req.method === 'POST' && path === '/mark-device-trusted') {
      const { device_id, trusted, trusted_by } = await req.json();
      const { error } = await supabase.from('user_devices').update({
        trusted: trusted ?? true,
        trusted_at: trusted ? new Date().toISOString() : null,
        trusted_by: trusted ? trusted_by : null,
      }).eq('id', device_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Security Intelligence error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
