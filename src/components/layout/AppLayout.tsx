import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { ImpersonationBanner } from './ImpersonationBanner';
import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSecurityMonitor } from '@/domains/security/useSecurityMonitor';
import { dualIdentityEngine } from '@/domains/security/kernel/dual-identity-engine';

export function AppLayout() {
  useSecurityMonitor();

  const isImpersonating = dualIdentityEngine.isImpersonating;

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <ImpersonationBanner />
        <header
          className={`sticky top-0 z-10 flex items-center justify-between px-8 py-4 backdrop-blur-md border-b ${
            isImpersonating
              ? 'bg-[hsl(var(--impersonation-muted))]/80 border-[hsl(var(--impersonation-border))]'
              : 'bg-background/80 border-border'
          }`}
        >
          <div className="flex items-center gap-6">
            <AppBreadcrumbs />
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-10 bg-secondary border-0"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>
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
    </div>
  );
}
