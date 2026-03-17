import { useState, useEffect, useCallback } from 'react';
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
  updated_at?: string;
  placement_name?: string | null;
  placement_label?: string | null;
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
  module_key?: string | null;
}

export interface AdsPlacement {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  is_active: boolean;
  slot_id?: string | null;
  location_type?: string | null;
  module_key?: string | null;
}

export interface AdsMetricsSummary {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface AdsSlotMetric {
  slot_name: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface AdsCreativeMetric {
  creative_id: string;
  creative_title: string;
  campaign_id: string;
  campaign_name: string;
  placement_name: string | null;
  placement_label: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface AdsMetricsOverview {
  impressions: number;
  clicks: number;
  ctr: number;
  previousImpressions: number;
  previousClicks: number;
  previousCtr: number;
}

export interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
}

type MetricRow = {
  campaign_id: string;
  creative_id: string | null;
  event_type: string;
  created_at: string;
  placement: string | null;
};

function aggregateMetrics(rows: MetricRow[]) {
  const campaignMap = new Map<string, { impressions: number; clicks: number }>();
  const dailyMap = new Map<string, { impressions: number; clicks: number }>();
  const slotMap = new Map<string, { impressions: number; clicks: number }>();
  const creativeMap = new Map<string, { impressions: number; clicks: number; placement: string | null }>();

  let impressions = 0;
  let clicks = 0;

  rows.forEach((row) => {
    const isImpression = row.event_type === 'impression';
    const day = row.created_at.slice(0, 10);
    const slotName = row.placement ?? 'sem_slot';

    const campaignEntry = campaignMap.get(row.campaign_id) ?? { impressions: 0, clicks: 0 };
    const dailyEntry = dailyMap.get(day) ?? { impressions: 0, clicks: 0 };
    const slotEntry = slotMap.get(slotName) ?? { impressions: 0, clicks: 0 };

    if (isImpression) {
      campaignEntry.impressions += 1;
      dailyEntry.impressions += 1;
      slotEntry.impressions += 1;
      impressions += 1;
    } else {
      campaignEntry.clicks += 1;
      dailyEntry.clicks += 1;
      slotEntry.clicks += 1;
      clicks += 1;
    }

    campaignMap.set(row.campaign_id, campaignEntry);
    dailyMap.set(day, dailyEntry);
    slotMap.set(slotName, slotEntry);

    if (row.creative_id) {
      const creativeEntry = creativeMap.get(row.creative_id) ?? {
        impressions: 0,
        clicks: 0,
        placement: row.placement,
      };

      if (isImpression) creativeEntry.impressions += 1;
      else creativeEntry.clicks += 1;

      if (!creativeEntry.placement && row.placement) {
        creativeEntry.placement = row.placement;
      }

      creativeMap.set(row.creative_id, creativeEntry);
    }
  });

  return { campaignMap, dailyMap, slotMap, creativeMap, impressions, clicks };
}

export function useAdsCampaigns() {
  const [campaigns, setCampaigns] = useState<AdsCampaign[]>([]);
  const [placements, setPlacements] = useState<AdsPlacement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data, error }, { data: metrics }, { data: creatives }] = await Promise.all([
        supabase.from('ads_campaigns').select('*').order('priority', { ascending: true }),
        supabase.from('ads_metrics').select('campaign_id, event_type'),
        supabase.from('ads_creatives').select('campaign_id'),
      ]);

      if (error) throw error;

      const metricsMap = new Map<string, { impressions: number; clicks: number }>();
      const creativesMap = new Map<string, number>();

      (metrics ?? []).forEach((metric) => {
        const entry = metricsMap.get(metric.campaign_id) ?? { impressions: 0, clicks: 0 };
        if (metric.event_type === 'impression') entry.impressions += 1;
        else if (metric.event_type === 'click') entry.clicks += 1;
        metricsMap.set(metric.campaign_id, entry);
      });

      (creatives ?? []).forEach((creative) => {
        creativesMap.set(creative.campaign_id, (creativesMap.get(creative.campaign_id) ?? 0) + 1);
      });

