/**
 * useAdSlot — Hook to fetch and display an ad for a given placement.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { adDeliveryService, type AdCreative, type AdContext } from '@/domains/ads/ad-delivery-service';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

interface UseAdSlotOptions {
  placement?: string;
  planName?: string;
  userRole?: string;
  moduleKey?: string;
  enabled?: boolean;
}

export function useAdSlot({ placement, planName, userRole, moduleKey, enabled = true }: UseAdSlotOptions) {
  const [ad, setAd] = useState<AdCreative | null>(null);
  const [loading, setLoading] = useState(true);
  const impressionRecorded = useRef(false);
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const ctx: AdContext = {
    placement: placement ?? '',
    tenantId: currentTenant?.id,
    planName,
    userRole,
    userId: user?.id,
    moduleKey,
    deviceType: typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
  };

  useEffect(() => {
    if (!enabled || !placement) {
      setAd(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    impressionRecorded.current = false;

    adDeliveryService.getAd(ctx).then(result => {
      if (!mounted) return;
      setAd(result);
      setLoading(false);

      if (result && !impressionRecorded.current) {
        impressionRecorded.current = true;
        adDeliveryService.recordImpression(result, ctx);
      }
    });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement, enabled, currentTenant?.id, user?.id, moduleKey, planName, userRole]);

  const handleClick = useCallback(() => {
    if (!ad) return;
    adDeliveryService.recordClick(ad, ctx);
    if (ad.cta_url) {
      window.open(ad.cta_url, '_blank', 'noopener');
    }
  }, [ad, ctx]);

  return { ad, loading, handleClick };
}
