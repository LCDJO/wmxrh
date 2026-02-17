/**
 * PlatformObservability — Routed observability dashboard with tab navigation.
 *
 * Menu:
 *  Monitoramento
 *   ├── Status da Plataforma
 *   ├── Monitoramento de Módulos
 *   ├── Erros da Aplicação
 *   └── Performance
 */
import { useState, lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Heart, Server, Bug, Cpu, Loader2 } from 'lucide-react';

const PlatformStatusPanel = lazy(() => import('@/modules/observability/ui/PlatformStatusPanel'));
const ModuleMonitoringPanel = lazy(() => import('@/modules/observability/ui/ModuleMonitoringPanel'));
const ErrorTrackingPanel = lazy(() => import('@/modules/observability/ui/ErrorTrackingPanel'));
const PerformancePanel = lazy(() => import('@/modules/observability/ui/PerformancePanel'));

function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export default function PlatformObservability() {
  const [tab, setTab] = useState('status');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Monitoramento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Observabilidade em tempo real — Grafana Ready
        </p>
      </div>

      {/* Tab Navigation */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="status" className="text-xs gap-1.5">
            <Heart className="h-3.5 w-3.5" /> Status da Plataforma
          </TabsTrigger>
          <TabsTrigger value="modules" className="text-xs gap-1.5">
            <Server className="h-3.5 w-3.5" /> Módulos
          </TabsTrigger>
          <TabsTrigger value="errors" className="text-xs gap-1.5">
            <Bug className="h-3.5 w-3.5" /> Erros
          </TabsTrigger>
          <TabsTrigger value="performance" className="text-xs gap-1.5">
            <Cpu className="h-3.5 w-3.5" /> Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <Suspense fallback={<PanelLoader />}>
            <PlatformStatusPanel />
          </Suspense>
        </TabsContent>

        <TabsContent value="modules">
          <Suspense fallback={<PanelLoader />}>
            <ModuleMonitoringPanel />
          </Suspense>
        </TabsContent>

        <TabsContent value="errors">
          <Suspense fallback={<PanelLoader />}>
            <ErrorTrackingPanel />
          </Suspense>
        </TabsContent>

        <TabsContent value="performance">
          <Suspense fallback={<PanelLoader />}>
            <PerformancePanel />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
