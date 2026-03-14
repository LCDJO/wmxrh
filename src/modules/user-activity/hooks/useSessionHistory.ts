/**
 * useSessionHistory — Hook for session_history queries.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SessionHistoryRecord {
  id: string;
  tenant_id: string | null;
  user_id: string;
  session_id: string;
  login_at: string;
  logout_at: string;
  duration_seconds: number | null;
  ip_address: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  device_type: string | null;
  device_fingerprint: string | null;
  login_method: string | null;
  is_vpn: boolean;
  is_proxy: boolean;
  asn_name: string | null;
  risk_score: number;
  logout_reason: string;
  created_at: string;
}

export function useSessionHistory(userId?: string, limit = 50) {
  const [history, setHistory] = useState<SessionHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('session_history')
        .select('*')
        .order('logout_at', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setHistory((data ?? []) as SessionHistoryRecord[]);
    } catch (err) {
      console.error('[useSessionHistory] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

  useEffect(() => { fetch(); }, [fetch]);

  return { history, loading, refresh: fetch };
}
