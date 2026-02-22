/**
 * useCouponGovernance — Detects abusive coupons and excessive tenant discounts
 * via the governance-ai edge function (analyze_coupon_abuse action).
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AbusiveCoupon {
  coupon_code: string;
  reason: string;
  severity: 'warning' | 'critical';
  recommendation: string;
}

export interface ExcessiveDiscountTenant {
  tenant_id: string;
  tenant_name?: string;
  total_discount_brl: number;
  coupon_count: number;
  reason: string;
  severity: 'warning' | 'critical';
  recommendation: string;
}

export interface CouponAbuseAnalysis {
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  abusive_coupons: AbusiveCoupon[];
  excessive_discount_tenants: ExcessiveDiscountTenant[];
  recommendations: string[];
}

export function useCouponGovernance() {
  const [analysis, setAnalysis] = useState<CouponAbuseAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch coupon data in parallel
      const [couponsRes, redemptionsRes, entriesRes] = await Promise.all([
        supabase.from('coupons').select('*').eq('status', 'active'),
        supabase
          .from('coupon_redemptions')
          .select('*, coupons(code, name, discount_type, discount_value), tenants(name)')
          .order('redeemed_at', { ascending: false })
          .limit(200),
        supabase
          .from('platform_financial_entries')
          .select('*')
          .eq('entry_type', 'coupon_discount')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      // Build tenant summary from redemptions
      const tenantMap = new Map<string, { 
        tenant_id: string; 
        tenant_name: string; 
        total_discount: number; 
        coupon_count: number; 
        coupons_used: string[];
      }>();

      for (const r of redemptionsRes.data ?? []) {
        const tid = r.tenant_id;
        const existing: { tenant_id: string; tenant_name: string; total_discount: number; coupon_count: number; coupons_used: string[] } = tenantMap.get(tid) ?? {
          tenant_id: tid,
          tenant_name: (r as Record<string, unknown> & { tenants?: { name?: string } })?.tenants?.name ?? tid.slice(0, 8),
          total_discount: 0,
          coupon_count: 0,
          coupons_used: [] as string[],
        };
        existing.total_discount += Number(r.discount_applied_brl ?? 0);
        existing.coupon_count += 1;
        const code = (r as Record<string, unknown> & { coupons?: { code?: string } })?.coupons?.code;
        if (code && !existing.coupons_used.includes(code)) {
          existing.coupons_used.push(code);
        }
        tenantMap.set(tid, existing);
      }

      const couponData = {
        coupons: couponsRes.data ?? [],
        redemptions: (redemptionsRes.data ?? []).slice(0, 50),
        tenant_summary: Array.from(tenantMap.values()),
        financial_entries: (entriesRes.data ?? []).slice(0, 50),
      };

      const { data, error: fnError } = await supabase.functions.invoke('governance-ai', {
        body: { action: 'analyze_coupon_abuse', coupon_data: couponData },
      });

      if (fnError) throw new Error(fnError.message);

      const result = data?.analysis as CouponAbuseAnalysis;
      if (!result) throw new Error('No analysis returned');

      setAnalysis(result);

      if (result.risk_level === 'critical' || result.risk_level === 'high') {
        toast.warning(`Governança: ${result.abusive_coupons.length} cupom(ns) suspeito(s) detectado(s)`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro na análise';
      setError(msg);
      toast.error(`Erro na governança de cupons: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { analysis, loading, error, analyze };
}
