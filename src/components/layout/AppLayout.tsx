import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { ImpersonationBanner } from './ImpersonationBanner';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { AnnouncementBanner } from '@/components/announcements/AnnouncementBanner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSecurityMonitor } from '@/domains/security/useSecurityMonitor';
import { dualIdentityEngine } from '@/domains/security/kernel/dual-identity-engine';
import { lazy, Suspense } from 'react';

const FloatingChatWidget = lazy(() => import('@/modules/support/ui/FloatingChatWidget'));

export function AppLayout() {
  useSecurityMonitor();

  const isImpersonating = dualIdentityEngine.isImpersonating;

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
            <Avatar className={`h-9 w-9 border-2 ${
              isImpersonating ? 'border-[hsl(var(--impersonation))]' : 'border-primary/20'
            }`}>
              <AvatarFallback className={`text-sm font-semibold ${
                isImpersonating
                  ? 'bg-[hsl(var(--impersonation))] text-[hsl(var(--impersonation-foreground))]'
                  : 'bg-primary text-primary-foreground'
              }`}>
                {isImpersonating ? 'IM' : 'AD'}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>
        <main className={`flex-1 p-8 ${isImpersonating ? 'ring-2 ring-inset ring-[hsl(var(--impersonation-border))]/30' : ''}`}>
          <Outlet />
        </main>
      </div>
      <Suspense fallback={null}>
        <FloatingChatWidget />
      </Suspense>
    </div>
  );
}
