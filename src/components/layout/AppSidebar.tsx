import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, TrendingUp, Building2, ChevronLeft, ChevronRight, Layers, LogOut } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/employees', icon: Users, label: 'Funcionários' },
  { to: '/companies', icon: Building2, label: 'Empresas' },
  { to: '/groups', icon: Layers, label: 'Grupos' },
  { to: '/positions', icon: Briefcase, label: 'Cargos' },
  { to: '/compensation', icon: TrendingUp, label: 'Remuneração' },
  { to: '/departments', icon: Building2, label: 'Departamentos' },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { currentTenant, tenants, setCurrentTenant } = useTenant();
  const { signOut } = useAuth();

  return (
    <aside className={cn("gradient-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0", collapsed ? "w-[72px]" : "w-[260px]")}>
      <div className="flex items-center gap-3 px-5 py-6 border-b border-sidebar-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-primary">
          <Users className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <h1 className="font-display text-base font-bold text-sidebar-primary-foreground">RH Gestão</h1>
            {tenants.length > 1 ? (
              <Select value={currentTenant?.id} onValueChange={id => { const t = tenants.find(t => t.id === id); if (t) setCurrentTenant(t); }}>
                <SelectTrigger className="h-6 px-0 border-0 bg-transparent text-xs text-sidebar-foreground/60 shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-sidebar-foreground/60 truncate">{currentTenant?.name || 'Organização'}</p>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
          return (
            <NavLink key={item.to} to={item.to} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200", isActive ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50")}>
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary")} />
              {!collapsed && <span className="animate-fade-in">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 pb-3 space-y-1">
        <button onClick={signOut} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all w-full")}>
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      <button onClick={() => setCollapsed(!collapsed)} className="flex items-center justify-center py-4 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
