/**
 * /platform/monitoring — Application Monitoring hub with sub-route navigation.
 *
 * Submenus:
 *   /platform/monitoring          → Status da Plataforma (overview)
 *   /platform/monitoring/modules  → Monitoramento de Módulos
 *   /platform/monitoring/errors   → Erros da Aplicação
 *   /platform/monitoring/performance → Performance
 *   /platform/monitoring/incidents   → Incidentes Self-Healing
 */
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Heart, Server, Bug, Cpu, Loader2, ShieldAlert, Eye, Shield, Tv } from 'lucide-react';

const PlatformStatusPanel = lazy(() => import('@/modules/observability/ui/PlatformStatusPanel'));
const ModuleMonitoringPanel = lazy(() => import('@/modules/observability/ui/ModuleMonitoringPanel'));
const ErrorTrackingPanel = lazy(() => import('@/modules/observability/ui/ErrorTrackingPanel'));
const PerformancePanel = lazy(() => import('@/modules/observability/ui/PerformancePanel'));
const IncidentsPanel = lazy(() => import('@/modules/observability/ui/IncidentsPanel'));
const LiveUsersPanel = lazy(() => import('@/modules/observability/ui/LiveUsersPanel'));
const SecurityAlertsPanel = lazy(() => import('@/modules/observability/ui/SecurityAlertsPanel'));

function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

const TABS = [
  { value: '', label: 'Status', icon: Heart, path: '' },
  { value: 'modules', label: 'Módulos', icon: Server, path: 'modules' },
  { value: 'errors', label: 'Erros', icon: Bug, path: 'errors' },
  { value: 'performance', label: 'Performance', icon: Cpu, path: 'performance' },
  { value: 'incidents', label: 'Incidentes', icon: ShieldAlert, path: 'incidents' },
  { value: 'live-users', label: 'Live Users', icon: Eye, path: 'live-users' },
  { value: 'live-displays', label: 'Live Displays', icon: Tv, path: 'live-displays' },
  { value: 'security-alerts', label: 'Segurança', icon: Shield, path: 'security-alerts' },
] as const;

function resolveTab(pathname: string): string {
  if (pathname.endsWith('/security-alerts')) return 'security-alerts';
  if (pathname.includes('/live-displays')) return 'live-displays';
  if (pathname.endsWith('/live-users')) return 'live-users';
  if (pathname.endsWith('/modules')) return 'modules';
  if (pathname.endsWith('/errors')) return 'errors';
  if (pathname.endsWith('/performance')) return 'performance';
  if (pathname.endsWith('/incidents')) return 'incidents';
  return '';
}

export default function PlatformMonitoring() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = resolveTab(location.pathname);

  const handleTabChange = (value: string) => {
    const base = '/platform/monitoring';
    navigate(value ? `${base}/${value}` : base, { replace: true });
  };

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

      {/* Tab Navigation synced with routes */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-7 max-w-4xl">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1.5">
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Routed content */}
      <Suspense fallback={<PanelLoader />}>
        <Routes>
          <Route index element={<PlatformStatusPanel />} />
          <Route path="modules" element={<ModuleMonitoringPanel />} />
          <Route path="errors" element={<ErrorTrackingPanel />} />
          <Route path="performance" element={<PerformancePanel />} />
          <Route path="incidents" element={<IncidentsPanel />} />
          <Route path="live-users" element={<LiveUsersPanel />} />
          <Route path="security-alerts" element={<SecurityAlertsPanel />} />
        </Routes>
      </Suspense>
    </div>
  );
}
