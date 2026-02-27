/**
 * Chaos Engineering — Control Plane Layout
 * /platform/control-plane/chaos
 */
import { NavLink, Outlet } from 'react-router-dom';
import { Flame, List, FileText, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/platform/control-plane/chaos', label: 'Cenários', icon: Flame, end: true },
  { to: '/platform/control-plane/chaos/executions', label: 'Execution Logs', icon: ScrollText },
  { to: '/platform/control-plane/chaos/reports', label: 'Reports', icon: FileText },
];

export default function ChaosLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Flame className="h-6 w-6 text-destructive" />
          Chaos Engineering
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simulação controlada de falhas para validar resiliência, failover, SLA e RTO/RPO
        </p>
      </div>

      <nav className="flex gap-1 border-b border-border pb-px">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-colors',
                isActive
                  ? 'bg-card text-foreground border border-border border-b-transparent -mb-px'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
