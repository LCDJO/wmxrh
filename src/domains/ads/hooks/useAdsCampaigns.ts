/**
 * useAdsCampaigns — Hook for managing ads campaigns, creatives, targeting, and metrics.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdsCampaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string | null;
  priority: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creatives_count?: number;
  impressions?: number;
  clicks?: number;
}

export interface AdsCreative {
  id: string;
  campaign_id: string;
  placement_id: string | null;
  type: string;
  title: string;
  image_url: string | null;
  video_url: string | null;
  html_content: string | null;
  cta_text: string | null;
  cta_url: string | null;
  is_active: boolean;
  created_at: string;
  placement_name?: string;
}

export interface AdsTargeting {
  id: string;
  campaign_id: string;
  tenant_id: string | null;
  plan_name: string | null;
  user_role: string | null;
  country: string | null;
  device_type: string | null;
  exclude_premium: boolean;
}

export interface AdsPlacement {
  id: string;
  name: string;
  label: string;
  is_active: boolean;
}

export interface AdsMetricsSummary {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
}

export function useAdsCampaigns() {
  const [campaigns, setCampaigns] = useState<AdsCampaign[]>([]);
  const [placements, setPlacements] = useState<AdsPlacement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ads_campaigns')
        .select('*')
        .order('priority', { ascending: true });

      if (error) throw error;

      // Get metrics counts
      const { data: metrics } = await supabase
        .from('ads_metrics')
        .select('campaign_id, event_type');

      const { data: creatives } = await supabase
        .from('ads_creatives')
        .select('campaign_id');

      const metricsMap = new Map<string, { impressions: number; clicks: number }>();
      const creativesMap = new Map<string, number>();

      (metrics ?? []).forEach(m => {
        const entry = metricsMap.get(m.campaign_id) ?? { impressions: 0, clicks: 0 };
        if (m.event_type === 'impression') entry.impressions++;
        else if (m.event_type === 'click') entry.clicks++;
        metricsMap.set(m.campaign_id, entry);
      });

      (creatives ?? []).forEach(c => {
        creativesMap.set(c.campaign_id, (creativesMap.get(c.campaign_id) ?? 0) + 1);
      });

      const enriched = (data ?? []).map(c => ({
        ...c,
        creatives_count: creativesMap.get(c.id) ?? 0,
        impressions: metricsMap.get(c.id)?.impressions ?? 0,
        clicks: metricsMap.get(c.id)?.clicks ?? 0,
      }));

      setCampaigns(enriched);
    } catch (err) {
      console.error('[useAdsCampaigns] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlacements = useCallback(async () => {
    const { data } = await supabase
      .from('ads_placements')
      .select('*')
      .order('name');
    setPlacements(data ?? []);
  }, []);

  useEffect(() => {
    fetchCampaigns();
    fetchPlacements();
  }, [fetchCampaigns, fetchPlacements]);

  const createCampaign = useCallback(async (campaign: Partial<AdsCampaign>) => {
    const { error } = await supabase.from('ads_campaigns').insert({
      name: campaign.name!,
      description: campaign.description,
      status: campaign.status ?? 'active',
      start_date: campaign.start_date ?? new Date().toISOString(),
      end_date: campaign.end_date,
      priority: campaign.priority ?? 10,
    });
    if (error) throw error;
    await fetchCampaigns();
  }, [fetchCampaigns]);

  const updateCampaign = useCallback(async (id: string, updates: Partial<AdsCampaign>) => {
    const { error } = await supabase
      .from('ads_campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await fetchCampaigns();
  }, [fetchCampaigns]);

  const toggleCampaignStatus = useCallback(async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await updateCampaign(id, { status: newStatus });
  }, [updateCampaign]);

  return {
    campaigns,
    placements,
    loading,
    refresh: fetchCampaigns,
    createCampaign,
    updateCampaign,
    toggleCampaignStatus,
  };
}

export function useAdsCreatives(campaignId: string | null) {
  const [creatives, setCreatives] = useState<AdsCreative[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ads_creatives')
        .select('*, ads_placements(name)')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCreatives((data ?? []).map((c: any) => ({
        ...c,
        placement_name: c.ads_placements?.name ?? null,
      })));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createCreative = useCallback(async (creative: Partial<AdsCreative>) => {
    const { error } = await supabase.from('ads_creatives').insert({
      campaign_id: campaignId!,
      placement_id: creative.placement_id,
      type: creative.type ?? 'banner',
      title: creative.title!,
      image_url: creative.image_url,
      html_content: creative.html_content,
      cta_text: creative.cta_text,
      cta_url: creative.cta_url,
    });
    if (error) throw error;
    await fetch();
  }, [campaignId, fetch]);

  return { creatives, loading, refresh: fetch, createCreative };
}

export function useAdsTargeting(campaignId: string | null) {
  const [rules, setRules] = useState<AdsTargeting[]>([]);

  const fetch = useCallback(async () => {
    if (!campaignId) return;
    const { data } = await supabase
      .from('ads_targeting')
      .select('*')
      .eq('campaign_id', campaignId);
    setRules(data ?? []);
  }, [campaignId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addRule = useCallback(async (rule: Partial<AdsTargeting>) => {
    const { error } = await supabase.from('ads_targeting').insert({
      campaign_id: campaignId!,
      tenant_id: rule.tenant_id,
      plan_name: rule.plan_name,
      user_role: rule.user_role,
      country: rule.country,
      device_type: rule.device_type,
      exclude_premium: rule.exclude_premium ?? false,
    });
    if (error) throw error;
    await fetch();
  }, [campaignId, fetch]);

  const removeRule = useCallback(async (ruleId: string) => {
    await supabase.from('ads_targeting').delete().eq('id', ruleId);
    await fetch();
  }, [fetch]);

  return { rules, refresh: fetch, addRule, removeRule };
}

export function useAdsMetrics() {
  const [summary, setSummary] = useState<AdsMetricsSummary[]>([]);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: metrics } = await supabase
        .from('ads_metrics')
        .select('campaign_id, event_type, created_at');

      const { data: campaigns } = await supabase
        .from('ads_campaigns')
        .select('id, name');

      const campaignNames = new Map<string, string>();
      (campaigns ?? []).forEach(c => campaignNames.set(c.id, c.name));

      // Summary by campaign
      const sumMap = new Map<string, { impressions: number; clicks: number }>();
      const dailyMap = new Map<string, { impressions: number; clicks: number }>();

      (metrics ?? []).forEach(m => {
        // Campaign summary
        const entry = sumMap.get(m.campaign_id) ?? { impressions: 0, clicks: 0 };
        if (m.event_type === 'impression') entry.impressions++;
        else entry.clicks++;
        sumMap.set(m.campaign_id, entry);

        // Daily
        const day = m.created_at.slice(0, 10);
        const dayEntry = dailyMap.get(day) ?? { impressions: 0, clicks: 0 };
        if (m.event_type === 'impression') dayEntry.impressions++;
        else dayEntry.clicks++;
        dailyMap.set(day, dayEntry);
      });

      setSummary(
        Array.from(sumMap.entries()).map(([id, s]) => ({
          campaign_id: id,
          campaign_name: campaignNames.get(id) ?? id.slice(0, 8),
          impressions: s.impressions,
          clicks: s.clicks,
          ctr: s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0,
        })).sort((a, b) => b.impressions - a.impressions)
      );

      setDaily(
        Array.from(dailyMap.entries())
          .map(([date, d]) => ({ date, ...d }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-30)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { summary, daily, loading, refresh: fetch };
}
