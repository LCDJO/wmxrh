/**
 * LandingPublishButton — Botão PUBLICAR com estados visuais:
 *  Draft → Publishing → Online → Error
 *
 * Chama a edge function `landing-deploy` para criar/remover DNS no Cloudflare.
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Rocket,
  Loader2,
  Globe,
  AlertTriangle,
  Power,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type DeployStatus = 'draft' | 'publishing' | 'online' | 'error';

interface LandingPublishButtonProps {
  pageId: string;
  tenantId?: string;
  /** Current deploy status derived from page data */
  currentStatus: DeployStatus;
  /** Deployed URL when online */
  deployUrl?: string | null;
  /** Callback after successful deploy/undeploy */
  onStatusChange?: (status: DeployStatus, url?: string) => void;
  disabled?: boolean;
  className?: string;
}

const statusConfig: Record<DeployStatus, {
  label: string;
  badgeClass: string;
  dotClass: string;
}> = {
  draft: {
    label: 'Draft',
    badgeClass: 'border-muted-foreground/30 text-muted-foreground bg-muted/30',
    dotClass: 'bg-muted-foreground',
  },
  publishing: {
    label: 'Publishing...',
    badgeClass: 'border-amber-500/30 text-amber-500 bg-amber-500/10',
    dotClass: 'bg-amber-500 animate-pulse',
  },
  online: {
    label: 'Online',
    badgeClass: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    dotClass: 'bg-emerald-500',
  },
  error: {
    label: 'Error',
    badgeClass: 'border-destructive/30 text-destructive bg-destructive/10',
    dotClass: 'bg-destructive',
  },
};

export function LandingPublishButton({
  pageId,
  tenantId,
  currentStatus,
  deployUrl,
  onStatusChange,
  disabled,
  className,
}: LandingPublishButtonProps) {
  const [status, setStatus] = useState<DeployStatus>(currentStatus);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const callDeploy = async (action: 'deploy' | 'undeploy') => {
    setStatus('publishing');
    setErrorMsg(null);
    onStatusChange?.('publishing');

    try {
      const { data, error } = await supabase.functions.invoke('landing-deploy', {
        body: {
          action,
          landing_page_id: pageId,
          tenant_id: tenantId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (action === 'deploy') {
        setStatus('online');
        onStatusChange?.('online', data.url);
      } else {
        setStatus('draft');
        onStatusChange?.('draft');
      }
    } catch (err: unknown) {
      console.error('Deploy error:', err);
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao publicar');
      onStatusChange?.('error');
    }
  };

  const cfg = statusConfig[status];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Status Badge */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn('text-[10px] gap-1.5 cursor-default', cfg.badgeClass)}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
              {cfg.label}
            </Badge>
          </TooltipTrigger>
          {status === 'error' && errorMsg && (
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <p className="text-destructive">{errorMsg}</p>
            </TooltipContent>
          )}
          {status === 'online' && deployUrl && (
            <TooltipContent side="bottom" className="text-xs">
              <p>{deployUrl}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {/* Action Buttons */}
      {status === 'draft' && (
        <Button
          size="sm"
          className="gap-1.5 text-xs"
          disabled={disabled}
          onClick={() => callDeploy('deploy')}
        >
          <Rocket className="h-3.5 w-3.5" />
          Publicar
        </Button>
      )}

      {status === 'publishing' && (
        <Button size="sm" disabled className="gap-1.5 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Publicando…
        </Button>
      )}

      {status === 'online' && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
          disabled={disabled}
          onClick={() => callDeploy('undeploy')}
        >
          <Power className="h-3.5 w-3.5" />
          Despublicar
        </Button>
      )}

      {status === 'error' && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
          disabled={disabled}
          onClick={() => callDeploy('deploy')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/** Helper: derive DeployStatus from page data */
export function deriveDeployStatus(page: {
  status?: string;
  deploy_url?: string | null;
  cloudflare_record_id?: string | null;
}): DeployStatus {
  if (page.deploy_url && page.cloudflare_record_id) return 'online';
  if (page.status === 'published' && !page.deploy_url) return 'draft'; // published in app but not deployed to DNS
  return 'draft';
}
