/**
 * PlatformLiveDisplays — SaaS-side Live Operations Display management.
 * Cross-tenant visibility with admin capabilities.
 *
 * Tabs:
 *   /platform/monitoring/live-displays          → Mapa de Displays
 *   /platform/monitoring/live-displays/grid      → Status Grid (NOC)
 *   /platform/monitoring/live-displays/logs      → Logs de Eventos
 *   /platform/monitoring/live-displays/policies  → Políticas de Segurança
 */
import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tv, Map, LayoutGrid, ScrollText, ShieldCheck, Loader2 } from 'lucide-react';

const DisplayMapPanel = lazy(() => import('@/modules/live-display/saas/DisplayMapPanel'));
const DisplayStatusGrid = lazy(() => import('@/modules/live-display/saas/DisplayStatusGrid'));
const DisplayLogsPanel = lazy(() => import('@/modules/live-display/saas/DisplayLogsPanel'));
const DisplayPoliciesPanel = lazy(() => import('@/modules/live-display/saas/DisplayPoliciesPanel'));

function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

const TABS = [
  { value: '', label: 'Mapa', icon: Map },
  { value: 'grid', label: 'Status Grid', icon: LayoutGrid },
  { value: 'logs', label: 'Logs', icon: ScrollText },
  { value: 'policies', label: 'Políticas', icon: ShieldCheck },
] as const;

function resolveTab(pathname: string): string {
  if (pathname.endsWith('/policies')) return 'policies';
  if (pathname.endsWith('/logs')) return 'logs';
  if (pathname.endsWith('/grid')) return 'grid';
  return '';
}

export default function PlatformLiveDisplays() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = resolveTab(location.pathname);

  const handleTabChange = (value: string) => {
    const base = '/platform/monitoring/live-displays';
    navigate(value ? `${base}/${value}` : base, { replace: true });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <Tv className="h-6 w-6 text-primary" />
          Live Operations Display
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão centralizada de displays corporativos — visão cross-tenant
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
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

      <Suspense fallback={<PanelLoader />}>
        <Routes>
          <Route index element={<DisplayMapPanel />} />
          <Route path="grid" element={<DisplayStatusGrid />} />
          <Route path="logs" element={<DisplayLogsPanel />} />
          <Route path="policies" element={<DisplayPoliciesPanel />} />
        </Routes>
      </Suspense>
    </div>
  );
}
