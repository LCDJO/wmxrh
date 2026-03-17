/**
 * /engajamento — Painel de engajamento do tenant.
 *
 * - Usuário comum: vê seus próprios pontos e nível.
 * - Admin do tenant: vê o leaderboard completo da equipe.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Trophy, Zap, Star, TrendingUp, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { TenantUserEngagement } from '@/domains/revenue-intelligence';

const MODULE_LABELS: Record<string, string> = {
  employees: 'Funcionários',
  companies: 'Empresas',
  departments: 'Departamentos',
  positions: 'Cargos',
  compensation: 'Salários',
  ats: 'Recrutamento',
  performance: 'Performance',
  automation: 'Automação',
};

interface MyEngagement {
  total_points: number;
  actions_count: number;
  top_module: string | null;
  last_action_at: string | null;
}

const EMPTY_ENGAGEMENT: MyEngagement = {
  total_points: 0,
  actions_count: 0,
  top_module: null,
  last_action_at: null,
};

export default function TenantEngagement() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const userId = user?.id ?? null;
  const [myData, setMyData] = useState<MyEngagement | null>(null);
  const [team, setTeam] = useState<TenantUserEngagement[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !tenantId) return;

    const engine = getRevenueIntelligenceEngine();

    async function load() {
      setLoading(true);

      const { data: membership } = await supabase
        .from('tenant_memberships')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();

      const admin = (membership as any)?.role === 'admin' || (membership as any)?.role === 'owner';
      setIsAdmin(admin);

      const mineResult = await (supabase
        .from('tenant_user_engagement' as any)
        .select('total_points, actions_count, top_module, last_action_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle() as any);

      const mine = mineResult?.data as Partial<MyEngagement> | null;
      setMyData({
        total_points: typeof mine?.total_points === 'number' ? mine.total_points : 0,
        actions_count: typeof mine?.actions_count === 'number' ? mine.actions_count : 0,
        top_module: typeof mine?.top_module === 'string' ? mine.top_module : null,
        last_action_at: typeof mine?.last_action_at === 'string' ? mine.last_action_at : null,
      });

      if (admin) {
        const teamData = await engine.gamification.getTenantUserEngagement(tenantId, 20);
        setTeam(teamData);
      }

      setLoading(false);
    }

    load().catch(() => {
      setMyData(EMPTY_ENGAGEMENT);
      setLoading(false);
    });
  }, [tenantId, userId]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Meu Engajamento</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe seus pontos e o engajamento da equipe.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <Star className="h-4 w-4" />
              <span className="text-xs font-medium text-muted-foreground">Meus Pontos</span>
            </div>
            <p className="text-2xl font-bold">{myData?.total_points ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-blue-500 mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-medium text-muted-foreground">Ações</span>
            </div>
            <p className="text-2xl font-bold">{myData?.actions_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-purple-500 mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium text-muted-foreground">Módulo Top</span>
            </div>
            <p className="text-sm font-semibold">
              {myData?.top_module ? (MODULE_LABELS[myData.top_module] ?? myData.top_module) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-emerald-500 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium text-muted-foreground">Última Ação</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {myData?.last_action_at
                ? new Date(myData.last_action_at).toLocaleDateString('pt-BR')
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard da Equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {team.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de engajamento ainda.</p>
            ) : (
              <div className="space-y-2">
                {team.map((row, idx) => (
                  <div
                    key={row.user_id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      idx < 3 ? 'border-primary/30 bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-muted text-sm font-bold text-muted-foreground shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {row.user_id === user?.id ? 'Você' : `${row.user_id.slice(0, 8)}…`}
                      </p>
                      <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>{row.actions_count} ações</span>
                        {row.top_module && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1">
                            {MODULE_LABELS[row.top_module] ?? row.top_module}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-foreground">{row.total_points}</p>
                      <p className="text-[10px] text-muted-foreground">pts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