      setCampaigns(
        (data ?? []).map((campaign) => ({
          ...campaign,
          creatives_count: creativesMap.get(campaign.id) ?? 0,
          impressions: metricsMap.get(campaign.id)?.impressions ?? 0,
          clicks: metricsMap.get(campaign.id)?.clicks ?? 0,
        })),
      );
    } catch (err) {
      console.error('[useAdsCampaigns] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlacements = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('ads_placements').select('*').order('name');
      if (error) throw error;
      setPlacements((data ?? []) as AdsPlacement[]);
    } catch (err) {
      console.error('[useAdsCampaigns] placements error:', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchCampaigns(), fetchPlacements()]);
  }, [fetchCampaigns, fetchPlacements]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const deleteCampaign = useCallback(async (id: string) => {
    const { error } = await supabase.from('ads_campaigns').delete().eq('id', id);
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
    refresh,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    toggleCampaignStatus,
  };
}

export function useAdsCreatives(campaignId: string | null = null) {
  const [creatives, setCreatives] = useState<AdsCreative[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ads_creatives')
        .select('*, ads_placements(name, label)')
        .order('created_at', { ascending: false });

      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setCreatives(
        (data ?? []).map((creative: any) => ({
          ...creative,
          placement_name: creative.ads_placements?.name ?? null,
          placement_label: creative.ads_placements?.label ?? null,
        })),
      );
    } catch (err) {
      console.error('[useAdsCreatives] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const createCreative = useCallback(async (creative: Partial<AdsCreative>) => {
    const resolvedCampaignId = creative.campaign_id ?? campaignId;
    if (!resolvedCampaignId) {
      throw new Error('campaign_id is required');
    }

    const { error } = await supabase.from('ads_creatives').insert({
      campaign_id: resolvedCampaignId,
      placement_id: creative.placement_id,
      type: creative.type ?? 'banner',
      title: creative.title!,
      image_url: creative.image_url,
      video_url: creative.video_url,
      html_content: creative.html_content,
      cta_text: creative.cta_text,
      cta_url: creative.cta_url,
      is_active: creative.is_active ?? true,
    });
    if (error) throw error;
    await fetch();
  }, [campaignId, fetch]);

  const updateCreative = useCallback(async (id: string, updates: Partial<AdsCreative>) => {
    const { error } = await supabase
      .from('ads_creatives')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await fetch();
  }, [fetch]);

  const deleteCreative = useCallback(async (id: string) => {
    const { error } = await supabase.from('ads_creatives').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  }, [fetch]);

  const toggleCreativeStatus = useCallback(async (id: string, currentStatus: boolean) => {
    await updateCreative(id, { is_active: !currentStatus });
  }, [updateCreative]);

  return {
    creatives,
    loading,
    refresh: fetch,
    createCreative,
    updateCreative,
    deleteCreative,
    toggleCreativeStatus,
  };
}

