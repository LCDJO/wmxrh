/**
 * PlatformUserActivityIntelligence — SaaS-level user activity monitoring.
 *
 * Route: /platform/monitoring/user-activity
 *
 * Provides:
 *  - Real-time session overview (all tenants)
 *  - World map with login locations
 *  - Security alerts (VPN, concurrent logins, anomalies)
 *  - Device & browser analytics
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Activity, Globe, Shield, BarChart3, RefreshCw, Loader2 } from 'lucide-react';
import { useActiveSessions } from '@/modules/user-activity/hooks/useActiveSessions';
import { SessionStatsCards } from '@/modules/user-activity/ui/SessionStatsCards';
import { ActiveSessionsPanel } from '@/modules/user-activity/ui/ActiveSessionsPanel';
import { SessionWorldMap } from '@/modules/user-activity/ui/SessionWorldMap';
import { SecurityAlertsPanel } from '@/modules/user-activity/ui/SecurityAlertsPanel';
import { DeviceAnalyticsPanel } from '@/modules/user-activity/ui/DeviceAnalyticsPanel';

export default function PlatformUserActivityIntelligence() {
  const { sessions, stats, loading, refresh } = useActiveSessions();
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
            Monitoramento global de sessões e comportamento de usuários em todos os tenants
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
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Sessões
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Segurança
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <SessionWorldMap sessions={sessions} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ActiveSessionsPanel sessions={sessions.filter(s => s.status === 'online' || s.status === 'idle')} />
            <SecurityAlertsPanel sessions={sessions} />
          </div>
        </TabsContent>

        <TabsContent value="sessions">
          <ActiveSessionsPanel sessions={sessions} />
        </TabsContent>

        <TabsContent value="security">
          <SecurityAlertsPanel sessions={sessions} />
        </TabsContent>

        <TabsContent value="analytics">
          <DeviceAnalyticsPanel sessions={sessions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
