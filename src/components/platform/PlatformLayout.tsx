/**
 * PlatformLayout — Shell layout for /platform/* routes.
 * Completely independent from tenant AppLayout.
 */
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import {
  LayoutDashboard,
  Building2,
  Puzzle,
  ShieldCheck,
  ScrollText,
  LogOut,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/platform/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/platform/tenants', label: 'Tenants', icon: Building2 },
  { to: '/platform/modules', label: 'Módulos', icon: Puzzle },
  { to: '/platform/security', label: 'Segurança', icon: ShieldCheck },
  { to: '/platform/audit', label: 'Auditoria', icon: ScrollText },
];

export default function PlatformLayout() {
  const { signOut } = useAuth();
  const { identity } = usePlatformIdentity();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/login', { replace: true });
  };

  const roleLabel: Record<string, string> = {
    platform_super_admin: 'Super Admin',
    platform_operations: 'Operações',
    platform_support: 'Suporte',
    platform_finance: 'Financeiro',
    platform_read_only: 'Somente Leitura',
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-[240px] shrink-0 border-r border-border/60 bg-card flex flex-col">
        {/* Brand */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border/40">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-bold font-display text-foreground">RH Gestão</p>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">Platform</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-border/40 space-y-3">
          <div className="px-1">
            <p className="text-xs font-medium text-foreground truncate">{identity?.email}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {identity ? roleLabel[identity.role] ?? identity.role : '—'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
