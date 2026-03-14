/**
 * useSecurityAlerts — Hook for security_alerts table with realtime.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SecurityAlertRecord {
  id: string;
  tenant_id: string | null;
  user_id: string;
  session_id: string | null;
  alert_type: string;
  risk_score: number;
  risk_level: string;
  location: string | null;
  ip_address: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  status: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  auto_action_taken: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  false_positive: number;
  high_risk: number;
  medium_risk: number;
  today: number;
}

export function useSecurityAlerts() {
  const [alerts, setAlerts] = useState<SecurityAlertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('security_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setAlerts((data as unknown as SecurityAlertRecord[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
    const channel = supabase
      .channel('security-alerts-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_alerts' }, fetchAlerts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAlerts]);

  const stats: AlertStats = (() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: alerts.length,
      open: alerts.filter(a => a.status === 'open').length,
      investigating: alerts.filter(a => a.status === 'investigating').length,
      resolved: alerts.filter(a => a.status === 'resolved').length,
      false_positive: alerts.filter(a => a.status === 'false_positive').length,
      high_risk: alerts.filter(a => a.risk_level === 'HIGH').length,
      medium_risk: alerts.filter(a => a.risk_level === 'MEDIUM').length,
      today: alerts.filter(a => a.created_at.slice(0, 10) === today).length,
    };
  })();

  return { alerts, stats, loading, refresh: fetchAlerts };
}
