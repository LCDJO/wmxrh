/**
 * Behavioral Traffic Intelligence Engine — Main Dashboard
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, Car, Download, Gauge, MapPin, RefreshCw,
  Shield, TrendingDown, TrendingUp, Trophy, Users, FileText, Loader2
} from 'lucide-react';
import { TripsTab } from './btie/TripsTab';
import { ViolationsTab } from './btie/ViolationsTab';
import { DriverScoresTab } from './btie/DriverScoresTab';
import { RadarPointsTab } from './btie/RadarPointsTab';
import { SyncStatusPanel } from './btie/SyncStatusPanel';
import { BehavioralRankingTab } from './btie/BehavioralRankingTab';
import { ViolationsHeatmapTab } from './btie/ViolationsHeatmapTab';

interface BtieProps {
  tenantId: string;
}

export function BtieIntelligenceDashboard({ tenantId }: BtieProps) {
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({
    totalTrips: 0, totalViolations: 0, avgScore: 0,
    totalDistance: 0, activeDrivers: 0, radarPoints: 0,
  });

  const fetchStats = useCallback(async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [tripsRes, violRes, scoresRes, radarRes] = await Promise.all([
      supabase.from('fleet_trips').select('id, distance_km', { count: 'exact' })
        .eq('tenant_id', tenantId).gte('start_time', monthStart),
      supabase.from('fleet_speed_violations').select('id', { count: 'exact' })
        .eq('tenant_id', tenantId).gte('detected_at', monthStart),
      supabase.from('fleet_driver_scores').select('overall_score, employee_id')
        .eq('tenant_id', tenantId)
        .gte('period_start', monthStart.split('T')[0]),
      supabase.from('fleet_radar_points').select('id', { count: 'exact' })
        .eq('tenant_id', tenantId).eq('is_active', true),
    ]);

    const trips = tripsRes.data || [];
    const scores = scoresRes.data || [];
    const totalDist = trips.reduce((sum, t) => sum + ((t as any).distance_km || 0), 0);
    const avgScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + ((s as any).overall_score || 0), 0) / scores.length
      : 0;

    setStats({
      totalTrips: tripsRes.count || 0,
      totalViolations: violRes.count || 0,
      avgScore: Math.round(avgScore),
      totalDistance: Math.round(totalDist),
      activeDrivers: new Set(scores.map(s => (s as any).employee_id)).size,
      radarPoints: radarRes.count || 0,
    });
  }, [tenantId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('traccar-sync', {
        body: { tenant_id: tenantId, mode: 'full' },
      });
      if (error) throw error;
      toast.success('Sincronização completa', {
        description: `${(data as any)?.results?.[0]?.positions_synced || 0} posições, ${(data as any)?.results?.[0]?.trips_built || 0} viagens, ${(data as any)?.results?.[0]?.violations || 0} infrações`,
      });
      fetchStats();
    } catch (err: any) {
      toast.error('Erro na sincronização', { description: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const gradeColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 75) return 'text-blue-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Behavioral Traffic Intelligence</h2>
          <p className="text-sm text-muted-foreground">Motor de inteligência comportamental de trânsito</p>
        </div>
        <Button onClick={handleSync} disabled={syncing} size="sm" className="gap-2">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Car className="h-3.5 w-3.5" /> Viagens
            </div>
            <p className="text-2xl font-bold">{stats.totalTrips}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Infrações
            </div>
            <p className="text-2xl font-bold text-destructive">{stats.totalViolations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Trophy className="h-3.5 w-3.5" /> Score Médio
            </div>
            <p className={`text-2xl font-bold ${gradeColor(stats.avgScore)}`}>
              {stats.avgScore || '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <MapPin className="h-3.5 w-3.5" /> Km Percorridos
            </div>
            <p className="text-2xl font-bold">{stats.totalDistance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" /> Motoristas
            </div>
            <p className="text-2xl font-bold">{stats.activeDrivers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Gauge className="h-3.5 w-3.5" /> Radares
            </div>
            <p className="text-2xl font-bold">{stats.radarPoints}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="trips" className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="trips" className="gap-1.5 text-xs">
            <Car className="h-3.5 w-3.5" /> Viagens
          </TabsTrigger>
          <TabsTrigger value="violations" className="gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" /> Infrações
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5 text-xs">
            <Trophy className="h-3.5 w-3.5" /> Ranking
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" /> Heatmap
          </TabsTrigger>
          <TabsTrigger value="radars" className="gap-1.5 text-xs">
            <Gauge className="h-3.5 w-3.5" /> Radares
          </TabsTrigger>
          <TabsTrigger value="scores" className="gap-1.5 text-xs">
            <Shield className="h-3.5 w-3.5" /> Scores
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5" /> Sync
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trips">
          <TripsTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="violations">
          <ViolationsTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="ranking">
          <BehavioralRankingTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="heatmap">
          <ViolationsHeatmapTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="radars">
          <RadarPointsTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="scores">
          <DriverScoresTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="sync">
          <SyncStatusPanel tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
