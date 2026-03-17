/**
 * Ad Delivery Service — Core engine for fetching, filtering, and serving ads.
 */
import { supabase } from '@/integrations/supabase/client';

export interface AdContext {
  placement: string;
  tenantId?: string;
  planName?: string;
  userRole?: string;
  country?: string;
  deviceType?: string;
  userId?: string;
  moduleKey?: string;
}

export interface AdCreative {
  id: string;
  campaign_id: string;
  campaign_name: string;
  type: 'banner' | 'popup' | 'widget' | 'modal';
  title: string;
  image_url: string | null;
  video_url: string | null;
  html_content: string | null;
  cta_text: string | null;
  cta_url: string | null;
  placement: string | null;
  priority: number;
}

interface CachedAds {
  ads: AdCreative[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;
const FREQUENCY_CAP_HOURS = 24;

function isWithinWindow(startsAt?: string | null, expiresAt?: string | null, now = new Date()): boolean {
  if (startsAt && new Date(startsAt) > now) return false;
  if (expiresAt && new Date(expiresAt) < now) return false;
  return true;
}

class AdDeliveryService {
  private cache = new Map<string, CachedAds>();

  async getAd(ctx: AdContext): Promise<AdCreative | null> {
    const ads = await this.getAdsForPlacement(ctx);
    if (ads.length === 0) return null;

    const filtered = ctx.userId
      ? await this.filterByFrequencyCap(ads, ctx.userId)
      : ads;

    if (filtered.length === 0) return null;

    return filtered.sort((a, b) => a.priority - b.priority)[0];
  }

  async getAdsForPlacement(ctx: AdContext): Promise<AdCreative[]> {
    const cacheKey = [
      ctx.placement,
      ctx.tenantId ?? '',
      ctx.planName ?? '',
      ctx.userRole ?? '',
      ctx.country ?? '',
      ctx.deviceType ?? '',
      ctx.moduleKey ?? '',
    ].join(':');
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.ads;
    }

    try {
      const now = new Date();
      const nowIso = now.toISOString();

      const { data: campaigns, error } = await supabase
        .from('ads_campaigns')
        .select(`
          id, name, priority, status, start_date, end_date,
          ads_creatives!inner (
            id, type, title, image_url, video_url, html_content,
            cta_text, cta_url, is_active, placement_id, starts_at, expires_at,
            ads_placements ( name, module_key, is_active )
          ),
          ads_targeting ( tenant_id, plan_name, user_role, country, device_type, exclude_premium, module_key )
        `)
        .eq('status', 'active')
        .lte('start_date', nowIso);

      if (error) {
        console.error('[AdDelivery] fetch error:', error);
        return [];
      }

      const results: AdCreative[] = [];

      for (const campaign of campaigns ?? []) {
        if (!isWithinWindow(campaign.start_date, campaign.end_date, now)) continue;

        const creatives = (campaign as any).ads_creatives ?? [];
        const targeting = (campaign as any).ads_targeting ?? [];

        for (const creative of creatives) {
          if (!creative.is_active) continue;
          if (!isWithinWindow(creative.starts_at, creative.expires_at, now)) continue;

          const placementName = creative.ads_placements?.name ?? null;
          const placementModuleKey = creative.ads_placements?.module_key ?? null;
          const placementIsActive = creative.ads_placements?.is_active ?? true;

          if (!placementIsActive) continue;
          if (placementName && placementName !== ctx.placement) continue;
          if (!placementName && ctx.placement) continue;
          if (placementModuleKey && placementModuleKey !== ctx.moduleKey) continue;
          if (!this.matchesTargeting(targeting, ctx)) continue;

          results.push({
            id: creative.id,
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            type: creative.type,
            title: creative.title,
            image_url: creative.image_url,
            video_url: creative.video_url,
            html_content: creative.html_content,
            cta_text: creative.cta_text,
            cta_url: creative.cta_url,
            placement: placementName,
            priority: campaign.priority,
          });
        }
      }

      this.cache.set(cacheKey, { ads: results, fetchedAt: Date.now() });
      return results;
    } catch (err) {
      console.error('[AdDelivery] unexpected error:', err);
      return [];
    }
  }

  private matchesTargeting(rules: any[], ctx: AdContext): boolean {
    if (rules.length === 0) return true;

    return rules.some(rule => {
      if (rule.exclude_premium && ctx.planName && ['enterprise', 'premium', 'professional'].includes(ctx.planName.toLowerCase())) {
        return false;
      }
      if (rule.tenant_id && rule.tenant_id !== ctx.tenantId) return false;
      if (rule.plan_name && rule.plan_name !== ctx.planName) return false;
      if (rule.user_role && rule.user_role !== ctx.userRole) return false;
      if (rule.country && rule.country !== ctx.country) return false;
      if (rule.device_type && rule.device_type !== ctx.deviceType) return false;
      if (rule.module_key && rule.module_key !== ctx.moduleKey) return false;
      return true;
    });
  }

  private async filterByFrequencyCap(ads: AdCreative[], userId: string): Promise<AdCreative[]> {
    const campaignIds = [...new Set(ads.map(a => a.campaign_id))];

    const { data: caps } = await supabase
      .from('ads_frequency_caps')
      .select('campaign_id, last_shown_at')
      .eq('user_id', userId)
      .in('campaign_id', campaignIds);

    const capMap = new Map<string, string>();
    (caps ?? []).forEach(c => capMap.set(c.campaign_id, c.last_shown_at));

    const cutoff = Date.now() - FREQUENCY_CAP_HOURS * 60 * 60 * 1000;

    return ads.filter(ad => {
      const lastShown = capMap.get(ad.campaign_id);
      if (!lastShown) return true;
      return new Date(lastShown).getTime() < cutoff;
    });
  }

  async recordImpression(creative: AdCreative, ctx: AdContext): Promise<void> {
    try {
      await supabase.from('ads_metrics').insert({
        campaign_id: creative.campaign_id,
        creative_id: creative.id,
        tenant_id: ctx.tenantId || null,
        user_id: ctx.userId || null,
        event_type: 'impression',
        placement: ctx.placement,
        metadata: ctx.moduleKey ? { module_key: ctx.moduleKey } : null,
      });

      if (ctx.userId) {
        await supabase.from('ads_frequency_caps').upsert({
          campaign_id: creative.campaign_id,
          user_id: ctx.userId,
          last_shown_at: new Date().toISOString(),
          show_count: 1,
        }, { onConflict: 'campaign_id,user_id' });
      }
    } catch (err) {
      console.error('[AdDelivery] impression error:', err);
    }
  }

  async recordClick(creative: AdCreative, ctx: AdContext): Promise<void> {
    try {
      await supabase.from('ads_metrics').insert({
        campaign_id: creative.campaign_id,
        creative_id: creative.id,
        tenant_id: ctx.tenantId || null,
        user_id: ctx.userId || null,
        event_type: 'click',
        placement: ctx.placement,
        metadata: ctx.moduleKey ? { module_key: ctx.moduleKey } : null,
      });
    } catch (err) {
      console.error('[AdDelivery] click error:', err);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const adDeliveryService = new AdDeliveryService();
