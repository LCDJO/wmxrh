/**
 * PromoteLandingButton — Botão "Promover Landing" que cria campanha automática na Meta Ads.
 * Só aparece quando a landing está ONLINE e Meta Ads está conectado.
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Megaphone, CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromoteLandingButtonProps {
  pageId: string;
  pageName: string;
  tenantId: string;
  deployUrl: string;
  disabled?: boolean;
  className?: string;
}

export function PromoteLandingButton({
  pageId,
  pageName,
  tenantId,
  deployUrl,
  disabled,
  className,
}: PromoteLandingButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [result, setResult] = useState<{ campaign_id: string; adset_id: string; ad_id: string } | null>(null);
  const [budget, setBudget] = useState('10.00');

  const handlePromote = async () => {
    setPromoting(true);
    setResult(null);
    try {
      const budgetCents = Math.round(parseFloat(budget) * 100);
      if (isNaN(budgetCents) || budgetCents < 100) {
        toast({ title: 'Orçamento inválido', description: 'Mínimo R$1,00.', variant: 'destructive' });
        setPromoting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('meta-ads-engine', {
        body: {
          action: 'promote_landing',
          landing_page_id: pageId,
          tenant_id: tenantId,
          daily_budget_cents: budgetCents,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({
        campaign_id: data.campaign_id,
        adset_id: data.adset_id,
        ad_id: data.ad_id,
      });

      toast({ title: 'Campanha criada!', description: data.message });
    } catch (err: any) {
      toast({ title: 'Erro ao promover', description: err.message, variant: 'destructive' });
    }
    setPromoting(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setResult(null); }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn('gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10', className)}
          disabled={disabled}
        >
          <Megaphone className="h-3.5 w-3.5" />
          Promover Landing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Promover: {pageName}
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <p className="text-muted-foreground">
                Será criada automaticamente uma campanha completa (Campaign + AdSet + Ad) na Meta Ads
                direcionando tráfego para:
              </p>
              <p className="font-medium text-foreground break-all">{deployUrl}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Orçamento diário (R$)</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                className="max-w-32"
              />
              <p className="text-[10px] text-muted-foreground">Mínimo R$1,00. A campanha será criada pausada.</p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">Objetivo: Tráfego</Badge>
              <Badge variant="outline" className="text-[10px]">Otimização: Cliques no link</Badge>
              <Badge variant="outline" className="text-[10px]">Brasil</Badge>
            </div>

            <Button onClick={handlePromote} disabled={promoting} className="w-full gap-1.5">
              {promoting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando campanha…
                </>
              ) : (
                <>
                  <Megaphone className="h-4 w-4" />
                  Criar Campanha
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-medium text-foreground">Campanha criada com sucesso!</p>
              <p className="text-xs text-muted-foreground">A campanha foi criada pausada. Ative no Meta Ads Manager.</p>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Campaign ID</span>
                <code className="text-foreground">{result.campaign_id}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">AdSet ID</span>
                <code className="text-foreground">{result.adset_id}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ad ID</span>
                <code className="text-foreground">{result.ad_id}</code>
              </div>
            </div>

            <Button variant="outline" className="w-full gap-1.5 text-xs" asChild>
              <a
                href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${result.campaign_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir no Meta Ads Manager
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
