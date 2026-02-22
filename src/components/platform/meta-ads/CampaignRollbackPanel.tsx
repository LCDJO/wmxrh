/**
 * CampaignRollbackPanel — Rollback to a previous campaign version.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RotateCcw, CheckCircle2, Loader2, ExternalLink, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CampaignVersion {
  id: string;
  campaign_name: string;
  status: string;
  version_number: number;
  is_active_version: boolean;
  daily_budget_cents: number;
  preview_url: string | null;
  created_at: string;
  error_message: string | null;
}

interface CampaignRollbackPanelProps {
  landingPageId: string;
  pageName: string;
  disabled?: boolean;
}

export function CampaignRollbackPanel({ landingPageId, pageName, disabled }: CampaignRollbackPanelProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<CampaignVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('meta-ads-engine', {
      body: { action: 'list_campaign_versions', landing_page_id: landingPageId },
    });
    setVersions(data?.versions ?? []);
    setLoading(false);
  }, [landingPageId]);

  useEffect(() => {
    if (open) fetchVersions();
  }, [open, fetchVersions]);

  const handleRollback = async (targetVersion: number) => {
    setRolling(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-ads-engine', {
        body: { action: 'rollback_campaign', landing_page_id: landingPageId, target_version: targetVersion },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data.message);
      await fetchVersions();
    } catch (err: unknown) {
      toast.error('Erro no rollback', { description: err instanceof Error ? err.message : String(err) });
    }
    setRolling(false);
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const { data } = await supabase.functions.invoke('meta-ads-engine', {
        body: { action: 'generate_preview_url', landing_page_id: landingPageId },
      });
      if (data?.preview_url) {
        setPreviewUrl(data.preview_url);
      }
    } catch {
      toast.error('Erro ao gerar preview URL.');
    }
    setPreviewLoading(false);
  };

  const statusColor: Record<string, string> = {
    paused: 'text-amber-500 border-amber-500/30',
    running: 'text-emerald-400 border-emerald-500/30',
    error: 'text-destructive border-destructive/30',
    creating: 'text-amber-500 border-amber-500/30',
  };

  if (versions.length === 0 && !open) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-xs text-muted-foreground"
          disabled={disabled}
        >
          <RotateCcw className="h-3 w-3" />
          Versões
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <RotateCcw className="h-4 w-4 text-primary" />
            Versões da Campanha: {pageName}
          </DialogTitle>
        </DialogHeader>

        {/* Preview URL */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs flex-1"
            onClick={handlePreview}
            disabled={previewLoading}
          >
            {previewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
            Gerar Preview URL
          </Button>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 truncate max-w-[200px]"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              {previewUrl.replace('https://', '')}
            </a>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma versão encontrada.</p>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {versions.map(v => (
                <div
                  key={v.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 text-xs',
                    v.is_active_version ? 'border-primary/30 bg-primary/5' : 'border-border/40'
                  )}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                    v{v.version_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">{v.campaign_name}</span>
                      {v.is_active_version && (
                        <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">Ativa</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className={cn('text-[9px]', statusColor[v.status] || '')}>
                        {v.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        R${(v.daily_budget_cents / 100).toFixed(2)}/dia
                      </span>
                    </div>
                  </div>
                  {!v.is_active_version && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[10px] h-7 px-2"
                      disabled={rolling}
                      onClick={() => handleRollback(v.version_number)}
                    >
                      {rolling ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    </Button>
                  )}
                  {v.is_active_version && (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
