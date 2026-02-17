/**
 * /platform/marketing/campaigns — Campaigns (placeholder)
 *
 * Future: full campaign lifecycle management via CampaignLifecycleManager.
 */
import { Megaphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function MarketingCampaigns() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
            <Megaphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Campanhas</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie campanhas de marketing com ciclo de vida completo.
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px]">Em breve</Badge>
        </div>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="py-16 text-center space-y-3">
          <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">Módulo de Campanhas</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Em breve você poderá agrupar Landing Pages, Experimentos A/B e sequências de e-mail
            em campanhas coordenadas com metas compartilhadas e timelines unificadas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
