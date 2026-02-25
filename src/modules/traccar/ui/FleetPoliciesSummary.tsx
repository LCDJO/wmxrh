/**
 * FleetPoliciesSummary — Summary widget for the Traccar Policies tab
 * Shows counts of configured speed zones, enforcement zones and disciplinary rules
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Gauge, Camera, ArrowUpDown, Loader2 } from 'lucide-react';

interface Props {
  tenantId: string | null;
}

export default function FleetPoliciesSummary({ tenantId }: Props) {
  const [counts, setCounts] = useState({ speedZones: 0, enforcement: 0, disciplinary: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const fetch = async () => {
      setLoading(true);
      const [sz, ez, dr] = await Promise.all([
        supabase.from('fleet_speed_zones').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('fleet_enforcement_zones').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('fleet_disciplinary_rules').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true),
      ]);
      setCounts({
        speedZones: sz.count ?? 0,
        enforcement: ez.count ?? 0,
        disciplinary: dr.count ?? 0,
      });
      setLoading(false);
    };
    fetch();
  }, [tenantId]);

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const cards = [
    { icon: Gauge, label: 'Zonas de Velocidade', count: counts.speedZones, color: 'text-blue-500' },
    { icon: Camera, label: 'Pontos de Fiscalização', count: counts.enforcement, color: 'text-amber-500' },
    { icon: ArrowUpDown, label: 'Regras Disciplinares', count: counts.disciplinary, color: 'text-orange-500' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map(c => (
        <div key={c.label} className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
          <div className={`h-10 w-10 rounded-full bg-muted flex items-center justify-center ${c.color}`}>
            <c.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{c.count}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
