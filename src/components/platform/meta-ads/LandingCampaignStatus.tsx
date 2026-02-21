/**
 * LandingCampaignStatus — Shows Meta Ads campaign status on landing page cards.
 * Statuses: Draft | Running | Paused | Error
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Megaphone, Play, Pause, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CampaignStatus = 'draft' | 'creating' | 'paused' | 'running' | 'error' | 'none';

interface CampaignData {
  id: string;
  meta_campaign_id: string | null;
  status: string;
  error_message: string | null;
  campaign_name: string;
  daily_budget_cents: number;
  created_at: string;
}

const statusConfig: Record<CampaignStatus, {
  label: string;
  icon: typeof Play;
  badgeClass: string;
  dotClass: string;
}> = {
  none: {
    label: 'Sem campanha',
    icon: Megaphone,
    badgeClass: 'border-muted-foreground/20 text-muted-foreground/60',
    dotClass: 'bg-muted-foreground/40',
  },
  draft: {
    label: 'Draft',
    icon: Megaphone,
    badgeClass: 'border-muted-foreground/30 text-muted-foreground',
    dotClass: 'bg-muted-foreground',
  },
  creating: {
    label: 'Criando…',
    icon: Loader2,
    badgeClass: 'border-amber-500/30 text-amber-500',
    dotClass: 'bg-amber-500 animate-pulse',
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    badgeClass: 'border-amber-500/30 text-amber-500',
    dotClass: 'bg-amber-500',
  },
  running: {
    label: 'Running',
    icon: Play,
    badgeClass: 'border-emerald-500/30 text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  error: {
    label: 'Error',
    icon: AlertTriangle,
    badgeClass: 'border-destructive/30 text-destructive',
    dotClass: 'bg-destructive',
  },
};

interface LandingCampaignStatusProps {
  landingPageId: string;
  className?: string;
}

export function LandingCampaignStatus({ landingPageId, className }: LandingCampaignStatusProps) {
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.functions
      .invoke('meta-ads-engine', {
        body: { action: 'get_campaign_status', landing_page_id: landingPageId },
      })
      .then(({ data }) => {
        setCampaign(data?.campaign ?? null);
      })
      .finally(() => setLoading(false));
  }, [landingPageId]);

  if (loading) return null;
  if (!campaign) return null; // No campaign = don't show anything

  const status = (campaign.status as CampaignStatus) || 'draft';
  const cfg = statusConfig[status] || statusConfig.draft;
  const Icon = cfg.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn('text-[10px] gap-1 cursor-default', cfg.badgeClass, className)}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
            <Icon className={cn('h-2.5 w-2.5', status === 'creating' && 'animate-spin')} />
            {cfg.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-xs">
          <p className="font-medium">{campaign.campaign_name}</p>
          <p className="text-muted-foreground">
            R${(campaign.daily_budget_cents / 100).toFixed(2)}/dia
          </p>
          {campaign.error_message && (
            <p className="text-destructive mt-1">{campaign.error_message}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
