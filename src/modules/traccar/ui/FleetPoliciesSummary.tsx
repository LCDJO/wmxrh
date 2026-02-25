/**
 * FleetPoliciesSummary — Interactive policy cards with direct navigation
 * Each card shows count + status and navigates directly to the relevant tab
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Gauge, Camera, ArrowUpDown, Loader2, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  tenantId: string | null;
}

interface PolicyCard {
  key: string;
  icon: typeof Gauge;
  label: string;
  description: string;
  count: number;
  color: string;
  bgColor: string;
  tab: string;
}

export default function FleetPoliciesSummary({ tenantId }: Props) {
  const navigate = useNavigate();
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

  const cards: PolicyCard[] = [
    {
      key: 'speed', icon: Gauge, label: 'Zonas de Velocidade',
      description: 'Limites por região geográfica',
      count: counts.speedZones, color: 'text-blue-500', bgColor: 'bg-blue-500/10',
      tab: 'speed_zones',
    },
    {
      key: 'enforcement', icon: Camera, label: 'Pontos de Fiscalização',
      description: 'Radares e postos de controle',
      count: counts.enforcement, color: 'text-amber-500', bgColor: 'bg-amber-500/10',
      tab: 'enforcement',
    },
    {
      key: 'disciplinary', icon: ArrowUpDown, label: 'Regras Disciplinares',
      description: 'Escalonamento progressivo',
      count: counts.disciplinary, color: 'text-orange-500', bgColor: 'bg-orange-500/10',
      tab: 'disciplinary',
    },
  ];

  const goTo = (tab: string) => navigate(`/fleet-policies?tab=${tab}`);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map(c => (
        <button
          key={c.key}
          onClick={() => goTo(c.tab)}
          className="group flex flex-col gap-3 p-5 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 hover:border-primary/30 hover:shadow-md transition-all duration-200 text-left cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <div className={`h-10 w-10 rounded-lg ${c.bgColor} flex items-center justify-center ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{c.count}</p>
            <p className="text-sm font-medium text-foreground">{c.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
            <Plus className="h-3 w-3" /> Gerenciar
          </div>
        </button>
      ))}
    </div>
  );
}
