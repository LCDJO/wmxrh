import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { ImpersonationBanner } from './ImpersonationBanner';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { AnnouncementBanner } from '@/components/announcements/AnnouncementBanner';
import { UserProfileDropdown } from './UserProfileDropdown';
import { GlobalFooter } from './GlobalFooter';
import { ContextualAdSlot } from '@/components/ads/ContextualAdSlot';
import { useSecurityMonitor } from '@/domains/security/useSecurityMonitor';
import { dualIdentityEngine } from '@/domains/security/kernel/dual-identity-engine';

export function AppLayout() {
  useSecurityMonitor();

  const location = useLocation();
  const isImpersonating = dualIdentityEngine.isImpersonating;
  const isDashboard = location.pathname === '/';
  const isModuleSurface = !isDashboard && location.pathname !== '/onboarding';

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <AnnouncementBanner />
        <ImpersonationBanner />
        <header
          className={`sticky top-0 z-10 flex items-center justify-between px-8 py-4 backdrop-blur-md border-b ${
            isImpersonating
              ? 'bg-[hsl(var(--impersonation-muted))]/80 border-[hsl(var(--impersonation-border))]'
              : 'bg-background/80 border-border'
          }`}
        >
          <div className="flex items-center gap-4">
            <WorkspaceSwitcher />
            <div className="h-5 w-px bg-border" />
            <AppBreadcrumbs />
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <UserProfileDropdown />
          </div>
        </header>
        <main className={`flex-1 p-8 space-y-6 ${isImpersonating ? 'ring-2 ring-inset ring-[hsl(var(--impersonation-border))]/30' : ''}`}>
          {isModuleSurface && <ContextualAdSlot slot="module_top_banner" />}
          <Outlet />
          {isModuleSurface && <ContextualAdSlot slot="module_inline" />}
        </main>
        <div className="px-8 pb-6">
          <ContextualAdSlot slot="tenant_footer" />
        </div>
        <GlobalFooter />
      </div>
    </div>
  );
}