export function useAdsTargeting(campaignId: string | null) {
  const [rules, setRules] = useState<AdsTargeting[]>([]);

  const fetch = useCallback(async () => {
    if (!campaignId) {
      setRules([]);
      return;
    }

    const { data } = await supabase.from('ads_targeting').select('*').eq('campaign_id', campaignId);
    setRules((data ?? []) as AdsTargeting[]);
  }, [campaignId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const addRule = useCallback(async (rule: Partial<AdsTargeting>) => {
    const { error } = await supabase.from('ads_targeting').insert({
      campaign_id: campaignId!,
      tenant_id: rule.tenant_id,
      plan_name: rule.plan_name,
      user_role: rule.user_role,
      country: rule.country,
      device_type: rule.device_type,
      exclude_premium: rule.exclude_premium ?? false,
      module_key: rule.module_key,
    });
    if (error) throw error;
    await fetch();
  }, [campaignId, fetch]);

  const removeRule = useCallback(async (ruleId: string) => {
    const { error } = await supabase.from('ads_targeting').delete().eq('id', ruleId);
    if (error) throw error;
    await fetch();
  }, [fetch]);

  return { rules, refresh: fetch, addRule, removeRule };
}

export function useAdsMetrics(periodDays = 30) {
  const [overview, setOverview] = useState<AdsMetricsOverview>({
    impressions: 0,
    clicks: 0,
    ctr: 0,
    previousImpressions: 0,
    previousClicks: 0,
    previousCtr: 0,
  });
  const [summary, setSummary] = useState<AdsMetricsSummary[]>([]);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [bySlot, setBySlot] = useState<AdsSlotMetric[]>([]);
  const [creativeMetrics, setCreativeMetrics] = useState<AdsCreativeMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentSince = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString();
      const previousSince = new Date(now.getTime() - periodDays * 2 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: metrics }, { data: campaigns }, { data: creatives }] = await Promise.all([
        supabase
          .from('ads_metrics')
          .select('campaign_id, creative_id, event_type, created_at, placement')
          .gte('created_at', previousSince),
        supabase.from('ads_campaigns').select('id, name'),
        supabase.from('ads_creatives').select('id, title, campaign_id, placement_id, ads_placements(name, label)'),
      ]);

      const campaignNames = new Map<string, string>();
      (campaigns ?? []).forEach((campaign) => campaignNames.set(campaign.id, campaign.name));

      const creativeLookup = new Map<string, {
        title: string;
        campaign_id: string;
        campaign_name: string;
        placement_name: string | null;
        placement_label: string | null;
      }>();

      (creatives ?? []).forEach((creative: any) => {
        creativeLookup.set(creative.id, {
          title: creative.title,
          campaign_id: creative.campaign_id,
          campaign_name: campaignNames.get(creative.campaign_id) ?? 'Sem campanha',
          placement_name: creative.ads_placements?.name ?? null,
          placement_label: creative.ads_placements?.label ?? null,
        });
      });

      const rows = (metrics ?? []) as MetricRow[];
      const currentRows = rows.filter((row) => row.created_at >= currentSince);
      const previousRows = rows.filter((row) => row.created_at < currentSince);

      const currentAgg = aggregateMetrics(currentRows);
      const previousAgg = aggregateMetrics(previousRows);

      setOverview({
        impressions: currentAgg.impressions,
        clicks: currentAgg.clicks,
        ctr: currentAgg.impressions > 0 ? (currentAgg.clicks / currentAgg.impressions) * 100 : 0,
        previousImpressions: previousAgg.impressions,
        previousClicks: previousAgg.clicks,
        previousCtr: previousAgg.impressions > 0 ? (previousAgg.clicks / previousAgg.impressions) * 100 : 0,
      });

      setSummary(
        Array.from(currentAgg.campaignMap.entries())
          .map(([campaignId, values]) => ({
            campaign_id: campaignId,
            campaign_name: campaignNames.get(campaignId) ?? campaignId.slice(0, 8),
            impressions: values.impressions,
            clicks: values.clicks,
            ctr: values.impressions > 0 ? (values.clicks / values.impressions) * 100 : 0,
          }))
          .sort((a, b) => b.impressions - a.impressions),
      );

      const generatedDays = Array.from({ length: periodDays }, (_, index) => {
        const date = new Date(now.getTime() - (periodDays - index - 1) * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        const values = currentAgg.dailyMap.get(date) ?? { impressions: 0, clicks: 0 };
        return { date, ...values };
      });
      setDaily(generatedDays);

      setBySlot(
        Array.from(currentAgg.slotMap.entries())
          .map(([slotName, values]) => ({
            slot_name: slotName,
            impressions: values.impressions,
            clicks: values.clicks,
            ctr: values.impressions > 0 ? (values.clicks / values.impressions) * 100 : 0,
          }))
          .sort((a, b) => b.impressions - a.impressions),
      );

      setCreativeMetrics(
        Array.from(currentAgg.creativeMap.entries())
          .map(([creativeId, values]) => {
            const lookup = creativeLookup.get(creativeId);
            const placementName = values.placement ?? lookup?.placement_name ?? null;
            return {
              creative_id: creativeId,
              creative_title: lookup?.title ?? creativeId.slice(0, 8),
              campaign_id: lookup?.campaign_id ?? '',
              campaign_name: lookup?.campaign_name ?? 'Sem campanha',
              placement_name: placementName,
              placement_label: lookup?.placement_label ?? null,
              impressions: values.impressions,
              clicks: values.clicks,
              ctr: values.impressions > 0 ? (values.clicks / values.impressions) * 100 : 0,
            };
          })
          .sort((a, b) => b.impressions - a.impressions),
      );
    } catch (err) {
      console.error('[useAdsMetrics] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { overview, summary, daily, bySlot, creativeMetrics, loading, refresh: fetch };
}
