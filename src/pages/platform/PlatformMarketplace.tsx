/**
 * PlatformMarketplace — Marketplace catalog management for platform admins.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Store, Star, Download, DollarSign } from 'lucide-react';

interface DeveloperApp {
  name: string;
  slug: string;
  app_status: string;
  install_count: number;
  rating_avg: number | null;
  rating_count: number;
  icon_url: string | null;
  description: string | null;
  developer_id: string;
}

interface MarketplaceListing {
  id: string;
  featured: boolean;
  pricing_model: string;
  visibility: string;
  supported_modules: string[] | null;
  created_at: string;
  developer_apps: DeveloperApp | null;
}

export default function PlatformMarketplace() {
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['platform-marketplace-listings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('developer_marketplace_listings')
        .select('*, developer_apps(name, slug, app_status, install_count, rating_avg, rating_count, icon_url, description, developer_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const pricingLabel: Record<string, string> = {
    free: 'Gratuito',
    freemium: 'Freemium',
    paid: 'Pago',
    contact_sales: 'Sob Consulta',
  };

  const pricingColor: Record<string, string> = {
    free: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    freemium: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    paid: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    contact_sales: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
        <p className="text-sm text-muted-foreground">Catálogo de apps e integrações publicadas na plataforma.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Listings', value: listings.length, icon: Store },
          { label: 'Featured', value: (listings as MarketplaceListing[]).filter(l => l.featured).length, icon: Star },
          { label: 'Pagos', value: (listings as MarketplaceListing[]).filter(l => l.pricing_model === 'paid').length, icon: DollarSign },
          { label: 'Gratuitos', value: (listings as MarketplaceListing[]).filter(l => l.pricing_model === 'free').length, icon: Download },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Listings do Marketplace</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : listings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum listing encontrado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(listings as MarketplaceListing[]).map((listing) => {
                const app = listing.developer_apps;
                return (
                  <Card key={listing.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {app?.icon_url ? (
                            <img src={app.icon_url} alt="" className="h-8 w-8 rounded" />
                          ) : (
                            <Store className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-foreground truncate">{app?.name || 'App'}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">{app?.description || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={pricingColor[listing.pricing_model] || ''}>
                          {pricingLabel[listing.pricing_model] || listing.pricing_model}
                        </Badge>
                        {listing.featured && <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Featured</Badge>}
                        <Badge variant="outline">{listing.visibility}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Download className="h-3 w-3" />{app?.install_count || 0}</span>
                        <span className="flex items-center gap-1"><Star className="h-3 w-3" />{app?.rating_avg?.toFixed(1) || '—'} ({app?.rating_count || 0})</span>
                        {listing.supported_modules?.length > 0 && (
                          <span>{listing.supported_modules.length} módulos</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
