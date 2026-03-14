/**
 * PlatformSecurityCenter — SaaS-level Security & Access Intelligence dashboard.
 *
 * Route: /platform/monitoring/security-center
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, MapPin, Monitor, RefreshCw, Loader2, BarChart3 } from 'lucide-react';
import { useSecurityAlerts } from '@/modules/security-intelligence/hooks/useSecurityAlerts';
import { useUserDevices } from '@/modules/security-intelligence/hooks/useUserDevices';
import { SecurityStatsCards } from '@/modules/security-intelligence/ui/SecurityStatsCards';
import { SecurityAlertsTable } from '@/modules/security-intelligence/ui/SecurityAlertsTable';
import { ThreatMapPanel } from '@/modules/security-intelligence/ui/ThreatMapPanel';
import { DeviceHistoryPanel } from '@/modules/security-intelligence/ui/DeviceHistoryPanel';
import { HighRiskUsersPanel } from '@/modules/security-intelligence/ui/HighRiskUsersPanel';

export default function PlatformSecurityCenter() {
  const { alerts, stats, loading, refresh: refreshAlerts } = useSecurityAlerts();
  const { devices, loading: devicesLoading, refresh: refreshDevices } = useUserDevices();
  const [tab, setTab] = useState('overview');

  const refresh = () => {
    refreshAlerts();
    refreshDevices();
  };

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
            <Shield className="h-6 w-6 text-destructive" />
            Security Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Motor de inteligência de segurança — detecção de ameaças, análise de risco e resposta automática
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <SecurityStatsCards stats={stats} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="overview" className="text-xs gap-1">
            <Shield className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Alertas
          </TabsTrigger>
          <TabsTrigger value="threats" className="text-xs gap-1">
            <MapPin className="h-3.5 w-3.5" /> Ameaças
          </TabsTrigger>
          <TabsTrigger value="devices" className="text-xs gap-1">
            <Monitor className="h-3.5 w-3.5" /> Dispositivos
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Usuários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ThreatMapPanel alerts={alerts.filter(a => a.status === 'open' || a.status === 'investigating')} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SecurityAlertsTable
              alerts={alerts.filter(a => a.status === 'open' || a.status === 'investigating')}
              onRefresh={refresh}
            />
            <HighRiskUsersPanel alerts={alerts} />
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <SecurityAlertsTable alerts={alerts} onRefresh={refresh} />
        </TabsContent>

        <TabsContent value="threats">
          <ThreatMapPanel alerts={alerts} />
        </TabsContent>

        <TabsContent value="devices">
          <DeviceHistoryPanel devices={devices} onRefresh={refreshDevices} />
        </TabsContent>

        <TabsContent value="users">
          <HighRiskUsersPanel alerts={alerts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
