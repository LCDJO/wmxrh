/**
 * PlatformUserActivityIntelligence — SaaS-level user activity monitoring.
 *
 * Route: /platform/monitoring/user-activity
 *
 * Features:
 *  - Real-time session overview (all tenants)
 *  - Interactive Leaflet map with session dots
 *  - Heatmap analytics (country, city, tenant, hour)
 *  - Risk scoring and threat detection
 *  - Security alerts with resolve/block/logout actions
 *  - Device & browser analytics
 *  - Enhanced session table with filters and actions
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Activity, Globe, Shield, BarChart3, RefreshCw, Loader2, Map, AlertTriangle } from 'lucide-react';
import { useActiveSessions } from '@/modules/user-activity/hooks/useActiveSessions';
import { SessionStatsCards } from '@/modules/user-activity/ui/SessionStatsCards';
import { SessionLeafletMap } from '@/modules/user-activity/ui/SessionLeafletMap';
import { LoginHeatmapPanel } from '@/modules/user-activity/ui/LoginHeatmapPanel';
import { SecurityAlertsPanel } from '@/modules/user-activity/ui/SecurityAlertsPanel';
import { AlertManagementPanel } from '@/modules/user-activity/ui/AlertManagementPanel';
import { DeviceAnalyticsPanel } from '@/modules/user-activity/ui/DeviceAnalyticsPanel';
import { EnhancedSessionsPanel } from '@/modules/user-activity/ui/EnhancedSessionsPanel';

export default function PlatformUserActivityIntelligence() {
  const { sessions, mapSessions, stats, loading, refresh } = useActiveSessions();
  const [tab, setTab] = useState('overview');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            User Activity Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento global de sessões, geolocalização e comportamento suspeito — todos os tenants
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <SessionStatsCards stats={stats} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 max-w-3xl">
          <TabsTrigger value="overview" className="text-xs gap-1">
            <Globe className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="map" className="text-xs gap-1">
            <Map className="h-3.5 w-3.5" /> Mapa
          </TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs gap-1">
            <Activity className="h-3.5 w-3.5" /> Sessões
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="text-xs gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Heatmap
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Alertas
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1">
            <Shield className="h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <SessionLeafletMap sessions={sessions} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EnhancedSessionsPanel
              sessions={sessions.filter(s => s.status === 'online' || s.status === 'idle')}
              onRefresh={refresh}
            />
            <SecurityAlertsPanel sessions={sessions} />
          </div>
        </TabsContent>

        <TabsContent value="map">
          <SessionLeafletMap sessions={sessions} />
        </TabsContent>

        <TabsContent value="sessions">
          <EnhancedSessionsPanel sessions={sessions} onRefresh={refresh} />
        </TabsContent>

        <TabsContent value="heatmap">
          <LoginHeatmapPanel sessions={sessions} />
        </TabsContent>

        <TabsContent value="alerts">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AlertManagementPanel />
            <SecurityAlertsPanel sessions={sessions} />
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <DeviceAnalyticsPanel sessions={sessions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
