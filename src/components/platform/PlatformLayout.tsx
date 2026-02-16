/**
 * PlatformLayout — Shell layout for /platform/* routes.
 * Visually distinct from tenant AppLayout with purple accent and "Modo Plataforma" label.
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
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
  Package,
} from 'lucide-react';
import { CognitivePanel } from './CognitivePanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const NAV_ITEMS = [
  { to: '/platform/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/platform/tenants', label: 'Tenants', icon: Building2 },
  { to: '/platform/modules', label: 'Módulos', icon: Puzzle },
  { to: '/platform/plans', label: 'Planos', icon: Package },
  { to: '/platform/users', label: 'Usuários', icon: Users },
  { to: '/platform/security', label: 'Segurança', icon: ShieldCheck },
  { to: '/platform/audit', label: 'Auditoria', icon: ScrollText },
];

export default function PlatformLayout() {
  const { signOut } = useAuth();
  const { identity } = usePlatformIdentity();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

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
      {/* ── Sidebar ── */}
      <aside className={cn(
        "gradient-platform-sidebar flex flex-col border-r border-[hsl(250_25%_20%)] transition-all duration-300 h-screen sticky top-0",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-[hsl(250_25%_20%)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-platform-accent">
            <Shield className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="font-display text-base font-bold text-white">RH Gestão</h1>
              <p className="text-[10px] font-semibold text-[hsl(265_80%_70%)] uppercase tracking-[0.15em]">
                Platform
              </p>
            </div>
          )}
        </div>

        {/* Mode badge */}
        {!collapsed && (
          <div className="mx-3 mt-4 mb-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(265_60%_50%/0.15)] border border-[hsl(265_60%_50%/0.25)]">
              <Zap className="h-3.5 w-3.5 text-[hsl(265_80%_70%)]" />
              <span className="text-[11px] font-semibold text-[hsl(265_80%_75%)] uppercase tracking-wider">
                Modo Plataforma
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center mt-4 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(265_60%_50%/0.15)] border border-[hsl(265_60%_50%/0.25)]">
              <Zap className="h-3.5 w-3.5 text-[hsl(265_80%_70%)]" />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  collapsed && 'justify-center',
                  isActive
                    ? 'bg-[hsl(265_60%_50%/0.18)] text-[hsl(265_80%_75%)]'
                    : 'text-[hsl(250_15%_65%)] hover:text-[hsl(250_15%_85%)] hover:bg-[hsl(250_25%_18%)]'
                )
              }
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="px-3 pb-2 border-t border-[hsl(250_25%_20%)] pt-4 space-y-3">
          {!collapsed && (
            <div className="px-2">
              <p className="text-xs font-medium text-[hsl(250_15%_85%)] truncate">{identity?.email}</p>
              <p className="text-[10px] text-[hsl(250_15%_55%)] mt-0.5">
                {identity ? roleLabel[identity.role] ?? identity.role : '—'}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full gap-2 text-[hsl(250_15%_55%)] hover:text-destructive hover:bg-[hsl(250_25%_18%)]",
              collapsed ? "justify-center" : "justify-start"
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && 'Sair'}
          </Button>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-4 border-t border-[hsl(250_25%_20%)] text-[hsl(250_15%_55%)] hover:text-[hsl(250_15%_85%)] transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col">
        {/* Top bar with platform mode indicator */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-3 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(265_60%_50%/0.08)] border border-[hsl(265_60%_50%/0.15)]">
              <div className="h-2 w-2 rounded-full bg-[hsl(265_80%_55%)] animate-pulse" />
              <span className="text-xs font-semibold text-[hsl(265_60%_45%)] uppercase tracking-wider">
                Modo Plataforma
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CognitivePanel />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              <span>{identity ? roleLabel[identity.role] ?? identity.role : ''}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
